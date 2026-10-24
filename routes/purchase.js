// routes/purchase.js — 采购管理 (下单自动入库，事务保证库存一致)
const express = require('express');
const db = require('../db');
const { requireAuth, requireRoles } = require('../middleware/auth');

const router = express.Router();

// 生成采购单号 CG+YYYYMMDD+3位序号
function genOrderNo() {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const prefix = `CG${ymd}`;
  const last = db.prepare(
    "SELECT order_no FROM purchase_orders WHERE order_no LIKE ? ORDER BY id DESC LIMIT 1"
  ).get(`${prefix}%`);
  let seq = 1;
  if (last) {
    seq = parseInt(last.order_no.slice(-3), 10) + 1;
  }
  return `${prefix}${String(seq).padStart(3, '0')}`;
}

// 列表
router.get('/', requireAuth, (req, res) => {
  const { keyword, start_date, end_date } = req.query;
  let sql = `SELECT po.*, s.name AS supplier_name, u.real_name AS operator_name
             FROM purchase_orders po
             LEFT JOIN suppliers s ON po.supplier_id = s.id
             LEFT JOIN users u ON po.user_id = u.id WHERE 1=1`;
  const params = [];
  if (keyword) {
    sql += ' AND (po.order_no LIKE ? OR s.name LIKE ?)';
    params.push(`%${keyword}%`, `%${keyword}%`);
  }
  if (start_date) { sql += ' AND po.order_date >= ?'; params.push(start_date); }
  if (end_date) { sql += ' AND po.order_date <= ?'; params.push(end_date); }
  sql += ' ORDER BY po.id DESC';
  const rows = db.prepare(sql).all(...params);
  res.json({ data: rows });
});

// 详情（含明细）
router.get('/:id', requireAuth, (req, res) => {
  const order = db.prepare(
    `SELECT po.*, s.name AS supplier_name, u.real_name AS operator_name
     FROM purchase_orders po
     LEFT JOIN suppliers s ON po.supplier_id = s.id
     LEFT JOIN users u ON po.user_id = u.id
     WHERE po.id = ?`
  ).get(req.params.id);
  if (!order) return res.status(404).json({ error: '采购单不存在' });
  const items = db.prepare(
    `SELECT pi.*, p.name AS product_name, p.spec AS product_spec, p.unit AS product_unit
     FROM purchase_order_items pi
     LEFT JOIN products p ON pi.product_id = p.id
     WHERE pi.order_id = ?`
  ).all(req.params.id);
  res.json({ data: { ...order, items } });
});

// 新增采购单（事务：写入主表+明细+增加库存+写日志）
router.post('/', requireRoles('admin', 'purchaser'), (req, res) => {
  const { supplier_id, order_date, remark, items } = req.body || {};
  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: '请至少添加一条采购明细' });
  }
  // 校验明细
  for (const it of items) {
    if (!it.product_id || !it.quantity || it.quantity <= 0) {
      return res.status(400).json({ error: '明细中商品或数量不合法' });
    }
    if (it.unit_price < 0) return res.status(400).json({ error: '单价不能为负' });
  }

  const orderNo = genOrderNo();
  const total = items.reduce((s, it) => s + Number(it.quantity) * Number(it.unit_price || 0), 0);

  const insertOrder = db.prepare(
    'INSERT INTO purchase_orders (order_no,supplier_id,user_id,total_amount,order_date,remark) VALUES (?,?,?,?,?,?)'
  );
  const insertItem = db.prepare(
    'INSERT INTO purchase_order_items (order_id,product_id,quantity,unit_price,subtotal) VALUES (?,?,?,?,?)'
  );
  const addStock = db.prepare(
    'UPDATE products SET stock_quantity = stock_quantity + ? WHERE id = ?'
  );
  const insertLog = db.prepare(
    'INSERT INTO stock_logs (product_id,type,quantity,reference_type,reference_id,user_id) VALUES (?,?,?,?,?,?)'
  );

  try {
    db.exec('BEGIN');
    const info = insertOrder.run(
      orderNo,
      supplier_id || null,
      req.session.user.id,
      total,
      order_date || new Date().toISOString().slice(0, 10),
      remark || ''
    );
    const orderId = info.lastInsertRowid;
    for (const it of items) {
      const sub = Number(it.quantity) * Number(it.unit_price || 0);
      insertItem.run(orderId, it.product_id, it.quantity, it.unit_price, sub);
      addStock.run(it.quantity, it.product_id);
      insertLog.run(it.product_id, 'in', it.quantity, 'purchase', orderId, req.session.user.id);
    }
    db.exec('COMMIT');
    res.json({ id: orderId, order_no: orderNo });
  } catch (e) {
    db.exec('ROLLBACK');
    res.status(500).json({ error: '采购单创建失败：' + e.message });
  }
});

// 删除采购单（事务：回滚库存+删除明细+删除主单+删除日志）
router.delete('/:id', requireRoles('admin'), (req, res) => {
  const order = db.prepare('SELECT * FROM purchase_orders WHERE id=?').get(req.params.id);
  if (!order) return res.status(404).json({ error: '采购单不存在' });

  const items = db.prepare('SELECT * FROM purchase_order_items WHERE order_id=?').all(req.params.id);

  const subStock = db.prepare('UPDATE products SET stock_quantity = stock_quantity - ? WHERE id=?');

  try {
    db.exec('BEGIN');
    for (const it of items) {
      subStock.run(it.quantity, it.product_id);
    }
    db.prepare('DELETE FROM stock_logs WHERE reference_type=? AND reference_id=?').run('purchase', req.params.id);
    db.prepare('DELETE FROM purchase_order_items WHERE order_id=?').run(req.params.id);
    db.prepare('DELETE FROM purchase_orders WHERE id=?').run(req.params.id);
    db.exec('COMMIT');
    res.json({ ok: true });
  } catch (e) {
    db.exec('ROLLBACK');
    res.status(500).json({ error: '删除失败：' + e.message });
  }
});

module.exports = router;
