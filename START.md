# 🚀 快速开始指南

欢迎使用浪漫生日回忆册！这是一个快速开始指南。

## 📋 项目结构说明

```
birthday/
├── public/          📱 前端文件 (网页界面)
├── server/          🖥️ 后端文件 (服务器)
├── config/          ⚙️ 配置文件
├── docs/            📖 详细文档
├── scripts/         🔧 部署脚本
└── uploads/         📁 文件存储
```

## ⚡ 3分钟快速启动

### 1️⃣ 安装依赖
```bash
cd server
npm install
```

### 2️⃣ 配置数据库
**选择一个方式：**

**方式A：MongoDB Atlas (免费云数据库，推荐)**
1. 访问 https://www.mongodb.com/cloud/atlas
2. 注册账号，创建免费集群
3. 获取连接字符串

**方式B：本地MongoDB**
```bash
# Ubuntu/Debian
sudo apt install mongodb
sudo systemctl start mongod
```

### 3️⃣ 配置环境变量
在项目根目录创建 `.env` 文件：

```bash
# MongoDB Atlas (云数据库)
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/birthday_memories

# 或者本地数据库
MONGODB_URI=mongodb://localhost:27017/birthday_memories

PORT=3000
NODE_ENV=development
```

### 4️⃣ 启动应用
```bash
# 在项目根目录
npm start

# 或者进入server目录
cd server && node server.js
```

### 5️⃣ 访问应用
打开浏览器访问：http://localhost:3000

🎉 **搞定！开始创建美好回忆吧！**

## 🔥 常用命令

```bash
# 开发模式 (自动重启)
npm run dev

# 生产模式启动
npm start

# 安装所有依赖
npm run install-all

# 部署到服务器
bash scripts/deploy.sh production
```

## 📚 详细文档

- **完整说明**：`docs/README.md`
- **数据库配置**：`docs/MONGODB_SETUP.md`
- **配置示例**：`config/config.example.js`
- **Nginx配置**：`config/nginx.conf.example`

## 🆘 常见问题

**Q: 上传文件失败？**
A: 检查文件大小(<50MB)和格式支持

**Q: 无法连接数据库？**
A: 检查 `.env` 文件中的 `MONGODB_URI` 配置

**Q: 页面无法访问？**
A: 确保端口3000未被占用，检查防火墙设置

**Q: 服务器部署失败？**
A: 查看 `docs/README.md` 的详细部署指南

## 💡 功能特色

- 💜 **浪漫紫色主题** + 精美动画
- 📱 **完美适配** 手机/平板/电脑
- 📷 **媒体上传** 图片+音频支持
- 📲 **二维码分享** 专属回忆链接
- ☁️ **双重保障** 服务器+本地存储
- 🎨 **现代设计** 毛玻璃效果

## 🎯 技术支持

如果遇到问题，请：

1. 查看 `docs/README.md` 详细文档
2. 检查浏览器控制台错误信息
3. 查看服务器日志：`pm2 logs birthday-app`
4. 确认环境配置 `.env` 文件

---

❤️ **祝您的生日回忆册使用愉快！为爱而生的每一个功能都值得珍惜！**
