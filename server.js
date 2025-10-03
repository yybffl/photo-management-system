/**
 * 文件名: server.js
 * 创建时间: 2025年10月2日
 * 文件内容: 用户管理系统后端服务器，提供完整的API接口和业务逻辑
 * 
 * 主要功能:
 * 1. 用户认证 - 登录、注册、JWT令牌验证
 * 2. 权限管理 - 基于角色的访问控制（RBAC）
 * 3. 文件管理 - 上传、下载、状态管理、权限控制
 * 4. 操作日志 - 记录和查询用户操作历史
 * 5. 商家功能 - 客户管理、照片处理、批量下载
 * 
 * 技术栈:
 * - Express.js - Web框架
 * - SQLite3 - 数据库
 * - JWT - 身份验证
 * - Multer - 文件上传
 * - Archiver - 文件压缩
 * 
 * 修改记录:
 * - 2025/10/02: 初始创建，实现基础认证和用户管理功能
 * - 2025/10/02: 添加文件上传功能，支持多种文件类型
 * - 2025/10/02: 实现角色权限控制和操作日志记录
 * - 2025/10/02: 添加商家端客户管理和照片管理API
 * - 2025/10/02: 实现文件下载和批量下载功能
 * - 2025/10/02: 为API添加筛选功能，支持按状态和时间筛选
 * - 2025/10/02: 修复商家端照片列表API的SQL参数匹配问题
 * - 2025/10/02: 实现批量选中下载API，支持单文件和多文件ZIP下载
 * - 2025/10/02: 修复数据库下载类型约束错误，统一使用'batch'类型
 * - 2025/10/02: 修复中文文件名乱码问题，实现正确的编码转换处理
 * - 2025/10/02: 优化文件名生成逻辑，确保所有环节正确处理中文字符
 * - 2025/10/03: 添加修改密码API接口，支持旧密码验证
 * - 2025/10/03: 优化操作记录API，支持分页和中文翻译
 * - 2025/10/03: 完善操作记录详情的中文显示，优化格式和翻译
 */

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const path = require('path');
const multer = require('multer');
const fs = require('fs-extra');
const archiver = require('archiver');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// 中间件配置
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      fontSrc: ["'self'", "https://cdnjs.cloudflare.com"],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      connectSrc: ["'self'"]
    }
  }
}));
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// 开发调试阶段不做速率限制，发布时再启用
// const limiter = rateLimit({
//   windowMs: 15 * 60 * 1000, // 15分钟
//   max: 100, // 限制每个IP最多100次请求
//   message: { error: '请求过于频繁，请稍后再试' }
// });
// app.use(limiter);

// const loginLimiter = rateLimit({
//   windowMs: 15 * 60 * 1000, // 15分钟
//   max: 5, // 限制每个IP最多5次登录尝试
//   message: { error: '登录尝试次数过多，请15分钟后再试' }
// });

// 确保上传目录存在（Vercel环境跳过）
const uploadDir = './uploads';

// 在Vercel环境中跳过目录创建
if (process.env.VERCEL !== '1') {
  try {
    fs.ensureDirSync(uploadDir);
    console.log(`上传目录已准备: ${path.resolve(uploadDir)}`);
    
    // 检查目录权限
    fs.accessSync(uploadDir, fs.constants.W_OK);
    console.log('上传目录写入权限正常');
  } catch (error) {
    console.error('上传目录准备失败:', error);
    process.exit(1);
  }
} else {
  console.log('Vercel环境，跳过上传目录创建');
}

// 配置multer文件上传（Vercel环境使用内存存储）
const storage = process.env.VERCEL === '1' 
  ? multer.memoryStorage()
  : multer.diskStorage({
      destination: function (req, file, cb) {
        cb(null, uploadDir);
      },
  filename: function (req, file, cb) {
    try {
      // 生成唯一文件名：时间戳_随机数_原文件名
      const timestamp = Date.now();
      const random = Math.round(Math.random() * 1E9);
      
      // 确保原文件名使用正确的编码
      let originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
      
      const ext = path.extname(originalName);
      let name = path.basename(originalName, ext);
      
      // 处理文件名中的特殊字符，避免文件系统问题
      name = name.replace(/[<>:"/\\|?*]/g, '_'); // 替换Windows不允许的字符
      name = name.replace(/\s+/g, '_'); // 替换空格
      
      const filename = `${timestamp}_${random}_${name}${ext}`;
      console.log(`生成文件名: ${originalName} -> ${filename}`);
      cb(null, filename);
    } catch (error) {
      console.error('文件名生成错误:', error);
      cb(error);
    }
  }
});

// 文件过滤器
const fileFilter = (req, file, cb) => {
  // 允许的图片类型
  const imageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  // 允许的压缩包类型
  const archiveTypes = [
    'application/zip', 
    'application/x-zip-compressed', 
    'application/x-rar-compressed', 
    'application/vnd.rar',
    'application/x-rar',
    'application/x-7z-compressed'
  ];
  
  // 允许的文件扩展名
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
  const archiveExtensions = ['.zip', '.rar', '.7z'];
  
  const allowedTypes = [...imageTypes, ...archiveTypes];
  const allowedExtensions = [...imageExtensions, ...archiveExtensions];
  
  // 获取文件扩展名，确保正确编码
  const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
  const ext = path.extname(originalName).toLowerCase();
  
  // 检查MIME类型或文件扩展名
  if (allowedTypes.includes(file.mimetype) || allowedExtensions.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('不支持的文件类型。只允许上传图片（jpg, png, gif, webp）和压缩包（zip, rar, 7z）'), false);
  }
};

// 配置上传限制
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB
    files: 20 // 最多20个文件
  }
});

// 数据库连接
const db = new sqlite3.Database('./database.db', (err) => {
  if (err) {
    console.error('数据库连接失败:', err.message);
  } else {
    console.log('数据库连接成功');
  }
});

// JWT验证中间件
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: '访问令牌缺失' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: '令牌无效' });
    }
    req.user = user;
    next();
  });
};

// 文件访问服务 - 需要身份验证
app.get('/uploads/:filename', authenticateToken, (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(__dirname, 'uploads', filename);
  
  // 检查文件是否存在
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: '文件不存在' });
  }
  
  // 验证用户是否有权限访问此文件
  // 客户可以访问自己上传的文件，商家可以访问客户上传给他们的文件
  let query, params;
  
  if (req.user.role === 'customer') {
    // 客户只能访问自己上传的文件
    query = 'SELECT * FROM file_uploads WHERE file_name = ? AND user_id = ?';
    params = [filename, req.user.id];
  } else if (req.user.role === 'merchant') {
    // 商家可以访问客户上传给他们的文件
    query = 'SELECT * FROM file_uploads WHERE file_name = ? AND merchant_id = ?';
    params = [filename, req.user.id];
  } else {
    // 管理员可以访问所有文件
    query = 'SELECT * FROM file_uploads WHERE file_name = ?';
    params = [filename];
  }
  
  db.get(query, params, (err, file) => {
    if (err) {
      console.error('查询文件权限错误:', err);
      return res.status(500).json({ error: '服务器错误' });
    }
    
    if (!file) {
      console.log(`文件访问被拒绝: ${filename}, 用户: ${req.user.id} (${req.user.role})`);
      return res.status(403).json({ error: '无权限访问此文件' });
    }
    
    // 设置适当的Content-Type
    const ext = path.extname(filename).toLowerCase();
    const mimeTypes = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg', 
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.zip': 'application/zip',
      '.rar': 'application/x-rar-compressed',
      '.7z': 'application/x-7z-compressed'
    };
    
    const contentType = mimeTypes[ext] || 'application/octet-stream';
    res.setHeader('Content-Type', contentType);
    
    // 发送文件
    res.sendFile(filePath);
  });
});

// 管理员权限验证中间件
const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin' && req.user.role !== 'sub_admin') {
    return res.status(403).json({ error: '需要管理员权限' });
  }
  next();
};

// 记录操作日志
const logOperation = (userId, operation, details = '') => {
  const timestamp = new Date().toISOString();
  db.run(
    'INSERT INTO operation_logs (user_id, operation, details, timestamp) VALUES (?, ?, ?, ?)',
    [userId, operation, details, timestamp]
  );
};

// 修改密码API
app.post('/api/change-password', [
    body('username').trim().isLength({ min: 3, max: 20 }).withMessage('用户名长度必须在3-20个字符之间'),
    body('oldPassword').notEmpty().withMessage('旧密码不能为空'),
    body('newPassword').isLength({ min: 6 }).withMessage('新密码至少需要6个字符')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                error: errors.array()[0].msg
            });
        }

        const { username, oldPassword, newPassword } = req.body;

        // 查找用户
        const user = await new Promise((resolve, reject) => {
            db.get('SELECT * FROM users WHERE username = ?', [username], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        if (!user) {
            await logOperation(null, 'change_password_failed', `修改密码失败: 用户名 ${username} 不存在`);
            return res.status(401).json({ error: '用户名或旧密码错误' });
        }

        // 验证旧密码
        const validOldPassword = await bcrypt.compare(oldPassword, user.password);
        if (!validOldPassword) {
            await logOperation(user.id, 'change_password_failed', `修改密码失败: 用户 ${username}(ID:${user.id}) 旧密码错误`);
            return res.status(401).json({ error: '用户名或旧密码错误' });
        }

        // 检查新密码是否与旧密码相同
        const samePassword = await bcrypt.compare(newPassword, user.password);
        if (samePassword) {
            return res.status(400).json({ error: '新密码不能与旧密码相同' });
        }

        // 加密新密码
        const hashedNewPassword = await bcrypt.hash(newPassword, 10);

        // 更新密码
        await new Promise((resolve, reject) => {
            db.run('UPDATE users SET password = ? WHERE id = ?', [hashedNewPassword, user.id], function(err) {
                if (err) reject(err);
                else resolve();
            });
        });

        await logOperation(user.id, 'change_password_success', `用户 ${username}(ID:${user.id}) 成功修改密码`);
        
        res.json({ 
            success: true,
            message: '密码修改成功' 
        });
    } catch (error) {
        console.error('修改密码错误:', error);
        res.status(500).json({ error: '服务器错误' });
    }
});

// 管理员重置用户密码接口
app.post('/api/admin/reset-password', authenticateToken, [
    body('userId').isInt({ min: 1 }).withMessage('用户ID必须是正整数'),
    body('newPassword').isLength({ min: 6 }).withMessage('新密码至少需要6个字符')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                error: errors.array()[0].msg
            });
        }

        // 检查权限：只有管理员可以重置密码
        if (req.user.role !== 'admin' && req.user.role !== 'sub_admin') {
            return res.status(403).json({ error: '权限不足' });
        }

        const { userId, newPassword } = req.body;

        // 查找用户
        const user = await new Promise((resolve, reject) => {
            db.get('SELECT * FROM users WHERE id = ?', [userId], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        if (!user) {
            return res.status(404).json({ error: '用户不存在' });
        }

        // 子管理员不能重置主管理员和其他子管理员的密码
        if (req.user.role === 'sub_admin') {
            if (user.role === 'admin' || (user.role === 'sub_admin' && user.id !== req.user.id)) {
                return res.status(403).json({ error: '权限不足，无法重置该用户密码' });
            }
        }

        // 加密新密码
        const hashedNewPassword = await bcrypt.hash(newPassword, 10);

        // 更新密码
        await new Promise((resolve, reject) => {
            db.run('UPDATE users SET password = ? WHERE id = ?', [hashedNewPassword, userId], function(err) {
                if (err) reject(err);
                else resolve();
            });
        });

        // 记录操作日志
        await logOperation(req.user.id, 'reset_password', `管理员重置用户密码: ${user.username} (ID: ${userId})`);

        res.json({ 
            success: true,
            message: '密码重置成功' 
        });
    } catch (error) {
        console.error('重置密码错误:', error);
        res.status(500).json({ error: '服务器错误' });
    }
});

// 用户注册（仅限客户）
app.post('/api/register', [
  body('username').isLength({ min: 3, max: 20 }).withMessage('用户名长度必须在3-20个字符之间'),
  body('password').isLength({ min: 6 }).withMessage('密码长度至少6个字符')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { username, password } = req.body;
  const role = 'customer'; // 注册时只能创建客户账户

  try {
    // 检查用户名是否已存在
    db.get('SELECT id FROM users WHERE username = ?', [username], async (err, row) => {
      if (err) {
        return res.status(500).json({ error: '数据库错误' });
      }
      
      if (row) {
        return res.status(400).json({ error: '用户名已存在' });
      }

      // 加密密码
      const hashedPassword = await bcrypt.hash(password, 10);
      const createdAt = new Date().toISOString();

      // 创建用户
      db.run(
        'INSERT INTO users (username, password, role, status, created_at) VALUES (?, ?, ?, ?, ?)',
        [username, hashedPassword, role, 'active', createdAt],
        function(err) {
          if (err) {
            return res.status(500).json({ error: '用户创建失败' });
          }

          logOperation(this.lastID, '客户注册', `新客户注册: ${username} (ID: ${this.lastID})`);
          
          res.status(201).json({
            message: '注册成功',
            user: {
              id: this.lastID,
              username,
              role,
              status: 'active'
            }
          });
        }
      );
    });
  } catch (error) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// 用户登录
app.post('/api/login', [
  body('username').notEmpty().withMessage('用户名不能为空'),
  body('password').notEmpty().withMessage('密码不能为空')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { username, password } = req.body;

  try {
    db.get('SELECT * FROM users WHERE username = ?', [username], async (err, user) => {
      if (err) {
        return res.status(500).json({ error: '数据库错误' });
      }

      if (!user) {
        return res.status(401).json({ error: '用户名或密码错误' });
      }

      if (user.status === 'disabled') {
        return res.status(401).json({ 
          error: '账户已被禁用', 
          reason: user.disable_reason 
        });
      }

      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        logOperation(user.id, '登录失败', `用户: ${username} (ID: ${user.id}) 密码错误`);
        return res.status(401).json({ error: '用户名或密码错误' });
      }

      // 更新最后登录时间
      const lastLogin = new Date().toISOString();
      db.run('UPDATE users SET last_login = ? WHERE id = ?', [lastLogin, user.id]);

      // 生成JWT令牌
      const token = jwt.sign(
        { 
          id: user.id, 
          username: user.username, 
          role: user.role 
        },
        JWT_SECRET,
        { expiresIn: '24h' }
      );

      logOperation(user.id, '登录成功', `用户: ${username} (ID: ${user.id}) 登录成功`);

      res.json({
        message: '登录成功',
        token,
        user: {
          id: user.id,
          username: user.username,
          role: user.role,
          status: user.status,
          lastLogin
        }
      });
    });
  } catch (error) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// 获取用户信息
app.get('/api/profile', authenticateToken, (req, res) => {
  db.get('SELECT id, username, role, status, created_at, last_login FROM users WHERE id = ?', 
    [req.user.id], (err, user) => {
    if (err) {
      return res.status(500).json({ error: '数据库错误' });
    }
    
    if (!user) {
      return res.status(404).json({ error: '用户不存在' });
    }

    res.json({ user });
  });
});

// 管理员功能：获取用户列表（基于角色权限，支持搜索、排序和分页）
app.get('/api/admin/users', authenticateToken, requireAdmin, (req, res) => {
  const currentUserRole = req.user.role;
  const currentUserId = req.user.id;
  const { search, page = 1, limit = 20 } = req.query;
  
  // 解析分页参数
  const pageNum = parseInt(page) || 1;
  const limitNum = parseInt(limit) || 20;
  const offset = (pageNum - 1) * limitNum;
  
  // 构建基础查询条件
  let whereConditions = [];
  let queryParams = [];
  
  // 权限过滤：子管理员只能查看自己、商家和客户
  if (currentUserRole === 'sub_admin') {
    whereConditions.push(`(role IN ('merchant', 'customer') OR (role = 'sub_admin' AND id = ?))`);
    queryParams.push(currentUserId);
  }
  
  // 搜索过滤
  if (search && search.trim()) {
    whereConditions.push('username LIKE ?');
    queryParams.push(`%${search.trim()}%`);
  }
  
  // 构建WHERE子句
  const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
  
  // 构建排序规则 - 根据用户角色排序
  let orderClause;
  if (currentUserRole === 'admin') {
    // 主管理员：主管理员(自己) → 子管理员 → 商家 → 客户
    orderClause = `ORDER BY 
      CASE 
        WHEN id = ${currentUserId} THEN 1
        WHEN role = 'admin' THEN 2
        WHEN role = 'sub_admin' THEN 3
        WHEN role = 'merchant' THEN 4
        WHEN role = 'customer' THEN 5
        ELSE 6
      END, created_at DESC`;
  } else {
    // 子管理员：自己 → 商家 → 客户
    orderClause = `ORDER BY 
      CASE 
        WHEN id = ${currentUserId} THEN 1
        WHEN role = 'merchant' THEN 2
        WHEN role = 'customer' THEN 3
        ELSE 4
      END, created_at DESC`;
  }
  
  // 查询总数
  const countQuery = `SELECT COUNT(*) as total FROM users ${whereClause}`;
  
  db.get(countQuery, queryParams, (err, countResult) => {
    if (err) {
      console.error('用户计数查询错误:', err);
      return res.status(500).json({ error: '数据库错误' });
    }
    
    const total = countResult.total;
    const totalPages = Math.ceil(total / limitNum);
    
    // 查询用户列表
    const listQuery = `
      SELECT id, username, role, status, created_at, last_login, disable_reason 
      FROM users 
      ${whereClause} 
      ${orderClause} 
      LIMIT ? OFFSET ?
    `;
    
    const listParams = [...queryParams, limitNum, offset];
    
    db.all(listQuery, listParams, (err, users) => {
      if (err) {
        console.error('用户列表查询错误:', err);
        return res.status(500).json({ error: '数据库错误' });
      }
      
      res.json({
        users,
        pagination: {
          currentPage: pageNum,
          totalPages,
          totalUsers: total,
          pageSize: limitNum,
          hasNextPage: pageNum < totalPages,
          hasPrevPage: pageNum > 1
        }
      });
    });
  });
});

// 管理员功能：创建用户
app.post('/api/admin/users', authenticateToken, requireAdmin, [
  body('username').isLength({ min: 3, max: 20 }).withMessage('用户名长度必须在3-20个字符之间'),
  body('password').isLength({ min: 6 }).withMessage('密码长度至少6个字符'),
  body('role').isIn(['customer', 'merchant', 'sub_admin']).withMessage('无效的角色')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  // 权限检查：只有主管理员可以创建子管理员
  if (req.body.role === 'sub_admin' && req.user.role !== 'admin') {
    return res.status(403).json({ error: '只有主管理员可以创建子管理员账户' });
  }
  
  // 权限检查：子管理员不能创建任何管理员账户
  if (req.user.role === 'sub_admin' && (req.body.role === 'admin' || req.body.role === 'sub_admin')) {
    return res.status(403).json({ error: '子管理员不能创建管理员账户' });
  }

  const { username, password, role } = req.body;

  try {
    // 检查用户名是否已存在
    db.get('SELECT id FROM users WHERE username = ?', [username], async (err, row) => {
      if (err) {
        return res.status(500).json({ error: '数据库错误' });
      }
      
      if (row) {
        return res.status(400).json({ error: '用户名已存在' });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const createdAt = new Date().toISOString();

      db.run(
        'INSERT INTO users (username, password, role, status, created_at) VALUES (?, ?, ?, ?, ?)',
        [username, hashedPassword, role, 'active', createdAt],
        function(err) {
          if (err) {
            return res.status(500).json({ error: '用户创建失败' });
          }

          logOperation(req.user.id, '创建用户', `管理员创建用户: ${username} (ID: ${this.lastID}), 角色: ${role}`);
          
          res.status(201).json({
            message: '用户创建成功',
            user: {
              id: this.lastID,
              username,
              role,
              status: 'active'
            }
          });
        }
      );
    });
  } catch (error) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// 管理员功能：禁用/启用用户
app.patch('/api/admin/users/:id/status', authenticateToken, requireAdmin, [
  body('status').isIn(['active', 'disabled']).withMessage('状态必须是active或disabled'),
  body('reason').optional().isLength({ min: 1 }).withMessage('禁用理由不能为空')
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { id } = req.params;
  const { status, reason } = req.body;

  if (status === 'disabled' && !reason) {
    return res.status(400).json({ error: '禁用用户时必须提供禁用理由' });
  }

  // 防止禁用主管理员
  if (id === '1') {
    return res.status(403).json({ error: '不能禁用主管理员账户' });
  }

  const updateQuery = status === 'disabled' 
    ? 'UPDATE users SET status = ?, disable_reason = ? WHERE id = ?'
    : 'UPDATE users SET status = ?, disable_reason = NULL WHERE id = ?';
  
  const params = status === 'disabled' ? [status, reason, id] : [status, id];

  // 先获取用户信息用于日志记录
  db.get('SELECT username FROM users WHERE id = ?', [id], (err, user) => {
    if (err) {
      return res.status(500).json({ error: '数据库错误' });
    }

    if (!user) {
      return res.status(404).json({ error: '用户不存在' });
    }

    // 执行状态更新
    db.run(updateQuery, params, function(err) {
      if (err) {
        return res.status(500).json({ error: '数据库错误' });
      }

      if (this.changes === 0) {
        return res.status(404).json({ error: '用户不存在' });
      }

      const action = status === 'disabled' ? '禁用' : '启用';
      const details = status === 'disabled' 
        ? `${action}用户: ${user.username} (ID: ${id}), 理由: ${reason}` 
        : `${action}用户: ${user.username} (ID: ${id})`;
      
      logOperation(req.user.id, `${action}用户`, details);

      res.json({ message: `用户${action}成功` });
    });
  });
});

// 管理员功能：获取操作记录（基于角色权限）
app.get('/api/admin/logs/:userId?', authenticateToken, requireAdmin, (req, res) => {
  const { userId } = req.params;
  const page = parseInt(req.query.page) || 1;
  const limitNum = Math.min(parseInt(req.query.limit) || 10, 100); // 每页最多100条
  const offset = (page - 1) * limitNum;
  const currentUserRole = req.user.role;
  
  console.log(`操作记录查询 - 用户角色: ${currentUserRole}, 目标用户ID: ${userId || '全部'}`);

  let query = 'SELECT ol.*, u.username, u.role as user_role FROM operation_logs ol LEFT JOIN users u ON ol.user_id = u.id';
  let params = [];
  let whereConditions = [];

  // 根据当前用户角色设置访问权限
  if (currentUserRole === 'sub_admin') {
    // 子管理员可以查看自己、商家和客户的操作记录
    whereConditions.push(`(u.role = 'merchant' OR u.role = 'customer' OR u.role IS NULL OR (u.role = 'sub_admin' AND u.id = ${req.user.id}))`);
  }
  // 主管理员可以查看所有记录，不需要额外条件

  // 如果指定了特定用户ID
  if (userId) {
    // 子管理员需要验证是否有权限查看该用户
    if (currentUserRole === 'sub_admin') {
      // 先检查目标用户的角色
      db.get('SELECT role FROM users WHERE id = ?', [userId], (err, targetUser) => {
        if (err) {
          return res.status(500).json({ error: '数据库错误' });
        }
        
        if (!targetUser) {
          return res.status(404).json({ error: '用户不存在' });
        }
        
        // 子管理员不能查看主管理员的记录，也不能查看其他子管理员的记录
        if (targetUser.role === 'admin' || (targetUser.role === 'sub_admin' && userId != req.user.id)) {
          return res.status(403).json({ error: '没有权限查看该用户的操作记录' });
        }
        
        // 添加用户ID条件并执行查询
        whereConditions.push('ol.user_id = ?');
        params.push(userId);
        executeLogQuery();
      });
      return;
    } else {
      whereConditions.push('ol.user_id = ?');
      params.push(userId);
    }
  }

  executeLogQuery();

  function executeLogQuery() {
    // 构建WHERE条件
    const whereClause = whereConditions.length > 0 ? ' WHERE ' + whereConditions.join(' AND ') : '';
    
    // 构建计数查询
    const countQuery = `SELECT COUNT(*) as total FROM operation_logs ol LEFT JOIN users u ON ol.user_id = u.id${whereClause}`;
    const countParams = [...params]; // 复制参数数组
    
    // 执行计数查询
    db.get(countQuery, countParams, (err, countResult) => {
      if (err) {
        console.error('计数查询错误:', err);
        return res.status(500).json({ error: '数据库错误' });
      }
      
      const total = countResult.total;
      const totalPages = Math.ceil(total / limitNum);
      
      // 构建主查询
      const mainQuery = query + whereClause + ' ORDER BY ol.timestamp DESC LIMIT ? OFFSET ?';
      const mainParams = [...params, limitNum, offset];
      
      console.log(`执行查询 - SQL: ${mainQuery}`);
      console.log(`查询参数: ${JSON.stringify(mainParams)}`);
      
      // 执行主查询
      db.all(mainQuery, mainParams, (err, logs) => {
        if (err) {
          console.error('查询错误:', err);
          return res.status(500).json({ error: '数据库错误' });
        }
        
        console.log(`查询结果: 返回${logs.length}条记录，总计${total}条`);
        
        res.json({ 
          logs,
          pagination: {
            currentPage: page,
            totalPages: totalPages,
            totalRecords: total,
            pageSize: limitNum,
            pages: totalPages
          }
        });
      });
    });
  }
});

// 获取商家列表（供客户选择）
app.get('/api/merchants', authenticateToken, (req, res) => {
  db.all("SELECT id, username FROM users WHERE role = 'merchant' AND status = 'active' ORDER BY username", 
    (err, merchants) => {
    if (err) {
      return res.status(500).json({ error: '数据库错误' });
    }
    res.json({ merchants });
  });
});

// 检测重复文件上传
app.post('/api/check-duplicate-files', authenticateToken, (req, res) => {
  if (req.user.role !== 'customer') {
    return res.status(403).json({ error: '只有客户可以检测重复文件' });
  }

  const { merchantId, fileNames } = req.body;

  if (!merchantId || !fileNames || !Array.isArray(fileNames)) {
    return res.status(400).json({ error: '缺少必要参数' });
  }

  // 构建查询条件，检查多个文件名
  const placeholders = fileNames.map(() => '?').join(',');
  const query = `
    SELECT original_name 
    FROM file_uploads 
    WHERE user_id = ? AND merchant_id = ? AND original_name IN (${placeholders})
  `;
  
  const params = [req.user.id, merchantId, ...fileNames];

  db.all(query, params, (err, existingFiles) => {
    if (err) {
      console.error('检测重复文件错误:', err);
      return res.status(500).json({ error: '服务器错误' });
    }

    // 返回已存在的文件名列表
    const duplicateFiles = existingFiles.map(file => file.original_name);
    res.json({ duplicateFiles });
  });
});

// 文件上传错误处理中间件
const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    console.error('Multer错误:', err);
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: '文件大小超过限制（50MB）' });
    } else if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({ error: '文件数量超过限制（20个）' });
    } else if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({ error: '意外的文件字段' });
    } else {
      return res.status(400).json({ error: `文件上传错误: ${err.message}` });
    }
  } else if (err) {
    console.error('其他上传错误:', err);
    return res.status(400).json({ error: err.message || '文件上传失败' });
  }
  next();
};

// 文件上传API
app.post('/api/upload', authenticateToken, upload.array('files', 20), handleMulterError, async (req, res) => {
  try {
    const { merchantId, remarks } = req.body;
    const files = req.files;
    
    console.log(`=== 文件上传请求 ===`);
    console.log(`用户ID: ${req.user.id}, 商家ID: ${merchantId}`);
    console.log(`文件数量: ${files ? files.length : 0}`);
    if (files) {
      files.forEach((file, index) => {
        const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
        console.log(`文件 ${index + 1}: ${originalName}, 大小: ${file.size}, MIME: ${file.mimetype}`);
      });
    }

    // 验证必填字段
    if (!merchantId) {
      return res.status(400).json({ error: '请选择商家' });
    }

    if (!files || files.length === 0) {
      return res.status(400).json({ error: '请选择要上传的文件' });
    }

    // 验证商家是否存在且未被禁用
    const merchant = await new Promise((resolve, reject) => {
      db.get("SELECT id, username, status FROM users WHERE id = ? AND role = 'merchant'", 
        [merchantId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!merchant) {
      return res.status(400).json({ error: '选择的商家不存在' });
    }

    if (merchant.status === 'disabled') {
      return res.status(400).json({ error: '选择的商家已被禁用，无法上传文件' });
    }

    // 验证文件总大小（图片限制50MB，压缩包不限制）
    let totalImageSize = 0;
    let imageCount = 0;
    
    for (const file of files) {
      // 判断是否为图片文件，确保正确编码
      const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
      const ext = path.extname(originalName).toLowerCase();
      const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
      const isImage = file.mimetype.startsWith('image/') || imageExtensions.includes(ext);
      
      if (isImage) {
        totalImageSize += file.size;
        imageCount++;
      }
    }

    if (imageCount > 20) {
      return res.status(400).json({ error: '图片文件数量不能超过20张' });
    }

    if (totalImageSize > 50 * 1024 * 1024) {
      return res.status(400).json({ error: '图片文件总大小不能超过50MB' });
    }

    // 保存文件信息到数据库
    const uploadTime = new Date().toISOString();
    const savedFiles = [];

    for (const file of files) {
      // 判断文件类型 - 既检查MIME类型又检查扩展名，确保正确编码
      const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
      const ext = path.extname(originalName).toLowerCase();
      const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
      const isImage = file.mimetype.startsWith('image/') || imageExtensions.includes(ext);
      const fileType = isImage ? 'image' : 'archive';
      
      await new Promise((resolve, reject) => {
        // 确保原文件名使用正确的编码
        const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
        
        console.log(`保存文件到数据库: ${originalName}, 类型: ${fileType}, MIME: ${file.mimetype}`);
        
        db.run(`
          INSERT INTO file_uploads 
          (user_id, merchant_id, original_name, file_name, file_path, file_size, file_type, mime_type, remarks, upload_time)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          req.user.id,
          merchantId,
          originalName,
          file.filename,
          process.env.VERCEL === '1' ? 'memory' : file.path,
          file.size,
          fileType,
          file.mimetype,
          remarks || null,
          uploadTime
        ], function(err) {
          if (err) {
            console.error(`数据库保存失败 - 文件: ${originalName}, 错误:`, err);
            reject(err);
          } else {
            console.log(`数据库保存成功 - 文件: ${originalName}, ID: ${this.lastID}`);
            savedFiles.push({
              id: this.lastID,
              originalName: originalName,
              fileName: file.filename,
              size: file.size,
              type: fileType
            });
            resolve();
          }
        });
      });
    }

    // 记录操作日志
    logOperation(req.user.id, '文件上传', 
      `上传${files.length}个文件到商家: ${merchant.username} (ID: ${merchantId})`);

    res.json({
      message: '文件上传成功',
      files: savedFiles,
      merchant: merchant.username,
      uploadTime: uploadTime
    });

  } catch (error) {
    console.error('=== 文件上传错误详情 ===');
    console.error('错误类型:', error.constructor.name);
    console.error('错误消息:', error.message);
    console.error('错误堆栈:', error.stack);
    console.error('请求信息 - 用户ID:', req.user?.id, '商家ID:', req.body?.merchantId);
    console.error('文件信息:', req.files?.map(f => ({ name: f.originalname, size: f.size, mime: f.mimetype })));
    console.error('========================');
    
    res.status(500).json({ 
      error: '文件上传失败', 
      details: process.env.NODE_ENV === 'development' ? error.message : undefined 
    });
  }
});

// 获取商家的客户列表
app.get('/api/merchant/customers', authenticateToken, (req, res) => {
  // 只有商家可以访问
  if (req.user.role !== 'merchant') {
    return res.status(403).json({ error: '权限不足' });
  }

  const { page = 1, limit = 10 } = req.query;
  const pageNum = parseInt(page) || 1;
  const limitNum = parseInt(limit) || 10;
  const offset = (pageNum - 1) * limitNum;

  // 查询给该商家上传过文件的客户信息
  const query = `
    SELECT 
      u.id,
      u.username,
      u.status,
      COUNT(fu.id) as file_count,
      MAX(fu.upload_time) as last_upload_time
    FROM users u
    INNER JOIN file_uploads fu ON u.id = fu.user_id
    WHERE fu.merchant_id = ? AND u.role = 'customer'
    GROUP BY u.id, u.username, u.status
    ORDER BY last_upload_time DESC
    LIMIT ? OFFSET ?
  `;

  // 获取总数的查询
  const countQuery = `
    SELECT COUNT(DISTINCT u.id) as total
    FROM users u
    INNER JOIN file_uploads fu ON u.id = fu.user_id
    WHERE fu.merchant_id = ? AND u.role = 'customer'
  `;

  // 先获取总数
  db.get(countQuery, [req.user.id], (err, countResult) => {
    if (err) {
      console.error('查询客户总数错误:', err);
      return res.status(500).json({ error: '服务器错误' });
    }

    // 获取客户列表
    db.all(query, [req.user.id, limitNum, offset], (err, customers) => {
      if (err) {
        console.error('查询客户列表错误:', err);
        return res.status(500).json({ error: '服务器错误' });
      }

      res.json({
        customers: customers,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: countResult.total,
          pages: Math.ceil(countResult.total / limitNum)
        }
      });
    });
  });
});

// 获取指定客户的照片列表（商家端）
app.get('/api/merchant/customer/:customerId/photos', authenticateToken, (req, res) => {
  // 只有商家可以访问
  if (req.user.role !== 'merchant') {
    return res.status(403).json({ error: '权限不足' });
  }

  const customerId = req.params.customerId;
  
  // 首先检查客户状态
  const customerStatusQuery = 'SELECT status FROM users WHERE id = ? AND role = "customer"';
  db.get(customerStatusQuery, [customerId], (err, customer) => {
    if (err) {
      console.error('查询客户状态错误:', err);
      return res.status(500).json({ error: '服务器错误' });
    }
    
    if (!customer) {
      return res.status(404).json({ error: '客户不存在' });
    }
    
    if (customer.status !== 'active') {
      return res.status(403).json({ error: '该客户已被禁用，无法查看照片' });
    }
    
    // 客户状态正常，继续处理照片查询
    const { page = 1, limit = 20, status, timeFilter, startDate, endDate } = req.query;
  const pageNum = parseInt(page) || 1;
  const limitNum = parseInt(limit) || 20;
  const offset = (pageNum - 1) * limitNum;

  // 构建WHERE条件
  let whereConditions = ['fu.user_id = ?', 'fu.merchant_id = ?'];
  let queryParams = [req.user.id, customerId, req.user.id]; // 第一个req.user.id用于LEFT JOIN，后两个用于WHERE
  let countParams = [customerId, req.user.id]; // 对应WHERE条件的参数

  // 状态筛选
  if (status && ['received', 'processing', 'shipped'].includes(status)) {
    whereConditions.push('fu.process_status = ?');
    queryParams.push(status);
    countParams.push(status);
  }

  // 时间筛选
  if (timeFilter) {
    const now = new Date();
    let timeCondition = '';
    
    switch (timeFilter) {
      case 'today':
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        timeCondition = 'fu.upload_time >= ?';
        queryParams.push(today.toISOString());
        countParams.push(today.toISOString());
        break;
      case 'week':
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        timeCondition = 'fu.upload_time >= ?';
        queryParams.push(weekAgo.toISOString());
        countParams.push(weekAgo.toISOString());
        break;
      case 'month':
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        timeCondition = 'fu.upload_time >= ?';
        queryParams.push(monthAgo.toISOString());
        countParams.push(monthAgo.toISOString());
        break;
      case 'custom':
        if (startDate && endDate) {
          timeCondition = 'fu.upload_time >= ? AND fu.upload_time <= ?';
          const start = new Date(startDate + 'T00:00:00.000Z');
          const end = new Date(endDate + 'T23:59:59.999Z');
          queryParams.push(start.toISOString(), end.toISOString());
          countParams.push(start.toISOString(), end.toISOString());
        }
        break;
    }
    
    if (timeCondition) {
      whereConditions.push(timeCondition);
    }
  }

  // 查询该客户给该商家上传的所有文件，包括已删除的
  // 使用子查询获取每个文件的最新下载状态
  const query = `
    SELECT 
      fu.*,
      u.username as customer_name,
      ds.status as download_status,
      ds.download_time as last_download_time
    FROM file_uploads fu
    LEFT JOIN users u ON fu.user_id = u.id
    LEFT JOIN (
      SELECT file_id, status, download_time,
             ROW_NUMBER() OVER (
               PARTITION BY file_id 
               ORDER BY 
                 CASE WHEN status = 'success' THEN 0 ELSE 1 END,
                 download_time DESC
             ) as rn
      FROM download_status 
      WHERE merchant_id = ?
    ) ds ON fu.id = ds.file_id AND ds.rn = 1
    WHERE ${whereConditions.join(' AND ')}
    ORDER BY 
      CASE WHEN fu.status = 'active' THEN 0 ELSE 1 END,
      fu.upload_time DESC
    LIMIT ? OFFSET ?
  `;

  // 添加分页参数
  queryParams.push(limitNum, offset);

  // 获取总数的查询
  const countQuery = `
    SELECT COUNT(*) as total
    FROM file_uploads fu
    WHERE ${whereConditions.join(' AND ')}
  `;

  // 先获取总数
  db.get(countQuery, countParams, (err, countResult) => {
    if (err) {
      console.error('查询照片总数错误:', err);
      return res.status(500).json({ error: '服务器错误' });
    }

    // 获取照片列表
    db.all(query, queryParams, (err, photos) => {
      if (err) {
        console.error('查询照片列表错误:', err);
        return res.status(500).json({ error: '服务器错误' });
      }

      res.json({
        photos: photos,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: countResult.total,
          pages: Math.ceil(countResult.total / limitNum)
        }
      });
    });
  });
  }); // 结束客户状态检查回调
});

// 更新照片处理状态（商家端）
app.put('/api/merchant/photo/:photoId/status', authenticateToken, (req, res) => {
  // 只有商家可以访问
  if (req.user.role !== 'merchant') {
    return res.status(403).json({ error: '权限不足' });
  }

  const photoId = req.params.photoId;
  const { process_status } = req.body;

  // 验证状态值
  const validStatuses = ['received', 'processing', 'shipped'];
  if (!validStatuses.includes(process_status)) {
    return res.status(400).json({ error: '无效的状态值' });
  }

  // 检查照片是否属于该商家且未被删除
  db.get('SELECT * FROM file_uploads WHERE id = ? AND merchant_id = ? AND status = "active"', 
    [photoId, req.user.id], (err, photo) => {
    if (err) {
      console.error('查询照片错误:', err);
      return res.status(500).json({ error: '服务器错误' });
    }

    if (!photo) {
      return res.status(404).json({ error: '照片不存在或无权限访问' });
    }

    // 更新状态
    db.run('UPDATE file_uploads SET process_status = ? WHERE id = ?', 
      [process_status, photoId], function(err) {
      if (err) {
        console.error('更新照片状态错误:', err);
        return res.status(500).json({ error: '服务器错误' });
      }

      // 记录操作日志
      logOperation(req.user.id, 'update_photo_status', `更新照片状态: ${photo.original_name} -> ${process_status}`);

      res.json({ message: '状态更新成功' });
    });
  });
});

// 单张照片下载（商家端）
app.get('/api/merchant/photo/:photoId/download', (req, res) => {
  // 从URL参数或Authorization头获取token
  const token = req.query.token || (req.headers.authorization && req.headers.authorization.split(' ')[1]);
  
  if (!token) {
    return res.status(401).json({ error: '未提供认证令牌' });
  }

  // 验证token
  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).json({ error: '无效的令牌' });
    }

    // 只有商家可以访问
    if (decoded.role !== 'merchant') {
      return res.status(403).json({ error: '权限不足' });
    }

    req.user = decoded;

    const photoId = req.params.photoId;

    // 检查照片是否属于该商家且未被删除
    db.get('SELECT * FROM file_uploads WHERE id = ? AND merchant_id = ? AND status = "active"', 
      [photoId, req.user.id], (err, photo) => {
    if (err) {
      console.error('查询照片错误:', err);
      return res.status(500).json({ error: '服务器错误' });
    }

    if (!photo) {
      return res.status(404).json({ error: '照片不存在或无权限访问' });
    }

    const filePath = path.join(__dirname, 'uploads', photo.file_name);
    
    // 检查文件是否存在
    if (!fs.existsSync(filePath)) {
      // 记录下载失败状态
      recordDownloadStatus(photo.id, req.user.id, 'single', 'failed', null, '文件不存在');
      return res.status(404).json({ error: '文件不存在' });
    }

    try {
      // 设置下载头
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(photo.original_name)}"`);
      res.setHeader('Content-Type', photo.mime_type || 'application/octet-stream');
      
      // 发送文件
      res.sendFile(filePath, (err) => {
        if (err) {
          console.error('文件下载错误:', err);
          recordDownloadStatus(photo.id, req.user.id, 'single', 'failed', null, err.message);
        } else {
          // 记录下载成功状态
          recordDownloadStatus(photo.id, req.user.id, 'single', 'success', filePath);
          // 记录操作日志
          logOperation(req.user.id, 'download_photo', `下载照片: ${photo.original_name}`);
        }
      });
    } catch (error) {
      console.error('下载处理错误:', error);
      recordDownloadStatus(photo.id, req.user.id, 'single', 'failed', null, error.message);
      res.status(500).json({ error: '下载失败' });
    }
    });
  });
});

// 批量下载客户照片（商家端）
app.get('/api/merchant/customer/:customerId/download-all', (req, res) => {
  // 从URL参数或Authorization头获取token
  const token = req.query.token || (req.headers.authorization && req.headers.authorization.split(' ')[1]);
  
  if (!token) {
    return res.status(401).json({ error: '未提供认证令牌' });
  }

  // 验证token
  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).json({ error: '无效的令牌' });
    }

    // 只有商家可以访问
    if (decoded.role !== 'merchant') {
      return res.status(403).json({ error: '权限不足' });
    }

    req.user = decoded;

  const customerId = req.params.customerId;

  // 获取该客户的所有未删除照片
  db.all('SELECT * FROM file_uploads WHERE user_id = ? AND merchant_id = ? AND status = "active"', 
    [customerId, req.user.id], (err, photos) => {
    if (err) {
      console.error('查询照片错误:', err);
      return res.status(500).json({ error: '服务器错误' });
    }

    if (photos.length === 0) {
      return res.status(404).json({ error: '没有可下载的照片' });
    }

    // 获取客户名称
    db.get('SELECT username FROM users WHERE id = ?', [customerId], (err, customer) => {
      if (err) {
        console.error('查询客户错误:', err);
        return res.status(500).json({ error: '服务器错误' });
      }

      const customerName = customer ? customer.username : `customer_${customerId}`;
      const zipFileName = `${customerName}_photos_${Date.now()}.zip`;

      // 设置响应头
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(zipFileName)}"`);

      // 创建zip压缩流
      const archive = archiver('zip', {
        zlib: { level: 9 } // 压缩级别
      });

      // 处理压缩错误
      archive.on('error', (err) => {
        console.error('压缩错误:', err);
        // 为所有照片记录下载失败状态
        photos.forEach(photo => {
          recordDownloadStatus(photo.id, req.user.id, 'batch', 'failed', null, err.message);
        });
        if (!res.headersSent) {
          res.status(500).json({ error: '压缩失败' });
        }
      });

      // 压缩完成
      archive.on('end', () => {
        console.log(`批量下载完成: ${archive.pointer()} bytes`);
        // 为所有照片记录下载成功状态
        photos.forEach(photo => {
          recordDownloadStatus(photo.id, req.user.id, 'batch', 'success', zipFileName);
        });
        // 记录操作日志
        logOperation(req.user.id, 'batch_download', `批量下载客户照片: ${customerName} (${photos.length}张)`);
      });

      // 将压缩流连接到响应
      archive.pipe(res);

      // 添加文件到压缩包
      let addedCount = 0;
      photos.forEach((photo, index) => {
        const filePath = path.join(__dirname, 'uploads', photo.file_name);
        
        if (fs.existsSync(filePath)) {
          archive.file(filePath, { name: photo.original_name });
          addedCount++;
        } else {
          console.warn(`文件不存在，跳过: ${photo.original_name}`);
          recordDownloadStatus(photo.id, req.user.id, 'batch', 'failed', null, '文件不存在');
        }

        // 如果是最后一个文件，完成压缩
        if (index === photos.length - 1) {
          if (addedCount === 0) {
            archive.destroy();
            if (!res.headersSent) {
              res.status(404).json({ error: '没有可用的文件' });
            }
          } else {
            archive.finalize();
          }
        }
      });
    });
  });
  });
});

// 批量下载选中照片（商家端）
app.get('/api/merchant/customer/:customerId/download-selected', (req, res) => {
  console.log('=== 批量下载选中照片请求 ===');
  console.log('请求路径:', req.path);
  console.log('请求参数:', req.query);
  console.log('客户ID:', req.params.customerId);
  
  // 从URL参数或Authorization头获取token
  const token = req.query.token || (req.headers.authorization && req.headers.authorization.split(' ')[1]);
  
  if (!token) {
    return res.status(401).json({ error: '未提供认证令牌' });
  }

  // 验证token
  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).json({ error: '无效的令牌' });
    }

    // 只有商家可以访问
    if (decoded.role !== 'merchant') {
      return res.status(403).json({ error: '权限不足' });
    }

    req.user = decoded;

    const customerId = req.params.customerId;
    const photoIds = req.query.photoIds;

    console.log('接收到的photoIds参数:', photoIds, typeof photoIds);

    if (!photoIds) {
      return res.status(400).json({ error: '请提供要下载的照片ID' });
    }

    // 处理photoIds参数（可能是数组、字符串或逗号分隔的字符串）
    let photoIdArray = [];
    if (Array.isArray(photoIds)) {
      photoIdArray = photoIds;
    } else if (typeof photoIds === 'string') {
      // 如果是逗号分隔的字符串，分割成数组
      photoIdArray = photoIds.includes(',') ? photoIds.split(',') : [photoIds];
    } else {
      return res.status(400).json({ error: '无效的照片ID格式' });
    }
    
    // 转换为数字并过滤无效值
    photoIdArray = photoIdArray.map(id => parseInt(id.toString().trim())).filter(id => !isNaN(id));
    
    console.log('处理后的photoIdArray:', photoIdArray);
    
    if (photoIdArray.length === 0) {
      return res.status(400).json({ error: '请选择要下载的照片' });
    }

    // 构建查询的占位符
    const placeholders = photoIdArray.map(() => '?').join(',');
    const queryParams = [...photoIdArray, customerId, req.user.id];

    // 获取选中的照片
    db.all(`SELECT * FROM file_uploads 
            WHERE id IN (${placeholders}) 
            AND user_id = ? 
            AND merchant_id = ? 
            AND status = "active"`, 
      queryParams, (err, photos) => {
      if (err) {
        console.error('查询照片错误:', err);
        return res.status(500).json({ error: '服务器错误' });
      }

      if (photos.length === 0) {
        return res.status(404).json({ error: '没有可下载的照片' });
      }

      // 获取客户名称
      db.get('SELECT username FROM users WHERE id = ?', [customerId], (err, customer) => {
        if (err) {
          console.error('查询客户错误:', err);
          return res.status(500).json({ error: '服务器错误' });
        }

        const customerName = customer ? customer.username : `customer_${customerId}`;
        
        // 如果只有一张照片，直接下载
        if (photos.length === 1) {
          const photo = photos[0];
          const filePath = path.join(__dirname, 'uploads', photo.file_name);
          
          if (!fs.existsSync(filePath)) {
            recordDownloadStatus(photo.id, req.user.id, 'single', 'failed', null, '文件不存在');
            return res.status(404).json({ error: '文件不存在' });
          }

          // 记录下载成功状态
          recordDownloadStatus(photo.id, req.user.id, 'single', 'success', photo.original_name);
          
          // 记录操作日志
          logOperation(req.user.id, 'download', `下载客户照片: ${customerName} - ${photo.original_name}`);

          // 设置响应头并发送文件
          res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(photo.original_name)}"`);
          res.setHeader('Content-Type', 'application/octet-stream');
          res.sendFile(filePath);
          return;
        }

        // 多张照片，创建ZIP
        const zipFileName = `${customerName}_selected_${photos.length}photos_${Date.now()}.zip`;

        // 设置响应头
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(zipFileName)}"`);

        // 创建zip压缩流
        const archive = archiver('zip', {
          zlib: { level: 9 } // 压缩级别
        });

        // 处理压缩错误
        archive.on('error', (err) => {
          console.error('压缩错误:', err);
          // 为所有照片记录下载失败状态
          photos.forEach(photo => {
            recordDownloadStatus(photo.id, req.user.id, 'batch', 'failed', null, err.message);
          });
          if (!res.headersSent) {
            res.status(500).json({ error: '压缩失败' });
          }
        });

        // 压缩完成
        archive.on('end', () => {
          console.log(`选中照片下载完成: ${archive.pointer()} bytes`);
          // 为所有照片记录下载成功状态
          photos.forEach(photo => {
            recordDownloadStatus(photo.id, req.user.id, 'batch', 'success', zipFileName);
          });
          // 记录操作日志
          logOperation(req.user.id, 'batch_download_selected', `批量下载选中照片: ${customerName} (${photos.length}张)`);
        });

        // 将压缩流连接到响应
        archive.pipe(res);

        // 添加文件到压缩包
        let addedCount = 0;
        photos.forEach((photo, index) => {
          const filePath = path.join(__dirname, 'uploads', photo.file_name);
          
          if (fs.existsSync(filePath)) {
            archive.file(filePath, { name: photo.original_name });
            addedCount++;
          } else {
            console.warn(`文件不存在，跳过: ${photo.original_name}`);
            recordDownloadStatus(photo.id, req.user.id, 'batch', 'failed', null, '文件不存在');
          }

          // 如果是最后一个文件，完成压缩
          if (index === photos.length - 1) {
            if (addedCount === 0) {
              archive.destroy();
              if (!res.headersSent) {
                res.status(404).json({ error: '没有可用的文件' });
              }
            } else {
              archive.finalize();
            }
          }
        });
      });
    });
  });
});

// 记录下载状态的辅助函数
function recordDownloadStatus(fileId, merchantId, downloadType, status, filePath = null, errorMessage = null) {
  const downloadTime = new Date().toISOString();
  
  db.run(`
    INSERT INTO download_status (file_id, merchant_id, download_type, status, download_time, file_path, error_message)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `, [fileId, merchantId, downloadType, status, downloadTime, filePath, errorMessage], function(err) {
    if (err) {
      console.error('记录下载状态错误:', err);
    }
  });
}

// 获取用户上传的文件列表
app.get('/api/uploads', authenticateToken, (req, res) => {
  const { page = 1, limit = 10, status, timeFilter, startDate, endDate } = req.query;
  
  // 确保参数为有效数字
  const pageNum = parseInt(page) || 1;
  const limitNum = parseInt(limit) || 10;
  const offset = (pageNum - 1) * limitNum;

  // 构建WHERE条件
  let whereConditions = ['fu.user_id = ?'];
  let queryParams = [req.user.id];
  let countParams = [req.user.id];

  // 状态筛选
  if (status && ['received', 'processing', 'shipped'].includes(status)) {
    whereConditions.push('fu.process_status = ?');
    queryParams.push(status);
    countParams.push(status);
  }

  // 时间筛选
  if (timeFilter) {
    const now = new Date();
    let timeCondition = '';
    
    switch (timeFilter) {
      case 'today':
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        timeCondition = 'fu.upload_time >= ?';
        queryParams.push(today.toISOString());
        countParams.push(today.toISOString());
        break;
      case 'week':
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        timeCondition = 'fu.upload_time >= ?';
        queryParams.push(weekAgo.toISOString());
        countParams.push(weekAgo.toISOString());
        break;
      case 'month':
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        timeCondition = 'fu.upload_time >= ?';
        queryParams.push(monthAgo.toISOString());
        countParams.push(monthAgo.toISOString());
        break;
      case 'custom':
        if (startDate && endDate) {
          timeCondition = 'fu.upload_time >= ? AND fu.upload_time <= ?';
          const start = new Date(startDate + 'T00:00:00.000Z');
          const end = new Date(endDate + 'T23:59:59.999Z');
          queryParams.push(start.toISOString(), end.toISOString());
          countParams.push(start.toISOString(), end.toISOString());
        }
        break;
    }
    
    if (timeCondition) {
      whereConditions.push(timeCondition);
    }
  }

  // 查询文件列表，包括商家信息和新增字段，按状态和时间排序
  let query = `
    SELECT 
      fu.id, fu.original_name, fu.file_name, fu.file_size, fu.file_type, 
      fu.mime_type, fu.remarks, fu.upload_time, fu.status, fu.process_status,
      fu.edit_count,
      u.username as merchant_name 
    FROM file_uploads fu 
    LEFT JOIN users u ON fu.merchant_id = u.id 
    WHERE ${whereConditions.join(' AND ')}
    ORDER BY 
      CASE WHEN fu.status = 'deleted' THEN 1 ELSE 0 END,
      fu.upload_time DESC 
    LIMIT ? OFFSET ?
  `;

  // 添加分页参数
  queryParams.push(limitNum, offset);

  db.all(query, queryParams, (err, files) => {
    if (err) {
      console.error('获取文件列表错误:', err);
      return res.status(500).json({ error: '数据库错误' });
    }

    // 获取总数
    const countQuery = `SELECT COUNT(*) as total FROM file_uploads fu WHERE ${whereConditions.join(' AND ')}`;
    db.get(countQuery, countParams, (err, countResult) => {
      if (err) {
        console.error('获取文件总数错误:', err);
        return res.status(500).json({ error: '数据库错误' });
      }

      res.json({
        files: files,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: countResult.total,
          pages: Math.ceil(countResult.total / limitNum)
        }
      });
    });
  });
});

// 编辑文件备注
app.put('/api/uploads/:id/remarks', authenticateToken, [
  body('remarks').isLength({ max: 500 }).withMessage('备注长度不能超过500字符')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  
  const fileId = req.params.id;
  const { remarks } = req.body;
  
  try {
    // 检查文件是否存在且属于当前用户
    const file = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM file_uploads WHERE id = ? AND user_id = ?', 
        [fileId, req.user.id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
    
    if (!file) {
      return res.status(404).json({ error: '文件不存在' });
    }
    
    if (file.status === 'deleted') {
      return res.status(400).json({ error: '已删除的文件无法编辑备注' });
    }
    
    // 检查编辑次数限制
    const currentEditCount = file.edit_count || 0;
    if (currentEditCount >= 10) {
      return res.status(400).json({ error: '备注编辑次数已达上限（10次）' });
    }
    
    // 更新备注和编辑次数
    await new Promise((resolve, reject) => {
      db.run(`
        UPDATE file_uploads 
        SET remarks = ?, edit_count = COALESCE(edit_count, 0) + 1
        WHERE id = ? AND user_id = ?
      `, [remarks, fileId, req.user.id], function(err) {
        if (err) reject(err);
        else resolve();
      });
    });
    
    // 记录操作日志
    logOperation(req.user.id, '编辑备注', 
      `编辑文件备注: ${file.original_name} (ID: ${fileId}), 第${currentEditCount + 1}次编辑`);
    
    res.json({ 
      message: '备注更新成功',
      editCount: currentEditCount + 1,
      remainingEdits: 10 - (currentEditCount + 1)
    });
    
  } catch (error) {
    console.error('编辑备注错误:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 软删除文件
app.delete('/api/uploads/:id', authenticateToken, async (req, res) => {
  const fileId = req.params.id;
  
  try {
    // 检查文件是否存在且属于当前用户
    const file = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM file_uploads WHERE id = ? AND user_id = ?', 
        [fileId, req.user.id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
    
    if (!file) {
      return res.status(404).json({ error: '文件不存在' });
    }
    
    if (file.status === 'deleted') {
      return res.status(400).json({ error: '文件已经被删除' });
    }
    
    // 软删除文件
    await new Promise((resolve, reject) => {
      db.run('UPDATE file_uploads SET status = ? WHERE id = ? AND user_id = ?', 
        ['deleted', fileId, req.user.id], function(err) {
        if (err) reject(err);
        else resolve();
      });
    });
    
    // 记录操作日志
    logOperation(req.user.id, '删除文件', 
      `删除文件: ${file.original_name} (ID: ${fileId})`);
    
    res.json({ message: '文件删除成功' });
    
  } catch (error) {
    console.error('删除文件错误:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 恢复已删除的文件
app.put('/api/uploads/:id/restore', authenticateToken, async (req, res) => {
  const fileId = req.params.id;
  
  try {
    // 检查文件是否存在且属于当前用户
    const file = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM file_uploads WHERE id = ? AND user_id = ?', 
        [fileId, req.user.id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
    
    if (!file) {
      return res.status(404).json({ error: '文件不存在' });
    }
    
    if (file.status !== 'deleted') {
      return res.status(400).json({ error: '文件未被删除，无需恢复' });
    }
    
    // 恢复文件
    await new Promise((resolve, reject) => {
      db.run('UPDATE file_uploads SET status = ? WHERE id = ? AND user_id = ?', 
        ['active', fileId, req.user.id], function(err) {
        if (err) reject(err);
        else resolve();
      });
    });
    
    // 记录操作日志
    logOperation(req.user.id, '恢复文件', 
      `恢复文件: ${file.original_name} (ID: ${fileId})`);
    
    res.json({ message: '文件恢复成功' });
    
  } catch (error) {
    console.error('恢复文件错误:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 提供主页
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`服务器运行在端口 ${PORT}`);
  console.log(`访问 http://localhost:${PORT} 查看应用`);
});

module.exports = app;
