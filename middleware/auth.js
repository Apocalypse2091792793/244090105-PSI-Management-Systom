// middleware/auth.js — 登录认证 & 角色授权中间件
function requireAuth(req, res, next) {
  if (!req.session || !req.session.user) {
    return res.status(401).json({ error: '未登录，请先登录' });
  }
  next();
}

function requireRoles(...roles) {
  return (req, res, next) => {
    if (!req.session || !req.session.user) {
      return res.status(401).json({ error: '未登录，请先登录' });
    }
    if (!roles.includes(req.session.user.role)) {
      return res.status(403).json({ error: '权限不足，无法执行该操作' });
    }
    next();
  };
}

module.exports = { requireAuth, requireRoles };
