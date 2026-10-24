// app.js — 商品购销存管理系统 前端逻辑
const API = {
  async get(url) {
    const res = await fetch(url, { credentials: 'same-origin' });
    const data = await res.json();
    if (res.status === 401) { logout(); return null; }
    if (!res.ok) throw new Error(data.error || '请求失败');
    return data;
  },
  async post(url, body) {
    const res = await fetch(url, {
      method: 'POST', credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {})
    });
    const data = await res.json();
    if (res.status === 401) { logout(); return null; }
    if (!res.ok) throw new Error(data.error || '请求失败');
    return data;
  },
  async put(url, body) {
    const res = await fetch(url, {
      method: 'PUT', credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {})
    });
    const data = await res.json();
    if (res.status === 401) { logout(); return null; }
    if (!res.ok) throw new Error(data.error || '请求失败');
    return data;
  },
  async del(url) {
    const res = await fetch(url, { method: 'DELETE', credentials: 'same-origin' });
    const data = await res.json();
    if (res.status === 401) { logout(); return null; }
    if (!res.ok) throw new Error(data.error || '请求失败');
    return data;
  }
};

let currentUser = null;
let currentPage = 'dashboard';

// 角色中文名
const ROLE_NAME = { admin: '系统管理员', purchaser: '采购员', salesperson: '销售员', warehouse: '仓管员' };

// ============ 初始化 ============
async function init() {
  const stored = localStorage.getItem('user');
  if (!stored) { window.location.href = '/login.html'; return; }
  try {
    const res = await API.get('/api/auth/me');
    if (!res) return;
    currentUser = res.user;
  } catch (e) { logout(); return; }
  document.getElementById('userName').textContent = currentUser.real_name;
  document.getElementById('userRole').textContent = currentUser.role_name;
  bindSidebar();
  document.getElementById('logoutBtn').addEventListener('click', logout);
  document.getElementById('modalClose').addEventListener('click', closeModal);
  document.getElementById('modalMask').addEventListener('click', (e) => {
    if (e.target.id === 'modalMask') closeModal();
  });
  showPage('dashboard');
}

function logout() {
  API.post('/api/auth/logout').catch(() => {});
  localStorage.removeItem('user');
  window.location.href = '/login.html';
}

// ============ 侧边栏 ============
function bindSidebar() {
  document.querySelectorAll('#sideMenu li').forEach(li => {
    li.addEventListener('click', () => showPage(li.dataset.page));
  });
}

const PAGE_TITLES = {
  dashboard: '仪表盘', products: '商品管理', categories: '商品分类',
  suppliers: '供应商管理', customers: '客户管理', purchase: '采购管理',
  sales: '销售管理', inventory: '库存查询', report: '销售报表', logs: '出入库日志'
};

function showPage(page) {
  currentPage = page;
  document.querySelectorAll('#sideMenu li').forEach(li => {
    li.classList.toggle('active', li.dataset.page === page);
  });
  document.getElementById('pageTitle').textContent = PAGE_TITLES[page] || '';
  const renderers = {
    dashboard: renderDashboard, products: renderProducts, categories: renderCategories,
    suppliers: renderSuppliers, customers: renderCustomers, purchase: renderPurchase,
    sales: renderSales, inventory: renderInventory, report: renderReport, logs: renderLogs
  };
  (renderers[page] || (() => {}))();
}

// ============ 模态框 ============
function openModal(title, bodyHtml, footerHtml, large = false) {
  document.getElementById('modalTitle').textContent = title;
  document.getElementById('modalBody').innerHTML = bodyHtml;
  document.getElementById('modalFooter').innerHTML = footerHtml || '';
  const modal = document.getElementById('modal');
  modal.classList.toggle('large', large);
  document.getElementById('modalMask').classList.add('show');
}
function closeModal() { document.getElementById('modalMask').classList.remove('show'); }

function fmt(n) { return Number(n).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function money(n) { return '¥' + fmt(n); }

// ============ 仪表盘 ============
async function renderDashboard() {
  const c = document.getElementById('content');
  c.innerHTML = '<div class="empty">加载中...</div>';
  try {
    const [summary, trend] = await Promise.all([
      API.get('/api/inventory/summary'),
      API.get('/api/inventory/dashboard')
    ]);
    const s = summary.data;
    const max = Math.max(...trend.data.map(d => Math.max(d.purchase, d.sales)), 1);
    c.innerHTML = `
      <div class="stat-grid">
        <div class="stat-card blue"><div class="stat-icon">📦</div><div><div class="stat-value">${s.totalProducts}</div><div class="stat-label">商品种类</div></div></div>
        <div class="stat-card green"><div class="stat-icon">📊</div><div><div class="stat-value">${s.totalStock}</div><div class="stat-label">库存总量</div></div></div>
        <div class="stat-card orange"><div class="stat-icon">💰</div><div><div class="stat-value">${money(s.stockValue)}</div><div class="stat-label">库存总值</div></div></div>
        <div class="stat-card red"><div class="stat-icon">⚠️</div><div><div class="stat-value">${s.lowStock}</div><div class="stat-label">低库存商品</div></div></div>
      </div>
      <div class="card">
        <div class="card-title">近7天采购/销售金额趋势</div>
        <div class="chart-wrap">
          <div class="bar-chart">
            ${trend.data.map(d => `
              <div class="bar-col">
                <div class="bar-value">${d.sales > 0 ? fmt(d.sales) : ''}</div>
                <div class="bar-group">
                  <div class="bar purchase" style="height:${(d.purchase/max)*160}px" title="采购:${money(d.purchase)}"></div>
                  <div class="bar sales" style="height:${(d.sales/max)*160}px" title="销售:${money(d.sales)}"></div>
                </div>
                <div class="bar-label">${d.date.slice(5)}</div>
              </div>
            `).join('')}
          </div>
          <div style="text-align:center;margin-top:6px;">
            <span class="tag" style="background:#667eea22;color:#667eea;">■ 采购</span>
            <span class="tag" style="background:#52c41a22;color:#52c41a;margin-left:10px;">■ 销售</span>
          </div>
        </div>
      </div>
    `;
  } catch (e) { c.innerHTML = `<div class="empty">${e.message}</div>`; }
}

// ============ 商品管理 ============
async function renderProducts() {
  const c = document.getElementById('content');
  c.innerHTML = `
    <div class="card">
      <div class="toolbar">
        <input id="pKeyword" placeholder="搜索商品名称/规格">
        <select id="pCategory"><option value="">全部分类</option></select>
        <button class="btn btn-primary" id="pSearch">查询</button>
        <button class="btn btn-success" id="pAdd" style="margin-left:auto;">+ 新增商品</button>
      </div>
      <div id="pTable"></div>
    </div>
  `;
  const cats = (await API.get('/api/categories')).data;
  const sel = document.getElementById('pCategory');
  cats.forEach(c => sel.innerHTML += `<option value="${c.id}">${c.name}</option>`);

  const canEdit = ['admin', 'warehouse'].includes(currentUser.role);
  const canDel = currentUser.role === 'admin';

  async function load() {
    const kw = document.getElementById('pKeyword').value;
    const cid = document.getElementById('pCategory').value;
    const qs = new URLSearchParams();
    if (kw) qs.set('keyword', kw);
    if (cid) qs.set('category_id', cid);
    const data = (await API.get('/api/products?' + qs.toString())).data;
    const tb = document.getElementById('pTable');
    if (data.length === 0) { tb.innerHTML = '<div class="empty">暂无数据</div>'; return; }
    tb.innerHTML = `
      <table>
        <thead><tr><th>ID</th><th>商品名称</th><th>分类</th><th>规格</th><th>单位</th><th>进价</th><th>售价</th><th>库存</th><th>操作</th></tr></thead>
        <tbody>${data.map(p => `
          <tr>
            <td>${p.id}</td><td>${p.name}</td><td>${p.category_name || '-'}</td>
            <td>${p.spec || '-'}</td><td>${p.unit || '-'}</td>
            <td>${money(p.purchase_price)}</td><td>${money(p.sale_price)}</td>
            <td>${p.stock_quantity < 10 ? '<span class="tag tag-low">' + p.stock_quantity + '</span>' : p.stock_quantity}</td>
            <td class="actions">
              ${canEdit ? `<button class="btn btn-default btn-sm" onclick="editProduct(${p.id})">编辑</button>` : ''}
              ${canDel ? `<button class="btn btn-danger btn-sm" onclick="delProduct(${p.id})">删除</button>` : ''}
            </td>
          </tr>
        `).join('')}</tbody>
      </table>
    `;
  }
  document.getElementById('pSearch').onclick = load;
  document.getElementById('pAdd').onclick = () => editProduct(null);
  load();
}

window.editProduct = async function(id) {
  const cats = (await API.get('/api/categories')).data;
  const isEdit = !!id;
  let p = { name: '', category_id: '', spec: '', unit: '', purchase_price: '', sale_price: '', remark: '' };
  if (isEdit) p = (await API.get('/api/products/' + id)).data;
  openModal(isEdit ? '编辑商品' : '新增商品', `
    <div class="form-row">
      <div class="form-group"><label>商品名称 *</label><input id="f_name" value="${p.name || ''}"></div>
      <div class="form-group"><label>分类</label>
        <select id="f_category">
          <option value="">请选择</option>
          ${cats.map(c => `<option value="${c.id}" ${p.category_id == c.id ? 'selected' : ''}>${c.name}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>规格</label><input id="f_spec" value="${p.spec || ''}"></div>
      <div class="form-group"><label>单位</label><input id="f_unit" value="${p.unit || ''}" placeholder="如:箱/瓶/个"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>进价</label><input id="f_pp" type="number" step="0.01" value="${p.purchase_price || ''}"></div>
      <div class="form-group"><label>售价</label><input id="f_sp" type="number" step="0.01" value="${p.sale_price || ''}"></div>
    </div>
    ${isEdit ? '' : `<div class="form-row"><div class="form-group"><label>初始库存</label><input id="f_stock" type="number" value="0"></div></div>`}
    <div class="form-row full"><div class="form-group"><label>备注</label><textarea id="f_remark">${p.remark || ''}</textarea></div></div>
  `, `
    <button class="btn btn-default" onclick="closeModal()">取消</button>
    <button class="btn btn-primary" onclick="saveProduct(${id || 'null'})">保存</button>
  `);
};

window.saveProduct = async function(id) {
  const body = {
    name: document.getElementById('f_name').value.trim(),
    category_id: document.getElementById('f_category').value || null,
    spec: document.getElementById('f_spec').value,
    unit: document.getElementById('f_unit').value,
    purchase_price: document.getElementById('f_pp').value,
    sale_price: document.getElementById('f_sp').value,
    remark: document.getElementById('f_remark').value,
  };
  if (!body.name) { alert('请输入商品名称'); return; }
  if (!id) body.stock_quantity = document.getElementById('f_stock').value || 0;
  try {
    if (id) await API.put('/api/products/' + id, body);
    else await API.post('/api/products', body);
    closeModal(); renderProducts();
  } catch (e) { alert(e.message); }
};

window.delProduct = async function(id) {
  if (!confirm('确定删除该商品？')) return;
  try { await API.del('/api/products/' + id); renderProducts(); }
  catch (e) { alert(e.message); }
};

// ============ 分类管理 ============
async function renderCategories() {
  const c = document.getElementById('content');
  const canEdit = ['admin', 'warehouse'].includes(currentUser.role);
  const canDel = currentUser.role === 'admin';
  c.innerHTML = `
    <div class="card">
      <div class="toolbar">
        <button class="btn btn-success" id="cAdd" ${canEdit ? '' : 'disabled'}>+ 新增分类</button>
      </div>
      <div id="cTable"></div>
    </div>
  `;
  async function load() {
    const data = (await API.get('/api/categories')).data;
    const tb = document.getElementById('cTable');
    if (data.length === 0) { tb.innerHTML = '<div class="empty">暂无数据</div>'; return; }
    tb.innerHTML = `<table><thead><tr><th>ID</th><th>分类名称</th><th>备注</th><th>操作</th></tr></thead>
      <tbody>${data.map(x => `<tr><td>${x.id}</td><td>${x.name}</td><td>${x.remark || '-'}</td>
        <td class="actions">
          ${canEdit ? `<button class="btn btn-default btn-sm" onclick="editCategory(${x.id})">编辑</button>` : ''}
          ${canDel ? `<button class="btn btn-danger btn-sm" onclick="delCategory(${x.id})">删除</button>` : ''}
        </td></tr>`).join('')}</tbody></table>`;
  }
  document.getElementById('cAdd').onclick = () => editCategory(null);
  load();
}
window.editCategory = async function(id) {
  let x = { name: '', remark: '' };
  if (id) { const data = (await API.get('/api/categories')).data; x = data.find(i => i.id === id); }
  openModal(id ? '编辑分类' : '新增分类', `
    <div class="form-row full"><div class="form-group"><label>分类名称 *</label><input id="f_name" value="${x.name || ''}"></div></div>
    <div class="form-row full"><div class="form-group"><label>备注</label><textarea id="f_remark">${x.remark || ''}</textarea></div></div>
  `, `<button class="btn btn-default" onclick="closeModal()">取消</button>
      <button class="btn btn-primary" onclick="saveCategory(${id || 'null'})">保存</button>`);
};
window.saveCategory = async function(id) {
  const body = { name: document.getElementById('f_name').value.trim(), remark: document.getElementById('f_remark').value };
  if (!body.name) { alert('请输入分类名称'); return; }
  try { if (id) await API.put('/api/categories/' + id, body); else await API.post('/api/categories', body); closeModal(); renderCategories(); }
  catch (e) { alert(e.message); }
};
window.delCategory = async function(id) {
  if (!confirm('确定删除该分类？')) return;
  try { await API.del('/api/categories/' + id); renderCategories(); }
  catch (e) { alert(e.message); }
};

// ============ 供应商 ============
async function renderSuppliers() {
  const c = document.getElementById('content');
  const canEdit = ['admin', 'purchaser'].includes(currentUser.role);
  const canDel = currentUser.role === 'admin';
  c.innerHTML = `
    <div class="card">
      <div class="toolbar">
        <input id="sKw" placeholder="搜索名称/联系人/电话">
        <button class="btn btn-primary" id="sSearch">查询</button>
        <button class="btn btn-success" id="sAdd" style="margin-left:auto;" ${canEdit ? '' : 'disabled'}>+ 新增供应商</button>
      </div>
      <div id="sTable"></div>
    </div>`;
  async function load() {
    const kw = document.getElementById('sKw').value;
    const data = (await API.get('/api/suppliers' + (kw ? '?keyword=' + encodeURIComponent(kw) : ''))).data;
    const tb = document.getElementById('sTable');
    if (!data.length) { tb.innerHTML = '<div class="empty">暂无数据</div>'; return; }
    tb.innerHTML = `<table><thead><tr><th>ID</th><th>名称</th><th>联系人</th><th>电话</th><th>地址</th><th>操作</th></tr></thead>
      <tbody>${data.map(x => `<tr><td>${x.id}</td><td>${x.name}</td><td>${x.contact || '-'}</td><td>${x.phone || '-'}</td><td>${x.address || '-'}</td>
        <td class="actions">
          ${canEdit ? `<button class="btn btn-default btn-sm" onclick="editSupplier(${x.id})">编辑</button>` : ''}
          ${canDel ? `<button class="btn btn-danger btn-sm" onclick="delSupplier(${x.id})">删除</button>` : ''}
        </td></tr>`).join('')}</tbody></table>`;
  }
  document.getElementById('sSearch').onclick = load;
  document.getElementById('sAdd').onclick = () => editSupplier(null);
  load();
}
window.editSupplier = function(id) { openEntityModal('supplier', id); };
window.saveSupplier = function(id) { saveEntity('supplier', id, renderSuppliers); };
window.delSupplier = async function(id) {
  if (!confirm('确定删除该供应商？')) return;
  try { await API.del('/api/suppliers/' + id); renderSuppliers(); } catch (e) { alert(e.message); }
};

// ============ 客户 ============
async function renderCustomers() {
  const c = document.getElementById('content');
  const canEdit = ['admin', 'salesperson'].includes(currentUser.role);
  const canDel = currentUser.role === 'admin';
  c.innerHTML = `
    <div class="card">
      <div class="toolbar">
        <input id="custKw" placeholder="搜索名称/联系人/电话">
        <button class="btn btn-primary" id="custSearch">查询</button>
        <button class="btn btn-success" id="custAdd" style="margin-left:auto;" ${canEdit ? '' : 'disabled'}>+ 新增客户</button>
      </div>
      <div id="custTable"></div>
    </div>`;
  async function load() {
    const kw = document.getElementById('custKw').value;
    const data = (await API.get('/api/customers' + (kw ? '?keyword=' + encodeURIComponent(kw) : ''))).data;
    const tb = document.getElementById('custTable');
    if (!data.length) { tb.innerHTML = '<div class="empty">暂无数据</div>'; return; }
    tb.innerHTML = `<table><thead><tr><th>ID</th><th>名称</th><th>联系人</th><th>电话</th><th>地址</th><th>操作</th></tr></thead>
      <tbody>${data.map(x => `<tr><td>${x.id}</td><td>${x.name}</td><td>${x.contact || '-'}</td><td>${x.phone || '-'}</td><td>${x.address || '-'}</td>
        <td class="actions">
          ${canEdit ? `<button class="btn btn-default btn-sm" onclick="editCustomer(${x.id})">编辑</button>` : ''}
          ${canDel ? `<button class="btn btn-danger btn-sm" onclick="delCustomer(${x.id})">删除</button>` : ''}
        </td></tr>`).join('')}</tbody></table>`;
  }
  document.getElementById('custSearch').onclick = load;
  document.getElementById('custAdd').onclick = () => editCustomer(null);
  load();
}
window.editCustomer = function(id) { openEntityModal('customer', id); };
window.saveCustomer = function(id) { saveEntity('customer', id, renderCustomers); };
window.delCustomer = async function(id) {
  if (!confirm('确定删除该客户？')) return;
  try { await API.del('/api/customers/' + id); renderCustomers(); } catch (e) { alert(e.message); }
};

// 供应商/客户 通用表单
const entityCache = {};
function openEntityModal(type, id) {
  entityCache.type = type; entityCache.id = id;
  let x = { name: '', contact: '', phone: '', address: '', remark: '' };
  const api = type === 'supplier' ? '/api/suppliers' : '/api/customers';
  const title = (type === 'supplier' ? '供应商' : '客户');
  (async () => {
    if (id) {
      const list = (await API.get(api)).data;
      x = list.find(i => i.id === id);
    }
    openModal((id ? '编辑' : '新增') + title, `
      <div class="form-row full"><div class="form-group"><label>${title}名称 *</label><input id="f_name" value="${x.name || ''}"></div></div>
      <div class="form-row">
        <div class="form-group"><label>联系人</label><input id="f_contact" value="${x.contact || ''}"></div>
        <div class="form-group"><label>电话</label><input id="f_phone" value="${x.phone || ''}"></div>
      </div>
      <div class="form-row full"><div class="form-group"><label>地址</label><input id="f_address" value="${x.address || ''}"></div></div>
      <div class="form-row full"><div class="form-group"><label>备注</label><textarea id="f_remark">${x.remark || ''}</textarea></div></div>
    `, `<button class="btn btn-default" onclick="closeModal()">取消</button>
        <button class="btn btn-primary" onclick="saveEntity('${type}',${id || 'null'},render${type === 'supplier' ? 'Suppliers' : 'Customers'})">保存</button>`);
  })();
}
window.saveEntity = async function(type, id, after) {
  const body = {
    name: document.getElementById('f_name').value.trim(),
    contact: document.getElementById('f_contact').value,
    phone: document.getElementById('f_phone').value,
    address: document.getElementById('f_address').value,
    remark: document.getElementById('f_remark').value,
  };
  if (!body.name) { alert('请输入名称'); return; }
  const api = type === 'supplier' ? '/api/suppliers' : '/api/customers';
  try {
    if (id) await API.put(api + '/' + id, body);
    else await API.post(api, body);
    closeModal(); after();
  } catch (e) { alert(e.message); }
};

// ============ 采购管理 ============
async function renderPurchase() {
  const c = document.getElementById('content');
  const canAdd = ['admin', 'purchaser'].includes(currentUser.role);
  const canDel = currentUser.role === 'admin';
  c.innerHTML = `
    <div class="card">
      <div class="toolbar">
        <input id="poKw" placeholder="单号/供应商">
        <input type="date" id="poStart">
        <input type="date" id="poEnd">
        <button class="btn btn-primary" id="poSearch">查询</button>
        <button class="btn btn-success" id="poAdd" style="margin-left:auto;" ${canAdd ? '' : 'disabled'}>+ 新建采购单</button>
      </div>
      <div id="poTable"></div>
    </div>`;
  async function load() {
    const qs = new URLSearchParams();
    const kw = document.getElementById('poKw').value;
    const sd = document.getElementById('poStart').value;
    const ed = document.getElementById('poEnd').value;
    if (kw) qs.set('keyword', kw);
    if (sd) qs.set('start_date', sd);
    if (ed) qs.set('end_date', ed);
    const data = (await API.get('/api/purchase?' + qs.toString())).data;
    const tb = document.getElementById('poTable');
    if (!data.length) { tb.innerHTML = '<div class="empty">暂无数据</div>'; return; }
    tb.innerHTML = `<table><thead><tr><th>单号</th><th>供应商</th><th>日期</th><th>金额</th><th>操作人</th><th>操作</th></tr></thead>
      <tbody>${data.map(x => `<tr><td>${x.order_no}</td><td>${x.supplier_name || '-'}</td><td>${x.order_date}</td>
        <td><b>${money(x.total_amount)}</b></td><td>${x.operator_name || '-'}</td>
        <td class="actions">
          <button class="btn btn-default btn-sm" onclick="viewOrder('purchase',${x.id})">详情</button>
          ${canDel ? `<button class="btn btn-danger btn-sm" onclick="delOrder('purchase',${x.id})">删除</button>` : ''}
        </td></tr>`).join('')}</tbody></table>`;
  }
  document.getElementById('poSearch').onclick = load;
  document.getElementById('poAdd').onclick = () => orderForm('purchase');
  load();
}

// ============ 销售管理 ============
async function renderSales() {
  const c = document.getElementById('content');
  const canAdd = ['admin', 'salesperson'].includes(currentUser.role);
  const canDel = currentUser.role === 'admin';
  c.innerHTML = `
    <div class="card">
      <div class="toolbar">
        <input id="soKw" placeholder="单号/客户">
        <input type="date" id="soStart">
        <input type="date" id="soEnd">
        <button class="btn btn-primary" id="soSearch">查询</button>
        <button class="btn btn-success" id="soAdd" style="margin-left:auto;" ${canAdd ? '' : 'disabled'}>+ 新建销售单</button>
      </div>
      <div id="soTable"></div>
    </div>`;
  async function load() {
    const qs = new URLSearchParams();
    const kw = document.getElementById('soKw').value;
    const sd = document.getElementById('soStart').value;
    const ed = document.getElementById('soEnd').value;
    if (kw) qs.set('keyword', kw);
    if (sd) qs.set('start_date', sd);
    if (ed) qs.set('end_date', ed);
    const data = (await API.get('/api/sales?' + qs.toString())).data;
    const tb = document.getElementById('soTable');
    if (!data.length) { tb.innerHTML = '<div class="empty">暂无数据</div>'; return; }
    tb.innerHTML = `<table><thead><tr><th>单号</th><th>客户</th><th>日期</th><th>金额</th><th>操作人</th><th>操作</th></tr></thead>
      <tbody>${data.map(x => `<tr><td>${x.order_no}</td><td>${x.customer_name || '-'}</td><td>${x.order_date}</td>
        <td><b>${money(x.total_amount)}</b></td><td>${x.operator_name || '-'}</td>
        <td class="actions">
          <button class="btn btn-default btn-sm" onclick="viewOrder('sales',${x.id})">详情</button>
          ${canDel ? `<button class="btn btn-danger btn-sm" onclick="delOrder('sales',${x.id})">删除</button>` : ''}
        </td></tr>`).join('')}</tbody></table>`;
  }
  document.getElementById('soSearch').onclick = load;
  document.getElementById('soAdd').onclick = () => orderForm('sales');
  load();
}

// 采购/销售单 表单
async function orderForm(type) {
  const isPurchase = type === 'purchase';
  const [products, parties] = await Promise.all([
    API.get('/api/products'),
    API.get(isPurchase ? '/api/suppliers' : '/api/customers')
  ]);
  const partyLabel = isPurchase ? '供应商' : '客户';
  const priceLabel = isPurchase ? '进价' : '售价';
  const priceField = isPurchase ? 'purchase_price' : 'sale_price';

  openModal((isPurchase ? '新建采购单' : '新建销售单'), `
    <div class="form-row">
      <div class="form-group"><label>${partyLabel}</label>
        <select id="f_party"><option value="">请选择</option>
          ${parties.data.map(p => `<option value="${p.id}">${p.name}</option>`).join('')}
        </select>
      </div>
      <div class="form-group"><label>日期</label><input type="date" id="f_date" value="${new Date().toISOString().slice(0,10)}"></div>
    </div>
    <div class="form-row full"><div class="form-group"><label>备注</label><textarea id="f_remark"></textarea></div></div>
    <div class="card-title" style="margin-top:6px;">明细</div>
    <table class="detail-table">
      <thead><tr><th>商品</th><th>数量</th><th>${priceLabel}</th><th>小计</th><th></th></tr></thead>
      <tbody id="itemRows"></tbody>
    </table>
    <button class="btn btn-default btn-sm" id="addItem">+ 添加商品</button>
    <div style="text-align:right;margin-top:12px;font-size:16px;">合计：<b id="total" style="color:#ff4d4f;">¥0.00</b></div>
  `, `<button class="btn btn-default" onclick="closeModal()">取消</button>
      <button class="btn btn-primary" onclick="submitOrder('${type}')">提交</button>`, true);

  let items = [];
  window._items = items;
  const opts = products.data.map(p => `<option value="${p.id}" data-price="${p[priceField]}">${p.name} (库存:${p.stock_quantity})</option>`).join('');

  function addRow() {
    const idx = items.length;
    items.push({ product_id: '', quantity: 1, unit_price: 0 });
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><select class="item-prod">${opts}</select></td>
      <td><input type="number" class="item-qty" value="1" min="1"></td>
      <td><input type="number" class="item-price" value="0" step="0.01"></td>
      <td class="item-sub">¥0.00</td>
      <td><span class="row-remove" onclick="this.closest('tr').remove();">✕</span></td>
    `;
    document.getElementById('itemRows').appendChild(tr);
    tr.querySelector('.item-prod').addEventListener('change', (e) => {
      const opt = e.target.selectedOptions[0];
      tr.querySelector('.item-price').value = opt.dataset.price;
      calcTotal();
    });
    tr.querySelector('.item-qty').addEventListener('input', calcTotal);
    tr.querySelector('.item-price').addEventListener('input', calcTotal);
    calcTotal();
  }
  function calcTotal() {
    const rows = document.querySelectorAll('#itemRows tr');
    let total = 0;
    rows.forEach(tr => {
      const qty = Number(tr.querySelector('.item-qty').value) || 0;
      const price = Number(tr.querySelector('.item-price').value) || 0;
      const sub = qty * price;
      tr.querySelector('.item-sub').textContent = money(sub);
      total += sub;
    });
    document.getElementById('total').textContent = money(total);
  }
  document.getElementById('addItem').onclick = addRow;
  addRow();
  window._calcTotal = calcTotal;
}

window.submitOrder = async function(type) {
  const isPurchase = type === 'purchase';
  const rows = document.querySelectorAll('#itemRows tr');
  const items = [];
  for (const tr of rows) {
    const pid = tr.querySelector('.item-prod').value;
    const qty = Number(tr.querySelector('.item-qty').value);
    const price = Number(tr.querySelector('.item-price').value);
    if (!pid || qty <= 0) { alert('请完善明细：商品和数量'); return; }
    items.push({ product_id: Number(pid), quantity: qty, unit_price: price });
  }
  const body = {
    [isPurchase ? 'supplier_id' : 'customer_id']: document.getElementById('f_party').value || null,
    order_date: document.getElementById('f_date').value,
    remark: document.getElementById('f_remark').value,
    items
  };
  try {
    const res = await API.post(isPurchase ? '/api/purchase' : '/api/sales', body);
    closeModal();
    alert((isPurchase ? '采购单' : '销售单') + '创建成功！单号：' + res.order_no);
    showPage(type);
  } catch (e) { alert(e.message); }
};

window.viewOrder = async function(type, id) {
  const isPurchase = type === 'purchase';
  const data = (await API.get('/api/' + type + '/' + id)).data;
  const partyLabel = isPurchase ? '供应商' : '客户';
  const partyName = isPurchase ? data.supplier_name : data.customer_name;
  openModal((isPurchase ? '采购单' : '销售单') + '详情', `
    <div class="form-row">
      <div><b>单号：</b>${data.order_no}</div>
      <div><b>${partyLabel}：</b>${partyName || '-'}</div>
    </div>
    <div class="form-row">
      <div><b>日期：</b>${data.order_date}</div>
      <div><b>操作人：</b>${data.operator_name || '-'}</div>
    </div>
    ${data.remark ? `<div style="margin:8px 0;"><b>备注：</b>${data.remark}</div>` : ''}
    <table class="detail-table">
      <thead><tr><th>商品</th><th>规格</th><th>单位</th><th>数量</th><th>单价</th><th>小计</th></tr></thead>
      <tbody>${data.items.map(it => `<tr><td>${it.product_name}</td><td>${it.product_spec || '-'}</td>
        <td>${it.product_unit || '-'}</td><td>${it.quantity}</td><td>${money(it.unit_price)}</td><td>${money(it.subtotal)}</td></tr>`).join('')}</tbody>
    </table>
    <div style="text-align:right;font-size:16px;">合计：<b style="color:#ff4d4f;">${money(data.total_amount)}</b></div>
  `, `<button class="btn btn-default" onclick="closeModal()">关闭</button>`);
};

window.delOrder = async function(type, id) {
  if (!confirm('确定删除该单据？删除将回滚库存。')) return;
  try { await API.del('/api/' + type + '/' + id); showPage(type); }
  catch (e) { alert(e.message); }
};

// ============ 库存查询 ============
async function renderInventory() {
  const c = document.getElementById('content');
  const summary = (await API.get('/api/inventory/summary')).data;
  c.innerHTML = `
    <div class="stat-grid">
      <div class="stat-card blue"><div class="stat-icon">📦</div><div><div class="stat-value">${summary.totalProducts}</div><div class="stat-label">商品种类</div></div></div>
      <div class="stat-card green"><div class="stat-icon">📊</div><div><div class="stat-value">${summary.totalStock}</div><div class="stat-label">库存总量</div></div></div>
      <div class="stat-card orange"><div class="stat-icon">💰</div><div><div class="stat-value">${money(summary.stockValue)}</div><div class="stat-label">库存总值(进价)</div></div></div>
      <div class="stat-card red"><div class="stat-icon">⚠️</div><div><div class="stat-value">${summary.lowStock}</div><div class="stat-label">低库存(<10)</div></div></div>
    </div>
    <div class="card">
      <div class="toolbar">
        <input id="iKw" placeholder="搜索商品/规格">
        <select id="iCat"><option value="">全部分类</option></select>
        <label><input type="checkbox" id="iLow"> 仅看低库存</label>
        <button class="btn btn-primary" id="iSearch">查询</button>
      </div>
      <div id="iTable"></div>
    </div>`;
  const cats = (await API.get('/api/categories')).data;
  const sel = document.getElementById('iCat');
  cats.forEach(x => sel.innerHTML += `<option value="${x.id}">${x.name}</option>`);
  async function load() {
    const qs = new URLSearchParams();
    const kw = document.getElementById('iKw').value;
    const cid = document.getElementById('iCat').value;
    const low = document.getElementById('iLow').checked;
    if (kw) qs.set('keyword', kw);
    if (cid) qs.set('category_id', cid);
    if (low) qs.set('low', '1');
    const data = (await API.get('/api/inventory/stock?' + qs.toString())).data;
    const tb = document.getElementById('iTable');
    if (!data.length) { tb.innerHTML = '<div class="empty">暂无数据</div>'; return; }
    tb.innerHTML = `<table><thead><tr><th>ID</th><th>商品</th><th>分类</th><th>规格</th><th>单位</th><th>进价</th><th>售价</th><th>库存</th><th>库存金额</th></tr></thead>
      <tbody>${data.map(p => `<tr><td>${p.id}</td><td>${p.name}</td><td>${p.category_name || '-'}</td>
        <td>${p.spec || '-'}</td><td>${p.unit || '-'}</td><td>${money(p.purchase_price)}</td><td>${money(p.sale_price)}</td>
        <td>${p.stock_quantity === 0 ? '<span class="tag tag-outof">缺货</span>' : p.stock_quantity < 10 ? '<span class="tag tag-low">' + p.stock_quantity + '</span>' : p.stock_quantity}</td>
        <td>${money(p.stock_quantity * p.purchase_price)}</td></tr>`).join('')}</tbody></table>`;
  }
  document.getElementById('iSearch').onclick = load;
  load();
}

// ============ 销售报表 ============
async function renderReport() {
  const c = document.getElementById('content');
  const today = new Date().toISOString().slice(0, 10);
  c.innerHTML = `
    <div class="card">
      <div class="toolbar">
        <label>开始日期 <input type="date" id="rStart"></label>
        <label>结束日期 <input type="date" id="rEnd" value="${today}"></label>
        <button class="btn btn-primary" id="rSearch">统计</button>
      </div>
      <div id="rBody"></div>
    </div>`;
  async function load() {
    const sd = document.getElementById('rStart').value;
    const ed = document.getElementById('rEnd').value;
    const qs = new URLSearchParams();
    if (sd) qs.set('start_date', sd);
    if (ed) qs.set('end_date', ed);
    const data = (await API.get('/api/sales/report/summary?' + qs.toString())).data;
    const s = data.summary;
    const maxQty = Math.max(...data.topProducts.map(p => p.total_qty), 1);
    document.getElementById('rBody').innerHTML = `
      <div class="report-summary">
        <div class="report-box"><div class="num">${s.order_count}</div><div class="lbl">销售订单数</div></div>
        <div class="report-box"><div class="num">${money(s.total_amount)}</div><div class="lbl">销售总额</div></div>
        <div class="report-box"><div class="num">${s.total_qty}</div><div class="lbl">销售总数量</div></div>
      </div>
      <div class="card-title">商品销量排行 TOP10</div>
      <table>
        <thead><tr><th>排名</th><th>商品</th><th>规格</th><th>销量</th><th>销售额</th></tr></thead>
        <tbody>${data.topProducts.map((p, i) => `<tr>
          <td>${i + 1}</td><td>${p.product_name}</td><td>${p.spec || '-'}</td>
          <td><div style="display:flex;align-items:center;gap:8px;">
            <div style="width:120px;background:#f0f0f0;border-radius:3px;height:10px;"><div style="width:${(p.total_qty/maxQty)*100}%;height:100%;background:#1890ff;border-radius:3px;"></div></div>
            ${p.total_qty}</div></td>
          <td>${money(p.total_amount)}</td>
        </tr>`).join('')}</tbody>
      </table>
      <div class="card-title" style="margin-top:20px;">每日销售趋势</div>
      <table>
        <thead><tr><th>日期</th><th>订单数</th><th>销售额</th></tr></thead>
        <tbody>${data.daily.map(d => `<tr><td>${d.order_date}</td><td>${d.order_count}</td><td>${money(d.total_amount)}</td></tr>`).join('') || '<tr><td colspan="3" class="empty">暂无数据</td></tr>'}</tbody>
      </table>
    `;
  }
  document.getElementById('rSearch').onclick = load;
  load();
}

// ============ 出入库日志 ============
async function renderLogs() {
  const c = document.getElementById('content');
  c.innerHTML = `
    <div class="card">
      <div class="toolbar">
        <select id="lType"><option value="">全部类型</option><option value="in">入库</option><option value="out">出库</option></select>
        <input type="date" id="lStart">
        <input type="date" id="lEnd">
        <button class="btn btn-primary" id="lSearch">查询</button>
      </div>
      <div id="lTable"></div>
    </div>`;
  async function load() {
    const qs = new URLSearchParams();
    const t = document.getElementById('lType').value;
    const sd = document.getElementById('lStart').value;
    const ed = document.getElementById('lEnd').value;
    if (t) qs.set('type', t);
    if (sd) qs.set('start_date', sd);
    if (ed) qs.set('end_date', ed);
    const data = (await API.get('/api/inventory/logs?' + qs.toString())).data;
    const tb = document.getElementById('lTable');
    if (!data.length) { tb.innerHTML = '<div class="empty">暂无数据</div>'; return; }
    tb.innerHTML = `<table><thead><tr><th>时间</th><th>商品</th><th>类型</th><th>数量</th><th>关联单据</th><th>操作人</th></tr></thead>
      <tbody>${data.map(l => `<tr>
        <td>${l.created_at}</td><td>${l.product_name}</td>
        <td>${l.type === 'in' ? '<span class="tag tag-in">入库</span>' : '<span class="tag tag-out">出库</span>'}</td>
        <td>${l.type === 'in' ? '+' : '-'}${l.quantity}</td>
        <td>${l.reference_type === 'purchase' ? '采购' : '销售'}单 #${l.reference_id}</td>
        <td>${l.operator_name || '-'}</td>
      </tr>`).join('')}</tbody></table>`;
  }
  document.getElementById('lSearch').onclick = load;
  load();
}

// 启动
init();
