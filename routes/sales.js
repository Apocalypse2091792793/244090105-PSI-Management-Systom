// routes/sales.js — 销售管理 (出库校验库存，事务保证一致，销售报表)
const express = require('express');
const db = require('../db');
const { requireAuth, requireRoles } = require('../middleware/auth');

const router = express.Router();

function genOrderNo() {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const prefix = `XS${ymd}`;
  const last = db.prepare(
    "SELECT order_no FROM sales_orders WHERE order_no LIKE ? ORDER BY id DESC LIMIT 1"
  ).get(`${prefix}%`);
  let seq = 1;
  if (last) seq = parseInt(last.order_no.slice(-3), 10) + 1;
  return `${prefix}${String(seq).padStart(3, '0')}`;
}

// 列表
router.get('/', requireAuth, (req, res) => {
  const { keyword, start_date, end_date } = req.query;
  let sql = `SELECT so.*, c.name AS customer_name, u.real_name AS operator_name
             FROM sales_orders so
             LEFT JOIN customers c ON so.customer_id = c.id
             LEFT JOIN users u ON so.user_id = u.id WHERE 1=1`;
  const params = [];
  if (keyword) {
    sql += ' AND (so.order_no LIKE ? OR c.name LIKE ?)';
    params.push(`%${keyword}%`, `%${keyword}%`);
  }
  if (start_date) { sql += ' AND so.order_date >= ?'; params.push(start_date); }
  if (end_date) { sql += ' AND so.order_date <= ?'; params.push(end_date); }
  sql += ' ORDER BY so.id DESC';
  const rows = db.prepare(sql).all(...params);
  res.json({ data: rows });
});

// 详情
router.get('/:id', requireAuth, (req, res) => {
  const order = db.prepare(
    `SELECT so.*, c.name AS customer_name, u.real_name AS operator_name
     FROM sales_orders so
     LEFT JOIN customers c ON so.customer_id = c.id
     LEFT JOIN users u ON so.user_id = u.id
     WHERE so.id = ?`
  ).get(req.params.id);
  if (!order) return res.status(404).json({ error: '销售单不存在' });
  const items = db.prepare(
    `SELECT si.*, p.name AS product_name, p.spec AS product_spec, p.unit AS product_unit
     FROM sales_order_items si
     LEFT JOIN products p ON si.product_id = p.id
     WHERE si.order_id = ?`
  ).all(req.params.id);
  res.json({ data: { ...order, items } });
});

// 新增销售单（事务：校验库存→出库→写主单+明细+日志）
router.post('/', requireRoles('admin', 'salesperson'), (req, res) => {
  const { customer_id, order_date, remark, items } = req.body || {};
  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: '请至少添加一条销售明细' });
  }

  // 校验明细 + 库存
  for (const it of items) {
    if (!it.product_id || !it.quantity || it.quantity <= 0) {
      return res.status(400).json({ error: '明细中商品或数量不合法' });
    }
    if (it.unit_price < 0) return res.status(400).json({ error: '单价不能为负' });
    const prod = db.prepare('SELECT name, stock_quantity FROM products WHERE id=?').get(it.product_id);
    if (!prod) return res.status(400).json({ error: '商品不存在' });
    if (prod.stock_quantity < it.quantity) {
      return res.status(400).json({ error: `商品【${prod.name}】库存不足（当前 ${prod.stock_quantity}）` });
    }
  }

  const orderNo = genOrderNo();
  const total = items.reduce((s, it) => s + Number(it.quantity) * Number(it.unit_price || 0), 0);

  const insertOrder = db.prepare(
    'INSERT INTO sales_orders (order_no,customer_id,user_id,total_amount,order_date,remark) VALUES (?,?,?,?,?,?)'
  );
  const insertItem = db.prepare(
    'INSERT INTO sales_order_items (order_id,product_id,quantity,unit_price,subtotal) VALUES (?,?,?,?,?)'
  );
  const subStock = db.prepare(
    'UPDATE products SET stock_quantity = stock_quantity - ? WHERE id=?'
  );
  const insertLog = db.prepare(
    'INSERT INTO stock_logs (product_id,type,quantity,reference_type,reference_id,user_id) VALUES (?,?,?,?,?,?)'
  );

  try {
    db.exec('BEGIN');
    const info = insertOrder.run(
      orderNo,
      customer_id || null,
      req.session.user.id,
      total,
      order_date || new Date().toISOString().slice(0, 10),
      remark || ''
    );
    const orderId = info.lastInsertRowid;
    for (const it of items) {
      const sub = Number(it.quantity) * Number(it.unit_price || 0);
      insertItem.run(orderId, it.product_id, it.quantity, it.unit_price, sub);
      subStock.run(it.quantity, it.product_id);
      insertLog.run(it.product_id, 'out', it.quantity, 'sales', orderId, req.session.user.id);
    }
    db.exec('COMMIT');
    res.json({ id: orderId, order_no: orderNo });
  } catch (e) {
    db.exec('ROLLBACK');
    res.status(500).json({ error: '销售单创建失败：' + e.message });
  }
});

// 删除销售单（回滚库存）
router.delete('/:id', requireRoles('admin'), (req, res) => {
  const order = db.prepare('SELECT * FROM sales_orders WHERE id=?').get(req.params.id);
  if (!order) return res.status(404).json({ error: '销售单不存在' });
  const items = db.prepare('SELECT * FROM sales_order_items WHERE order_id=?').all(req.params.id);

  const addStock = db.prepare('UPDATE products SET stock_quantity = stock_quantity + ? WHERE id=?');

  try {
    db.exec('BEGIN');
    for (const it of items) addStock.run(it.quantity, it.product_id);
    db.prepare('DELETE FROM stock_logs WHERE reference_type=? AND reference_id=?').run('sales', req.params.id);
    db.prepare('DELETE FROM sales_order_items WHERE order_id=?').run(req.params.id);
    db.prepare('DELETE FROM sales_orders WHERE id=?').run(req.params.id);
    db.exec('COMMIT');
    res.json({ ok: true });
  } catch (e) {
    db.exec('ROLLBACK');
    res.status(500).json({ error: '删除失败：' + e.message });
  }
});

// ============ 销售报表 ============
// 按日期区间统计销售总额、订单数、商品销量排行
router.get('/report/summary', requireAuth, (req, res) => {
  const { start_date, end_date } = req.query;
  let where = '1=1';
  const params = [];
  if (start_date) { where += ' AND order_date >= ?'; params.push(start_date); }
  if (end_date) { where += ' AND order_date <= ?'; params.push(end_date); }

  const summary = db.prepare(
    `SELECT COUNT(*) AS order_count,
            COALESCE(SUM(total_amount),0) AS total_amount,
            COALESCE(SUM((SELECT SUM(quantity) FROM sales_order_items WHERE order_id = sales_orders.id)),0) AS total_qty
     FROM sales_orders WHERE ${where}`
  ).get(...params);

  // 商品销量排行
  const topProducts = db.prepare(
    `SELECT p.name AS product_name, p.spec,
            SUM(si.quantity) AS total_qty,
            SUM(si.subtotal) AS total_amount
     FROM sales_order_items si
     JOIN sales_orders so ON si.order_id = so.id
     JOIN products p ON si.product_id = p.id
     WHERE ${where.replace('order_date', 'so.order_date')}
     GROUP BY p.id ORDER BY total_qty DESC LIMIT 10`
  ).all(...params);

  // 每日销售趋势
  const daily = db.prepare(
    `SELECT order_date,
            COUNT(*) AS order_count,
            SUM(total_amount) AS total_amount
     FROM sales_orders WHERE ${where}
     GROUP BY order_date ORDER BY order_date`
  ).all(...params);

  res.json({ data: { summary, topProducts, daily } });
});

module.exports = router;
