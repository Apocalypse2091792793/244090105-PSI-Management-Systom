// routes/inventory.js — 库存管理 (查询/统计/低库存预警/出入库日志)
const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// 库存列表（带分类名）
router.get('/stock', requireAuth, (req, res) => {
  const { keyword, category_id, low } = req.query;
  let sql = `SELECT p.id, p.name, p.spec, p.unit, p.purchase_price, p.sale_price,
                    p.stock_quantity, c.name AS category_name
             FROM products p LEFT JOIN categories c ON p.category_id = c.id WHERE 1=1`;
  const params = [];
  if (keyword) {
    sql += ' AND (p.name LIKE ? OR p.spec LIKE ?)';
    params.push(`%${keyword}%`, `%${keyword}%`);
  }
  if (category_id) { sql += ' AND p.category_id = ?'; params.push(category_id); }
  if (low === '1') { sql += ' AND p.stock_quantity < 10'; }
  sql += ' ORDER BY p.stock_quantity ASC';
  const rows = db.prepare(sql).all(...params);
  res.json({ data: rows });
});

// 库存统计汇总
router.get('/summary', requireAuth, (req, res) => {
  const totalProducts = db.prepare('SELECT COUNT(*) AS c FROM products').get().c;
  const totalStock = db.prepare('SELECT COALESCE(SUM(stock_quantity),0) AS s FROM products').get().s;
  const stockValue = db.prepare(
    'SELECT COALESCE(SUM(stock_quantity * purchase_price),0) AS v FROM products'
  ).get().v;
  const lowStock = db.prepare('SELECT COUNT(*) AS c FROM products WHERE stock_quantity < 10').get().c;
  const outOfStock = db.prepare('SELECT COUNT(*) AS c FROM products WHERE stock_quantity = 0').get().c;
  res.json({
    data: { totalProducts, totalStock, stockValue, lowStock, outOfStock }
  });
});

// 出入库日志
router.get('/logs', requireAuth, (req, res) => {
  const { type, product_id, start_date, end_date } = req.query;
  let sql = `SELECT sl.*, p.name AS product_name, p.spec,
                    u.real_name AS operator_name
             FROM stock_logs sl
             LEFT JOIN products p ON sl.product_id = p.id
             LEFT JOIN users u ON sl.user_id = u.id WHERE 1=1`;
  const params = [];
  if (type) { sql += ' AND sl.type = ?'; params.push(type); }
  if (product_id) { sql += ' AND sl.product_id = ?'; params.push(product_id); }
  if (start_date) { sql += ' AND date(sl.created_at) >= ?'; params.push(start_date); }
  if (end_date) { sql += ' AND date(sl.created_at) <= ?'; params.push(end_date); }
  sql += ' ORDER BY sl.id DESC LIMIT 500';
  const rows = db.prepare(sql).all(...params);
  res.json({ data: rows });
});

// 仪表盘：最近7天采购/销售金额
router.get('/dashboard', requireAuth, (req, res) => {
  // 近7天日期
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }
  const purchaseByDay = db.prepare(
    `SELECT order_date, SUM(total_amount) AS amount FROM purchase_orders
     WHERE order_date >= date('now','localtime','-6 days') GROUP BY order_date`
  ).all();
  const salesByDay = db.prepare(
    `SELECT order_date, SUM(total_amount) AS amount FROM sales_orders
     WHERE order_date >= date('now','localtime','-6 days') GROUP BY order_date`
  ).all();
  const pMap = Object.fromEntries(purchaseByDay.map(r => [r.order_date, r.amount]));
  const sMap = Object.fromEntries(salesByDay.map(r => [r.order_date, r.amount]));
  const trend = days.map(d => ({
    date: d,
    purchase: Number(pMap[d] || 0),
    sales: Number(sMap[d] || 0),
  }));
  res.json({ data: trend });
});

module.exports = router;
