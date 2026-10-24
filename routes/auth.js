// routes/auth.js — 登录/登出/当前用户
const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const ROLE_NAMES = {
  admin: '系统管理员',
  purchaser: '采购员',
  salesperson: '销售员',
  warehouse: '仓管员',
};

// 登录
router.post('/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: '请输入用户名和密码' });
  }
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user || user.password !== password) {
    return res.status(401).json({ error: '用户名或密码错误' });
  }
  req.session.user = {
    id: user.id,
    username: user.username,
    real_name: user.real_name,
    role: user.role,
    role_name: ROLE_NAMES[user.role],
  };
  res.json({ user: req.session.user });
});

// 登出
router.post('/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

// 当前登录用户
router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.session.user });
});

module.exports = router;
