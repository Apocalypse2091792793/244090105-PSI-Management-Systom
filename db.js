// db.js — 数据库初始化、建表与种子数据
const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');

const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new DatabaseSync(path.join(DATA_DIR, 'inventory.db'));
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

// ============ 建表 ============
db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  username      TEXT    NOT NULL UNIQUE,
  password      TEXT    NOT NULL,
  real_name     TEXT    NOT NULL,
  role          TEXT    NOT NULL CHECK(role IN ('admin','purchaser','salesperson','warehouse')),
  created_at    TEXT    DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS categories (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  name    TEXT NOT NULL UNIQUE,
  remark  TEXT
);

CREATE TABLE IF NOT EXISTS suppliers (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  name      TEXT NOT NULL,
  contact   TEXT,
  phone     TEXT,
  address   TEXT,
  remark    TEXT
);

CREATE TABLE IF NOT EXISTS customers (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  name      TEXT NOT NULL,
  contact   TEXT,
  phone     TEXT,
  address   TEXT,
  remark    TEXT
);

CREATE TABLE IF NOT EXISTS products (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  name            TEXT    NOT NULL,
  category_id     INTEGER,
  spec            TEXT,
  unit            TEXT,
  purchase_price  REAL    NOT NULL DEFAULT 0,
  sale_price      REAL    NOT NULL DEFAULT 0,
  stock_quantity  INTEGER NOT NULL DEFAULT 0,
  remark          TEXT,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS purchase_orders (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  order_no      TEXT NOT NULL UNIQUE,
  supplier_id   INTEGER,
  user_id       INTEGER NOT NULL,
  total_amount  REAL NOT NULL DEFAULT 0,
  order_date    TEXT NOT NULL DEFAULT (date('now','localtime')),
  remark        TEXT,
  created_at    TEXT DEFAULT (datetime('now','localtime')),
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL,
  FOREIGN KEY (user_id)     REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS purchase_order_items (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id      INTEGER NOT NULL,
  product_id    INTEGER NOT NULL,
  quantity      INTEGER NOT NULL,
  unit_price    REAL NOT NULL,
  subtotal      REAL NOT NULL,
  FOREIGN KEY (order_id)   REFERENCES purchase_orders(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id)
);

CREATE TABLE IF NOT EXISTS sales_orders (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  order_no      TEXT NOT NULL UNIQUE,
  customer_id   INTEGER,
  user_id       INTEGER NOT NULL,
  total_amount  REAL NOT NULL DEFAULT 0,
  order_date    TEXT NOT NULL DEFAULT (date('now','localtime')),
  remark        TEXT,
  created_at    TEXT DEFAULT (datetime('now','localtime')),
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL,
  FOREIGN KEY (user_id)     REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS sales_order_items (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id      INTEGER NOT NULL,
  product_id    INTEGER NOT NULL,
  quantity      INTEGER NOT NULL,
  unit_price    REAL NOT NULL,
  subtotal      REAL NOT NULL,
  FOREIGN KEY (order_id)   REFERENCES sales_orders(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id)
);

CREATE TABLE IF NOT EXISTS stock_logs (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id      INTEGER NOT NULL,
  type            TEXT NOT NULL CHECK(type IN ('in','out')),
  quantity        INTEGER NOT NULL,
  reference_type  TEXT NOT NULL,   -- 'purchase' / 'sales'
  reference_id    INTEGER NOT NULL,
  user_id         INTEGER,
  created_at      TEXT DEFAULT (datetime('now','localtime')),
  FOREIGN KEY (product_id) REFERENCES products(id),
  FOREIGN KEY (user_id)    REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_po_supplier ON purchase_orders(supplier_id);
CREATE INDEX IF NOT EXISTS idx_so_customer ON sales_orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_stock_product ON stock_logs(product_id);
`);

// ============ 种子数据 ============
const userCount = db.prepare('SELECT COUNT(*) AS c FROM users').get().c;
if (userCount === 0) {
  const insertUser = db.prepare(
    'INSERT INTO users (username,password,real_name,role) VALUES (?,?,?,?)'
  );
  insertUser.run('admin',     '123456', '系统管理员', 'admin');
  insertUser.run('purchaser', '123456', '张采购',     'purchaser');
  insertUser.run('sales',     '123456', '李销售',     'salesperson');
  insertUser.run('warehouse', '123456', '王仓管',     'warehouse');
}

const catCount = db.prepare('SELECT COUNT(*) AS c FROM categories').get().c;
if (catCount === 0) {
  const ins = db.prepare('INSERT INTO categories (name,remark) VALUES (?,?)');
  ins.run('食品饮料', '日常食品及饮品');
  ins.run('日用百货', '生活用品');
  ins.run('办公用品', '办公文具');
  ins.run('电子数码', '电子产品');
}

const supCount = db.prepare('SELECT COUNT(*) AS c FROM suppliers').get().c;
if (supCount === 0) {
  const ins = db.prepare('INSERT INTO suppliers (name,contact,phone,address) VALUES (?,?,?,?)');
  ins.run('华东食品批发有限公司', '赵经理', '13800138001', '南京市鼓楼区中山北路100号');
  ins.run('诚信日用品供应商',     '孙女士', '13800138002', '南京市玄武区长江路50号');
  ins.run('办公用品直销中心',     '周先生', '13800138003', '南京市秦淮区中华路200号');
}

const custCount = db.prepare('SELECT COUNT(*) AS c FROM customers').get().c;
if (custCount === 0) {
  const ins = db.prepare('INSERT INTO customers (name,contact,phone,address) VALUES (?,?,?,?)');
  ins.run('好又多超市',     '陈店长', '13900139001', '南京市建邺区江东中路88号');
  ins.run('校园便利店',     '吴老板', '13900139002', '南京市栖霞区仙林大道163号');
  ins.run('兴隆百货商店',   '郑经理', '13900139003', '南京市雨花台区雨花东路66号');
}

const prodCount = db.prepare('SELECT COUNT(*) AS c FROM products').get().c;
if (prodCount === 0) {
  const ins = db.prepare(
    'INSERT INTO products (name,category_id,spec,unit,purchase_price,sale_price,stock_quantity) VALUES (?,?,?,?,?,?,?)'
  );
  // categories: 1食品饮料 2日用百货 3办公用品 4电子数码
  ins.run('矿泉水',     1, '550ml*24瓶', '箱', 24.00, 36.00, 100);
  ins.run('方便面',     1, '100g*30包',  '箱', 45.00, 60.00,  80);
  ins.run('牛奶',       1, '250ml*24盒', '箱', 60.00, 84.00,  50);
  ins.run('纸巾',       2, '3层*10包',   '提', 12.00, 18.00, 200);
  ins.run('洗衣液',     2, '2kg',        '瓶', 18.00, 28.00,  60);
  ins.run('签字笔',     3, '0.5mm黑色',  '支',  1.50,  3.00, 500);
  ins.run('A4打印纸',   3, '500张*8包',  '箱', 96.00,140.00,  40);
  ins.run('蓝牙耳机',   4, '入耳式',     '副', 60.00, 99.00,  30);
  ins.run('充电宝',     4, '10000mAh',   '个', 45.00, 79.00,  25);
}

module.exports = db;
