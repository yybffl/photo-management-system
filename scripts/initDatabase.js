/**
 * 文件名: initDatabase.js
 * 创建时间: 2025年10月2日
 * 文件内容: 数据库初始化脚本，创建表结构并插入初始数据
 * 
 * 功能说明:
 * 1. 创建用户表(users) - 存储用户账户信息和角色权限
 * 2. 创建操作日志表(operation_logs) - 记录系统操作历史
 * 3. 创建文件上传表(file_uploads) - 管理用户上传的文件信息
 * 4. 插入默认管理员账户 - 系统初始管理员用户
 * 5. 插入测试数据 - 便于开发和测试使用
 * 
 * 数据表结构:
 * - users: 用户基础信息、角色、状态管理
 * - operation_logs: 操作记录、时间戳、用户追踪
 * - file_uploads: 文件元数据、商家关联、处理状态
 * 
 * 修改记录:
 * - 2025/10/02: 初始创建，实现基础用户表和日志表
 * - 2025/10/02: 添加文件上传表，支持文件管理功能
 * - 2025/10/02: 优化表结构，添加文件编辑次数和处理状态字段
 * - 2025/10/02: 插入测试商家和客户数据，便于功能测试
 * - 2025/10/02: 添加文件说明注释
 */

const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');

// 创建数据库连接
const db = new sqlite3.Database('./database.db');

async function initDatabase() {
  console.log('开始初始化数据库...');

  try {
    // 创建用户表
    await new Promise((resolve, reject) => {
      db.run(`
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT UNIQUE NOT NULL,
          password TEXT NOT NULL,
          role TEXT NOT NULL CHECK (role IN ('admin', 'sub_admin', 'merchant', 'customer')),
          status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
          disable_reason TEXT,
          created_at TEXT NOT NULL,
          last_login TEXT
        )
      `, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    // 创建操作日志表
    await new Promise((resolve, reject) => {
      db.run(`
        CREATE TABLE IF NOT EXISTS operation_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER,
          operation TEXT NOT NULL,
          details TEXT,
          timestamp TEXT NOT NULL,
          FOREIGN KEY (user_id) REFERENCES users (id)
        )
      `, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    // 创建文件上传表
    await new Promise((resolve, reject) => {
      db.run(`
        CREATE TABLE IF NOT EXISTS file_uploads (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          merchant_id INTEGER NOT NULL,
          original_name TEXT NOT NULL,
          file_name TEXT NOT NULL,
          file_path TEXT NOT NULL,
          file_size INTEGER NOT NULL,
          file_type TEXT NOT NULL,
          mime_type TEXT NOT NULL,
          remarks TEXT,
          upload_time TEXT NOT NULL,
          status TEXT DEFAULT 'active' CHECK (status IN ('active', 'deleted')),
          process_status TEXT DEFAULT 'received' CHECK (process_status IN ('received', 'processing', 'shipped')),
          edit_count INTEGER DEFAULT 0,
          FOREIGN KEY (user_id) REFERENCES users (id),
          FOREIGN KEY (merchant_id) REFERENCES users (id)
        )
      `, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    // 创建下载状态表
    await new Promise((resolve, reject) => {
      db.run(`
        CREATE TABLE IF NOT EXISTS download_status (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          file_id INTEGER NOT NULL,
          merchant_id INTEGER NOT NULL,
          download_type TEXT NOT NULL CHECK (download_type IN ('single', 'batch')),
          status TEXT NOT NULL DEFAULT 'success' CHECK (status IN ('success', 'failed', 'retry')),
          download_time TEXT NOT NULL,
          file_path TEXT,
          error_message TEXT,
          FOREIGN KEY (file_id) REFERENCES file_uploads (id),
          FOREIGN KEY (merchant_id) REFERENCES users (id)
        )
      `, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    // 检查是否已存在管理员账户
    const adminExists = await new Promise((resolve, reject) => {
      db.get('SELECT id FROM users WHERE username = ?', ['admin'], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!adminExists) {
      // 创建默认管理员账户
      const hashedPassword = await bcrypt.hash('admin', 10);
      const createdAt = new Date().toISOString();

      await new Promise((resolve, reject) => {
        db.run(
          'INSERT INTO users (username, password, role, status, created_at) VALUES (?, ?, ?, ?, ?)',
          ['admin', hashedPassword, 'admin', 'active', createdAt],
          function(err) {
            if (err) reject(err);
            else {
              console.log('默认管理员账户创建成功 - 用户名: admin, 密码: admin');
              
              // 记录初始化日志
              db.run(
                'INSERT INTO operation_logs (user_id, operation, details, timestamp) VALUES (?, ?, ?, ?)',
                [this.lastID, '系统初始化', '创建默认管理员账户', createdAt]
              );
              
              resolve();
            }
          }
        );
      });
    } else {
      console.log('管理员账户已存在，跳过创建');
    }

    // 创建索引以提高查询性能
    await new Promise((resolve, reject) => {
      db.run('CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)', (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    await new Promise((resolve, reject) => {
      db.run('CREATE INDEX IF NOT EXISTS idx_operation_logs_user_id ON operation_logs(user_id)', (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    await new Promise((resolve, reject) => {
      db.run('CREATE INDEX IF NOT EXISTS idx_operation_logs_timestamp ON operation_logs(timestamp)', (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    console.log('数据库初始化完成！');
    console.log('');
    console.log('=== 系统信息 ===');
    console.log('默认管理员账户:');
    console.log('  用户名: admin');
    console.log('  密码: admin');
    console.log('');
    console.log('请在生产环境中修改默认密码！');
    console.log('===============');

  } catch (error) {
    console.error('数据库初始化失败:', error);
    process.exit(1);
  } finally {
    db.close();
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  initDatabase();
}

module.exports = initDatabase;
