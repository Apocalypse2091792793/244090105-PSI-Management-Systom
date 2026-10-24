// routes/categories.js — 商品分类 CRUD
const express = require('express');
const db = require('../db');
const { requireAuth, requireRoles } = require('../middleware/auth');

const router = express.Router();

router.get('/', requireAuth, (req, res) => {
  const rows = db.prepare('SELECT * FROM categories ORDER BY id').all();
  res.json({ data: rows });
});

router.post('/', requireRoles('admin', 'warehouse'), (req, res) => {
  const { name, remark } = req.body || {};
  if (!name || !name.trim()) return res.status(400).json({ error: '分类名称不能为空' });
  try {
    const info = db.prepare('INSERT INTO categories (name,remark) VALUES (?,?)').run(name.trim(), remark || '');
    res.json({ id: info.lastInsertRowid });
  } catch (e) {
    res.status(400).json({ error: '分类名称已存在' });
  }
});

router.put('/:id', requireRoles('admin', 'warehouse'), (req, res) => {
  const { name, remark } = req.body || {};
  if (!name || !name.trim()) return res.status(400).json({ error: '分类名称不能为空' });
  try {
    const info = db.prepare('UPDATE categories SET name=?, remark=? WHERE id=?').run(name.trim(), remark || '', req.params.id);
    if (info.changes === 0) return res.status(404).json({ error: '分类不存在' });
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: '分类名称已存在' });
  }
});

router.delete('/:id', requireRoles('admin'), (req, res) => {
  const info = db.prepare('DELETE FROM categories WHERE id=?').run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: '分类不存在' });
  res.json({ ok: true });
});

module.exports = router;
