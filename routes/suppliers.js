// routes/suppliers.js — 供应商 CRUD
const express = require('express');
const db = require('../db');
const { requireAuth, requireRoles } = require('../middleware/auth');

const router = express.Router();

router.get('/', requireAuth, (req, res) => {
  const { keyword } = req.query;
  if (keyword) {
    const rows = db.prepare(
      'SELECT * FROM suppliers WHERE name LIKE ? OR contact LIKE ? OR phone LIKE ? ORDER BY id DESC'
    ).all(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
    return res.json({ data: rows });
  }
  const rows = db.prepare('SELECT * FROM suppliers ORDER BY id DESC').all();
  res.json({ data: rows });
});

router.post('/', requireRoles('admin', 'purchaser'), (req, res) => {
  const { name, contact, phone, address, remark } = req.body || {};
  if (!name || !name.trim()) return res.status(400).json({ error: '供应商名称不能为空' });
  const info = db.prepare(
    'INSERT INTO suppliers (name,contact,phone,address,remark) VALUES (?,?,?,?,?)'
  ).run(name.trim(), contact || '', phone || '', address || '', remark || '');
  res.json({ id: info.lastInsertRowid });
});

router.put('/:id', requireRoles('admin', 'purchaser'), (req, res) => {
  const { name, contact, phone, address, remark } = req.body || {};
  if (!name || !name.trim()) return res.status(400).json({ error: '供应商名称不能为空' });
  const info = db.prepare(
    'UPDATE suppliers SET name=?, contact=?, phone=?, address=?, remark=? WHERE id=?'
  ).run(name.trim(), contact || '', phone || '', address || '', remark || '', req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: '供应商不存在' });
  res.json({ ok: true });
});

router.delete('/:id', requireRoles('admin'), (req, res) => {
  const info = db.prepare('DELETE FROM suppliers WHERE id=?').run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: '供应商不存在' });
  res.json({ ok: true });
});

module.exports = router;
