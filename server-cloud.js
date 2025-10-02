/**
 * 文件名: server-cloud.js
 * 创建时间: 2025年10月3日
 * 文件内容: 云端部署版本的用户管理系统后端服务器
 * 
 * 主要功能:
 * 1. 用户认证 - 登录、注册、JWT令牌验证
 * 2. 权限管理 - 基于角色的访问控制（RBAC）
 * 3. 文件管理 - 上传、下载、状态管理、权限控制
 * 4. 操作日志 - 记录和查询用户操作历史
 * 5. 商家功能 - 客户管理、照片处理、批量下载
 * 
 * 云端适配:
 * - 使用PostgreSQL数据库替代SQLite
 * - 使用云存储替代本地文件存储
 * - 优化内存使用和性能
 * - 添加健康检查端点
 * 
 * 技术栈:
 * - Express.js - Web框架
 * - PostgreSQL - 数据库
 * - JWT - 身份验证
 * - Multer - 文件上传
 * - Archiver - 文件压缩
 * - AWS S3/Cloudinary - 文件存储
 */

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const path = require('path');
const multer = require('multer');
const fs = require('fs-extra');
const archiver = require('archiver');
const AWS = require('aws-sdk');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// 数据库连接配置
const dbConfig = {
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
};

const pool = new Pool(dbConfig);

// AWS S3 配置（用于文件存储）
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION || 'us-east-1'
});

const S3_BUCKET = process.env.S3_BUCKET_NAME;

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
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static('public'));

// 速率限制
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 100, // 限制每个IP最多100次请求
  message: { error: '请求过于频繁，请稍后再试' }
});
app.use(limiter);

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 5, // 限制每个IP最多5次登录尝试
  message: { error: '登录尝试次数过多，请15分钟后再试' }
});

// 确保临时上传目录存在
const tempUploadDir = './temp-uploads';
try {
  fs.ensureDirSync(tempUploadDir);
  console.log(`临时上传目录已准备: ${path.resolve(tempUploadDir)}`);
} catch (error) {
  console.error('临时上传目录准备失败:', error);
  process.exit(1);
}

// 配置multer文件上传（临时存储）
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, tempUploadDir);
  },
  filename: function (req, file, cb) {
    try {
      const timestamp = Date.now();
      const random = Math.round(Math.random() * 1E9);
      let originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
      const ext = path.extname(originalName);
      let name = path.basename(originalName, ext);
      name = name.replace(/[<>:"/\\|?*]/g, '_');
      name = name.replace(/\s+/g, '_');
      const filename = `${timestamp}_${random}_${name}${ext}`;
      cb(null, filename);
    } catch (error) {
      console.error('文件名生成错误:', error);
      cb(error);
    }
  }
});

// 文件过滤器
const fileFilter = (req, file, cb) => {
  const imageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  const archiveTypes = [
    'application/zip', 
    'application/x-zip-compressed', 
    'application/x-rar-compressed', 
    'application/vnd.rar',
    'application/x-rar',
    'application/x-7z-compressed'
  ];
  
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
  const archiveExtensions = ['.zip', '.rar', '.7z'];
  
  const allowedTypes = [...imageTypes, ...archiveTypes];
  const allowedExtensions = [...imageExtensions, ...archiveExtensions];
  
  const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
  const ext = path.extname(originalName).toLowerCase();
  
  if (allowedTypes.includes(file.mimetype) || allowedExtensions.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('不支持的文件类型。只允许上传图片（jpg, png, gif, webp）和压缩包（zip, rar, 7z）'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB
    files: 20 // 最多20个文件
  }
});

// 数据库初始化
async function initDatabase() {
  try {
    const client = await pool.connect();
    
    // 创建用户表
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(20) NOT NULL DEFAULT 'customer',
        status VARCHAR(20) NOT NULL DEFAULT 'active',
        disable_reason TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_login TIMESTAMP
      )
    `);

    // 创建文件上传表
    await client.query(`
      CREATE TABLE IF NOT EXISTS file_uploads (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id),
        merchant_id INTEGER NOT NULL REFERENCES users(id),
        original_name VARCHAR(255) NOT NULL,
        file_name VARCHAR(255) NOT NULL,
        file_url TEXT NOT NULL,
        file_size BIGINT NOT NULL,
        file_type VARCHAR(20) NOT NULL,
        mime_type VARCHAR(100) NOT NULL,
        remarks TEXT,
        upload_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        status VARCHAR(20) DEFAULT 'active',
        process_status VARCHAR(20) DEFAULT 'received',
        edit_count INTEGER DEFAULT 0
      )
    `);

    // 创建操作日志表
    await client.query(`
      CREATE TABLE IF NOT EXISTS operation_logs (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        operation VARCHAR(100) NOT NULL,
        details TEXT,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 创建下载状态表
    await client.query(`
      CREATE TABLE IF NOT EXISTS download_status (
        id SERIAL PRIMARY KEY,
        file_id INTEGER NOT NULL REFERENCES file_uploads(id),
        merchant_id INTEGER NOT NULL REFERENCES users(id),
        download_type VARCHAR(20) NOT NULL,
        status VARCHAR(20) NOT NULL,
        download_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        file_path TEXT,
        error_message TEXT
      )
    `);

    // 插入默认管理员用户
    const adminExists = await client.query('SELECT id FROM users WHERE username = $1', ['admin']);
    if (adminExists.rows.length === 0) {
      const hashedPassword = await bcrypt.hash('admin123', 10);
      await client.query(
        'INSERT INTO users (username, password, role, status) VALUES ($1, $2, $3, $4)',
        ['admin', hashedPassword, 'admin', 'active']
      );
      console.log('默认管理员用户已创建: admin/admin123');
    }

    client.release();
    console.log('数据库初始化完成');
  } catch (error) {
    console.error('数据库初始化失败:', error);
    process.exit(1);
  }
}

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

// 管理员权限验证中间件
const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin' && req.user.role !== 'sub_admin') {
    return res.status(403).json({ error: '需要管理员权限' });
  }
  next();
};

// 记录操作日志
const logOperation = async (userId, operation, details = '') => {
  try {
    await pool.query(
      'INSERT INTO operation_logs (user_id, operation, details, timestamp) VALUES ($1, $2, $3, $4)',
      [userId, operation, details, new Date().toISOString()]
    );
  } catch (error) {
    console.error('记录操作日志错误:', error);
  }
};

// 上传文件到S3
const uploadToS3 = async (file, key) => {
  const fileContent = fs.readFileSync(file.path);
  const params = {
    Bucket: S3_BUCKET,
    Key: key,
    Body: fileContent,
    ContentType: file.mimetype,
    ACL: 'private'
  };
  
  return new Promise((resolve, reject) => {
    s3.upload(params, (err, data) => {
      if (err) {
        reject(err);
      } else {
        resolve(data.Location);
      }
    });
  });
};

// 从S3下载文件
const downloadFromS3 = async (key) => {
  const params = {
    Bucket: S3_BUCKET,
    Key: key
  };
  
  return new Promise((resolve, reject) => {
    s3.getObject(params, (err, data) => {
      if (err) {
        reject(err);
      } else {
        resolve(data.Body);
      }
    });
  });
};

// 健康检查端点
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// 用户注册
app.post('/api/register', [
  body('username').isLength({ min: 3, max: 20 }).withMessage('用户名长度必须在3-20个字符之间'),
  body('password').isLength({ min: 6 }).withMessage('密码长度至少6个字符')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { username, password } = req.body;
  const role = 'customer';

  try {
    const client = await pool.connect();
    
    // 检查用户名是否已存在
    const existingUser = await client.query('SELECT id FROM users WHERE username = $1', [username]);
    if (existingUser.rows.length > 0) {
      client.release();
      return res.status(400).json({ error: '用户名已存在' });
    }

    // 加密密码
    const hashedPassword = await bcrypt.hash(password, 10);
    const createdAt = new Date().toISOString();

    // 创建用户
    const result = await client.query(
      'INSERT INTO users (username, password, role, status, created_at) VALUES ($1, $2, $3, $4, $5) RETURNING id',
      [username, hashedPassword, role, 'active', createdAt]
    );

    const userId = result.rows[0].id;
    client.release();

    await logOperation(userId, '客户注册', `新客户注册: ${username} (ID: ${userId})`);
    
    res.status(201).json({
      message: '注册成功',
      user: {
        id: userId,
        username,
        role,
        status: 'active'
      }
    });
  } catch (error) {
    console.error('注册错误:', error);
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
    const client = await pool.connect();
    const result = await client.query('SELECT * FROM users WHERE username = $1', [username]);
    
    if (result.rows.length === 0) {
      client.release();
      return res.status(401).json({ error: '用户名或密码错误' });
    }

    const user = result.rows[0];
    client.release();

    if (user.status === 'disabled') {
      return res.status(401).json({ 
        error: '账户已被禁用', 
        reason: user.disable_reason 
      });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      await logOperation(user.id, '登录失败', `用户: ${username} (ID: ${user.id}) 密码错误`);
      return res.status(401).json({ error: '用户名或密码错误' });
    }

    // 更新最后登录时间
    const lastLogin = new Date().toISOString();
    await pool.query('UPDATE users SET last_login = $1 WHERE id = $2', [lastLogin, user.id]);

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

    await logOperation(user.id, '登录成功', `用户: ${username} (ID: ${user.id}) 登录成功`);

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
  } catch (error) {
    console.error('登录错误:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 获取用户信息
app.get('/api/profile', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, username, role, status, created_at, last_login FROM users WHERE id = $1',
      [req.user.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: '用户不存在' });
    }

    res.json({ user: result.rows[0] });
  } catch (error) {
    console.error('获取用户信息错误:', error);
    res.status(500).json({ error: '数据库错误' });
  }
});

// 文件上传API
app.post('/api/upload', authenticateToken, upload.array('files', 20), async (req, res) => {
  try {
    const { merchantId, remarks } = req.body;
    const files = req.files;
    
    console.log(`=== 文件上传请求 ===`);
    console.log(`用户ID: ${req.user.id}, 商家ID: ${merchantId}`);
    console.log(`文件数量: ${files ? files.length : 0}`);

    if (!merchantId) {
      return res.status(400).json({ error: '请选择商家' });
    }

    if (!files || files.length === 0) {
      return res.status(400).json({ error: '请选择要上传的文件' });
    }

    // 验证商家是否存在
    const merchantResult = await pool.query(
      "SELECT id, username, status FROM users WHERE id = $1 AND role = 'merchant'",
      [merchantId]
    );

    if (merchantResult.rows.length === 0) {
      return res.status(400).json({ error: '选择的商家不存在' });
    }

    const merchant = merchantResult.rows[0];
    if (merchant.status === 'disabled') {
      return res.status(400).json({ error: '选择的商家已被禁用，无法上传文件' });
    }

    // 验证文件总大小
    let totalImageSize = 0;
    let imageCount = 0;
    
    for (const file of files) {
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

    // 上传文件到S3并保存到数据库
    const uploadTime = new Date().toISOString();
    const savedFiles = [];

    for (const file of files) {
      const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
      const ext = path.extname(originalName).toLowerCase();
      const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
      const isImage = file.mimetype.startsWith('image/') || imageExtensions.includes(ext);
      const fileType = isImage ? 'image' : 'archive';
      
      // 生成S3存储键
      const s3Key = `uploads/${req.user.id}/${Date.now()}_${file.filename}`;
      
      // 上传到S3
      const fileUrl = await uploadToS3(file, s3Key);
      
      // 保存到数据库
      const result = await pool.query(`
        INSERT INTO file_uploads 
        (user_id, merchant_id, original_name, file_name, file_url, file_size, file_type, mime_type, remarks, upload_time)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING id
      `, [
        req.user.id,
        merchantId,
        originalName,
        file.filename,
        fileUrl,
        file.size,
        fileType,
        file.mimetype,
        remarks || null,
        uploadTime
      ]);

      const fileId = result.rows[0].id;
      savedFiles.push({
        id: fileId,
        originalName: originalName,
        fileName: file.filename,
        size: file.size,
        type: fileType
      });

      // 删除临时文件
      fs.unlinkSync(file.path);
    }

    await logOperation(req.user.id, '文件上传', 
      `上传${files.length}个文件到商家: ${merchant.username} (ID: ${merchantId})`);

    res.json({
      message: '文件上传成功',
      files: savedFiles,
      merchant: merchant.username,
      uploadTime: uploadTime
    });

  } catch (error) {
    console.error('文件上传错误:', error);
    res.status(500).json({ 
      error: '文件上传失败', 
      details: process.env.NODE_ENV === 'development' ? error.message : undefined 
    });
  }
});

// 获取用户上传的文件列表
app.get('/api/uploads', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 10, status, timeFilter, startDate, endDate } = req.query;
    
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 10;
    const offset = (pageNum - 1) * limitNum;

    // 构建WHERE条件
    let whereConditions = ['fu.user_id = $1'];
    let queryParams = [req.user.id];
    let countParams = [req.user.id];
    let paramIndex = 2;

    // 状态筛选
    if (status && ['received', 'processing', 'shipped'].includes(status)) {
      whereConditions.push(`fu.process_status = $${paramIndex}`);
      queryParams.push(status);
      countParams.push(status);
      paramIndex++;
    }

    // 时间筛选
    if (timeFilter) {
      const now = new Date();
      let timeCondition = '';
      
      switch (timeFilter) {
        case 'today':
          const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          timeCondition = `fu.upload_time >= $${paramIndex}`;
          queryParams.push(today.toISOString());
          countParams.push(today.toISOString());
          paramIndex++;
          break;
        case 'week':
          const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          timeCondition = `fu.upload_time >= $${paramIndex}`;
          queryParams.push(weekAgo.toISOString());
          countParams.push(weekAgo.toISOString());
          paramIndex++;
          break;
        case 'month':
          const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          timeCondition = `fu.upload_time >= $${paramIndex}`;
          queryParams.push(monthAgo.toISOString());
          countParams.push(monthAgo.toISOString());
          paramIndex++;
          break;
        case 'custom':
          if (startDate && endDate) {
            timeCondition = `fu.upload_time >= $${paramIndex} AND fu.upload_time <= $${paramIndex + 1}`;
            const start = new Date(startDate + 'T00:00:00.000Z');
            const end = new Date(endDate + 'T23:59:59.999Z');
            queryParams.push(start.toISOString(), end.toISOString());
            countParams.push(start.toISOString(), end.toISOString());
            paramIndex += 2;
          }
          break;
      }
      
      if (timeCondition) {
        whereConditions.push(timeCondition);
      }
    }

    // 查询文件列表
    const query = `
      SELECT 
        fu.id, fu.original_name, fu.file_name, fu.file_url, fu.file_size, fu.file_type, 
        fu.mime_type, fu.remarks, fu.upload_time, fu.status, fu.process_status,
        fu.edit_count,
        u.username as merchant_name 
      FROM file_uploads fu 
      LEFT JOIN users u ON fu.merchant_id = u.id 
      WHERE ${whereConditions.join(' AND ')}
      ORDER BY 
        CASE WHEN fu.status = 'deleted' THEN 1 ELSE 0 END,
        fu.upload_time DESC 
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    queryParams.push(limitNum, offset);

    const filesResult = await pool.query(query, queryParams);
    const files = filesResult.rows;

    // 获取总数
    const countQuery = `SELECT COUNT(*) as total FROM file_uploads fu WHERE ${whereConditions.join(' AND ')}`;
    const countResult = await pool.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].total);

    res.json({
      files: files,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: total,
        pages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    console.error('获取文件列表错误:', error);
    res.status(500).json({ error: '数据库错误' });
  }
});

// 提供主页
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 启动服务器
async function startServer() {
  try {
    await initDatabase();
    
    app.listen(PORT, () => {
      console.log(`服务器运行在端口 ${PORT}`);
      console.log(`访问 http://localhost:${PORT} 查看应用`);
      console.log(`健康检查: http://localhost:${PORT}/health`);
    });
  } catch (error) {
    console.error('服务器启动失败:', error);
    process.exit(1);
  }
}

// 优雅关闭
process.on('SIGTERM', async () => {
  console.log('收到SIGTERM信号，正在关闭服务器...');
  await pool.end();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('收到SIGINT信号，正在关闭服务器...');
  await pool.end();
  process.exit(0);
});

startServer();

module.exports = app;
