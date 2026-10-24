// server.js — 商品购销存管理系统 主入口
const express = require('express');
const session = require('express-session');
const path = require('path');

const authRoutes = require('./routes/auth');
const categoryRoutes = require('./routes/categories');
const supplierRoutes = require('./routes/suppliers');
const customerRoutes = require('./routes/customers');
const productRoutes = require('./routes/products');
const purchaseRoutes = require('./routes/purchase');
const salesRoutes = require('./routes/sales');
const inventoryRoutes = require('./routes/inventory');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

app.use(session({
  secret: 'psi-secret-key-2024',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 8 }, // 8小时
}));

// 静态前端
app.use(express.static(path.join(__dirname, 'public')));

// API 路由
app.use('/api/auth', authRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/suppliers', supplierRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/products', productRoutes);
app.use('/api/purchase', purchaseRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/inventory', inventoryRoutes);

// 根路径重定向到登录页
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// 全局错误处理
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: '服务器内部错误' });
});

app.listen(PORT, () => {
  console.log(`\n========================================`);
  console.log(`  商品购销存管理系统 已启动`);
  console.log(`  访问地址: http://localhost:${PORT}`);
  console.log(`  默认账号: admin / 123456`);
  console.log(`========================================\n`);
});
