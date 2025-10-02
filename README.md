# 照片管理系统

一个功能完整的照片管理系统，支持用户注册、文件上传、商家管理等功能。

## 功能特性

- 🔐 **用户认证**：登录、注册、JWT令牌验证
- 👥 **角色管理**：客户、商家、管理员多角色权限控制
- 📁 **文件管理**：支持图片和压缩包上传下载
- 📊 **状态跟踪**：文件处理状态和下载状态管理
- 📝 **操作日志**：完整的用户操作记录
- 🎨 **响应式设计**：支持手机、平板、电脑访问

## 技术栈

- **后端**：Node.js + Express.js
- **数据库**：PostgreSQL
- **文件存储**：AWS S3
- **前端**：HTML5 + CSS3 + JavaScript
- **认证**：JWT
- **部署**：Railway

## 快速开始

### 本地开发

1. 克隆仓库
```bash
git clone <your-repo-url>
cd photo-management-system
```

2. 安装依赖
```bash
npm install
```

3. 配置环境变量
```bash
cp env.example .env
# 编辑 .env 文件，填入你的配置
```

4. 启动服务器
```bash
npm start
```

5. 访问应用
打开浏览器访问 http://localhost:3000

### 云端部署

1. Fork 这个仓库到你的GitHub账号
2. 在Railway上创建新项目
3. 连接GitHub仓库
4. 配置环境变量
5. 部署完成

## 环境变量

| 变量名 | 描述 | 必需 |
|--------|------|------|
| `DATABASE_URL` | PostgreSQL数据库连接字符串 | 是 |
| `JWT_SECRET` | JWT签名密钥 | 是 |
| `AWS_ACCESS_KEY_ID` | AWS访问密钥ID | 是 |
| `AWS_SECRET_ACCESS_KEY` | AWS秘密访问密钥 | 是 |
| `AWS_REGION` | AWS区域 | 是 |
| `S3_BUCKET_NAME` | S3存储桶名称 | 是 |
| `PORT` | 服务器端口 | 否 |

## 默认账户

- **管理员**：admin / admin123
- **商家**：需要管理员创建
- **客户**：可以自行注册

## API文档

### 认证接口

- `POST /api/register` - 用户注册
- `POST /api/login` - 用户登录
- `GET /api/profile` - 获取用户信息

### 文件管理

- `POST /api/upload` - 上传文件
- `GET /api/uploads` - 获取文件列表
- `PUT /api/uploads/:id/remarks` - 编辑文件备注
- `DELETE /api/uploads/:id` - 删除文件

### 商家功能

- `GET /api/merchant/customers` - 获取客户列表
- `GET /api/merchant/customer/:id/photos` - 获取客户照片
- `PUT /api/merchant/photo/:id/status` - 更新照片状态
- `GET /api/merchant/photo/:id/download` - 下载单张照片
- `GET /api/merchant/customer/:id/download-all` - 批量下载

## 部署说明

### Railway部署

1. 访问 [Railway](https://railway.app)
2. 使用GitHub账号登录
3. 创建新项目
4. 选择"Deploy from GitHub repo"
5. 选择你的仓库
6. 配置环境变量
7. 等待部署完成

### 环境变量配置

在Railway项目设置中添加以下环境变量：

```
DATABASE_URL=postgresql://...
JWT_SECRET=your-secret-key
AWS_ACCESS_KEY_ID=your-key
AWS_SECRET_ACCESS_KEY=your-secret
AWS_REGION=us-east-1
S3_BUCKET_NAME=your-bucket
```

## 贡献

欢迎提交Issue和Pull Request！

## 许可证

MIT License

## 联系方式

如有问题，请联系：
- 邮箱：1915316345@qq.com
- 电话：135-9339-3484