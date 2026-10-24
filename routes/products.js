// routes/products.js — 商品 CRUD
const express = require('express');
const db = require('../db');
const { requireAuth, requireRoles } = require('../middleware/auth');

const router = express.Router();

// 列表（含分类名）
router.get('/', requireAuth, (req, res) => {
  const { keyword, category_id } = req.query;
  let sql = `SELECT p.*, c.name AS category_name
             FROM products p LEFT JOIN categories c ON p.category_id = c.id WHERE 1=1`;
  const params = [];
  if (keyword) {
    sql += ' AND (p.name LIKE ? OR p.spec LIKE ?)';
    params.push(`%${keyword}%`, `%${keyword}%`);
  }
  if (category_id) {
    sql += ' AND p.category_id = ?';
    params.push(category_id);
  }
  sql += ' ORDER BY p.id DESC';
  const rows = db.prepare(sql).all(...params);
  res.json({ data: rows });
});

// 单条
router.get('/:id', requireAuth, (req, res) => {
  const row = db.prepare('SELECT * FROM products WHERE id=?').get(req.params.id);
  if (!row) return res.status(404).json({ error: '商品不存在' });
  res.json({ data: row });
});

// 新增
router.post('/', requireRoles('admin', 'warehouse'), (req, res) => {
  const { name, category_id, spec, unit, purchase_price, sale_price, stock_quantity, remark } = req.body || {};
  if (!name || !name.trim()) return res.status(400).json({ error: '商品名称不能为空' });
  const info = db.prepare(
    `INSERT INTO products (name,category_id,spec,unit,purchase_price,sale_price,stock_quantity,remark)
     VALUES (?,?,?,?,?,?,?,?)`
  ).run(
    name.trim(),
    category_id || null,
    spec || '',
    unit || '',
    Number(purchase_price) || 0,
    Number(sale_price) || 0,
    Number(stock_quantity) || 0,
    remark || ''
  );
  res.json({ id: info.lastInsertRowid });
});

// 修改
router.put('/:id', requireRoles('admin', 'warehouse'), (req, res) => {
  const { name, category_id, spec, unit, purchase_price, sale_price, remark } = req.body || {};
  if (!name || !name.trim()) return res.status(400).json({ error: '商品名称不能为空' });
  const info = db.prepare(
    `UPDATE products SET name=?, category_id=?, spec=?, unit=?, purchase_price=?, sale_price=?, remark=?
     WHERE id=?`
  ).run(
    name.trim(),
    category_id || null,
    spec || '',
    unit || '',
    Number(purchase_price) || 0,
    Number(sale_price) || 0,
    remark || '',
    req.params.id
  );
  if (info.changes === 0) return res.status(404).json({ error: '商品不存在' });
  res.json({ ok: true });
});

// 删除
router.delete('/:id', requireRoles('admin'), (req, res) => {
  // 检查是否被采购/销售明细引用
  const used = db.prepare(
    'SELECT COUNT(*) AS c FROM purchase_order_items WHERE product_id=? UNION ALL SELECT COUNT(*) FROM sales_order_items WHERE product_id=?'
  ).all(req.params.id, req.params.id);
  const total = used.reduce((s, r) => s + r.c, 0);
  if (total > 0) return res.status(400).json({ error: '该商品已被采购/销售记录引用，无法删除' });
  const info = db.prepare('DELETE FROM products WHERE id=?').run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: '商品不存在' });
  res.json({ ok: true });
});

module.exports = router;
