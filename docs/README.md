# 💜 浪漫生日回忆册

一个现代化的生日回忆册网页应用，支持图片和音频上传，为每个回忆生成专属二维码。完美适配手机端和iPad端，采用浪漫紫色主题设计。

## ✨ 功能特色

- 🎨 **浪漫紫色主题** - 现代化设计，充满爱意的动画效果
- 📱 **响应式设计** - 完美适配手机、iPad和桌面端
- 📷 **媒体上传** - 支持图片和音频文件上传
- 📲 **二维码生成** - 为每个回忆生成专属二维码
- 🌟 **精美动画** - 点击爱心爆炸、粒子效果、庆祝动画
- ☁️ **数据存储** - 支持服务器存储 + 本地存储fallback
- 🔄 **自动备份** - 服务器连接失败时自动切换到本地存储

## 🛠️ 技术栈

### 前端
- HTML5 + CSS3 + JavaScript (ES6+)
- 响应式设计 (Flexbox + Grid)
- CSS动画 + 粒子效果
- QR码生成 (qrcode.js)
- Font Awesome 图标
- Google Fonts 字体

### 后端
- Node.js + Express.js
- MongoDB 数据库
- Multer 文件上传
- Sharp 图片处理
- JWT 认证 (可选)

## 📦 快速开始

### 1. 安装依赖

```bash
# 安装后端依赖
cd server && npm install

# 或者在项目根目录使用便捷脚本
npm run install-all
```

### 2. 配置MongoDB

#### 方式一：本地MongoDB
```bash
# 启动MongoDB服务
mongod
```

#### 方式二：MongoDB Atlas (云数据库)
1. 注册 [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. 创建免费集群
3. 获取连接字符串
4. 配置环境变量

### 3. 环境配置

创建 `.env` 文件：

```bash
# 服务器配置
PORT=3000
NODE_ENV=development

# MongoDB配置 (选择一种)
# 本地MongoDB
MONGODB_URI=mongodb://localhost:27017/birthday_memories

# 或者 MongoDB Atlas
# MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/birthday_memories

# 生产环境域名 (部署时配置)
# ALLOWED_ORIGINS=https://your-domain.com
```

### 4. 启动应用

```bash
# 开发模式 (自动重启)
npm run dev

# 生产模式
npm start

# 或者进入server目录直接启动
cd server && node server.js
```

访问 http://localhost:3000

## 📁 项目结构

```
birthday/
├── public/                 # 前端静态文件
│   ├── index.html          # 主页面
│   ├── view.html           # 查看页面  
│   ├── style.css           # 主样式
│   ├── animations.css      # 动画效果
│   ├── script.js          # 前端逻辑
│   └── api.js             # API交互
├── server/                 # 后端服务器
│   ├── server.js          # Express服务器
│   └── package.json       # 后端依赖配置
├── config/                 # 配置文件
│   ├── config.example.js  # 配置示例
│   └── nginx.conf.example # Nginx配置
├── docs/                   # 文档
│   ├── README.md          # 说明文档
│   └── MONGODB_SETUP.md   # 数据库配置指南
├── scripts/                # 脚本文件
│   └── deploy.sh          # 自动部署脚本
├── uploads/               # 上传文件目录
├── package.json           # 项目根配置
└── .env                   # 环境变量 (需要创建)
```

## 🚀 部署指南

### ⚡ Render平台部署 (强烈推荐)

**现代化云平台，免费部署，GitHub自动同步！**

查看详细指南：`RENDER_DEPLOYMENT_GUIDE.md` 或 `QUICK_DEPLOY.md`

**部署状态**: ✅ 准备就绪 - 运行 `npm run pre-deploy` 检查

```bash
# 一键部署检查
npm run pre-deploy

# 推送到GitHub后在Render创建服务即可！
```

### 🔧 传统服务器部署

使用提供的自动部署脚本，一键部署到VPS服务器：

```bash
# Linux/macOS 环境
chmod +x scripts/deploy.sh
bash scripts/deploy.sh production

# Windows 环境 (使用 Git Bash 或 WSL)
bash scripts/deploy.sh production

# 开发环境部署
bash scripts/deploy.sh development
```

脚本会自动完成：
- ✅ 环境检查 (Node.js, MongoDB)
- ✅ 依赖安装
- ✅ 目录创建
- ✅ PM2 进程管理
- ✅ 服务启动

### 🛠️ 手动部署

如果需要手动控制部署过程：

#### 步骤1：准备服务器
- 推荐配置：1GB RAM，1核CPU，10GB存储
- 支持平台：阿里云、腾讯云、AWS、Google Cloud等

#### 步骤2：安装环境
```bash
# Ubuntu/Debian
sudo apt update
sudo apt install nginx nodejs npm mongodb

# CentOS/RHEL  
sudo yum install nginx nodejs npm mongodb-org
```

#### 步骤3：部署应用
```bash
# 1. 上传代码到服务器
scp -r . user@server:/var/www/birthday

# 2. 安装依赖
cd /var/www/birthday/server
npm install --production

# 3. 配置环境变量
cd /var/www/birthday
cp config/config.example.js .env
# 编辑 .env 文件设置生产环境配置

# 4. 启动应用 (使用PM2管理进程)
npm install -g pm2
pm2 start server/server.js --name "birthday-app"
pm2 startup
pm2 save
```

#### 步骤4：配置Nginx反向代理
```nginx
# /etc/nginx/sites-available/birthday
server {
    listen 80;
    server_name your-domain.com;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
# 启用站点
sudo ln -s /etc/nginx/sites-available/birthday /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

#### 步骤5：配置HTTPS (可选但推荐)
```bash
# 使用 Let's Encrypt
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

### 部署到Vercel/Netlify等平台

对于纯前端部署 (仅本地存储)：

1. 删除后端相关文件：`server.js`, `package.json`
2. 修改前端代码强制使用本地存储
3. 部署到静态托管平台

## 🔧 配置说明

### MongoDB数据库选择

#### 本地MongoDB
- 优点：完全控制，无额外费用
- 缺点：需要自己维护，备份困难
- 适合：开发测试、私人部署

#### MongoDB Atlas (推荐)
- 优点：免费套餐，自动备份，高可用
- 缺点：有数据量限制 (免费版512MB)
- 适合：生产环境、个人项目

### 文件存储配置

- 服务器存储：上传到 `uploads/` 目录
- 本地存储：浏览器 localStorage (fallback)
- 文件大小限制：服务器50MB，本地10MB
- 支持格式：
  - 图片：JPG、PNG、GIF、WebP
  - 音频：MP3、WAV、M4A、OGG

## 🎯 使用指南

### 1. 上传回忆
- 点击上传区域或拖拽文件
- 支持批量上传
- 自动生成缩略图
- 实时上传进度

### 2. 查看回忆
- 点击"查看"按钮
- 图片支持全屏查看
- 音频直接播放
- 精美动画效果

### 3. 生成二维码
- 点击"二维码"按钮
- 自动生成专属二维码
- 可下载保存分享
- 扫码直接跳转

### 4. 分享回忆
- 通过二维码分享
- 直接复制链接分享
- 支持社交媒体分享

## 🐛 常见问题

### Q1: 上传失败怎么办？
- 检查文件大小是否超限
- 检查文件格式是否支持
- 检查网络连接
- 查看浏览器控制台错误信息

### Q2: 服务器连接失败？
- 应用会自动切换到本地存储
- 检查服务器状态和网络
- 查看后端日志排查问题

### Q3: 二维码无法访问？
- 检查服务器域名配置
- 确认防火墙和端口设置
- 验证HTTPS证书有效性

### Q4: 数据如何备份？
- 服务器版：定期备份MongoDB数据
- 本地版：导出localStorage数据
- 建议定期下载重要文件

## 🤝 贡献指南

欢迎提交 Issue 和 Pull Request！

1. Fork 项目
2. 创建特性分支
3. 提交更改
4. 发起 Pull Request

## 📄 开源协议

MIT License - 详见 [LICENSE](LICENSE) 文件

## 💕 致谢

感谢所有为这个项目贡献代码和建议的朋友们！

希望这个浪漫的生日回忆册能为您和您的爱人带来美好的回忆！💜✨
