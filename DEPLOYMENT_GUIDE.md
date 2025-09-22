# 🚀 生产服务器部署指南

## 🎯 部署概览

您的生日回忆册现已完全支持生产服务器部署！所有问题都已修复：

- ✅ **动态地址获取**：自动适配服务器域名
- ✅ **横向按钮布局**：完美的移动端体验
- ✅ **智能错误处理**：图片加载失败自动重试
- ✅ **缓存控制**：版本号防止更新问题

---

## 📋 部署前检查清单

### ✅ 本地测试
1. 访问 `http://localhost:3000/fix-test.html` 
2. 运行全部测试，确保所有项目为绿色 ✅
3. 手机访问测试按钮排版

### ✅ 数据库配置
- MongoDB Atlas 连接字符串已配置在 `.env` 文件中
- 确保数据库可从生产服务器访问

### ✅ 文件结构检查
```
birthday/
├── public/           # 前端静态文件
├── server/           # 后端服务器
├── uploads/          # 文件上传目录
├── .env             # 环境变量
└── package.json     # 项目配置
```

---

## 🖥️ 服务器部署步骤

### 1️⃣ **服务器环境准备**

```bash
# 更新系统
sudo apt update && sudo apt upgrade -y

# 安装 Node.js (推荐 18+)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# 安装 PM2 (进程管理)
sudo npm install -g pm2

# 安装 Nginx (反向代理)
sudo apt install nginx -y
```

### 2️⃣ **代码部署**

```bash
# 上传代码到服务器
cd /var/www
sudo mkdir birthday
sudo chown $USER:$USER birthday
cd birthday

# 克隆或上传您的代码到这里
# 确保包含所有文件，特别是 .env 文件

# 安装依赖
npm run install-all

# 创建上传目录
mkdir -p uploads
chmod 755 uploads
```

### 3️⃣ **环境变量配置**

编辑 `.env` 文件：

```bash
# 生产环境配置
MONGODB_URI=mongodb+srv://studentcsh:csh12300..@cluster0.xk00m.mongodb.net/birthday_memories?retryWrites=true&w=majority&appName=Cluster0
PORT=3000
NODE_ENV=production

# 可选：文件上传限制
MAX_FILE_SIZE=50MB
MAX_FILES=100
```

### 4️⃣ **Nginx 配置**

创建 `/etc/nginx/sites-available/birthday`：

```nginx
server {
    listen 80;
    server_name your-domain.com;  # 替换为您的域名
    
    # 静态文件直接提供
    location / {
        root /var/www/birthday/public;
        try_files $uri $uri/ @backend;
        index index.html;
        
        # 缓存控制
        location ~* \.(css|js|png|jpg|jpeg|gif|ico|svg)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }
    
    # API请求转发到后端
    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
    
    # 后端fallback
    location @backend {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
    
    # 文件上传限制
    client_max_body_size 100M;
    
    # 安全设置
    add_header X-Content-Type-Options nosniff;
    add_header X-Frame-Options DENY;
    add_header X-XSS-Protection "1; mode=block";
}
```

启用配置：

```bash
sudo ln -s /etc/nginx/sites-available/birthday /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 5️⃣ **启动应用**

```bash
cd /var/www/birthday

# 使用 PM2 启动
pm2 start server/server.js --name birthday-app --env production

# 设置开机自启
pm2 startup
pm2 save
```

### 6️⃣ **SSL证书配置** (推荐)

```bash
# 安装 Certbot
sudo apt install certbot python3-certbot-nginx -y

# 获取SSL证书
sudo certbot --nginx -d your-domain.com

# 自动续期
sudo crontab -e
# 添加：0 12 * * * /usr/bin/certbot renew --quiet
```

---

## 🔧 验证部署

### ✅ **访问测试**
1. **主应用**：`https://your-domain.com`
2. **测试页面**：`https://your-domain.com/fix-test.html`
3. **API健康检查**：`https://your-domain.com/api/health`

### ✅ **功能测试**
1. 上传图片/音频
2. 编辑功能（按钮应该横向排列）
3. 生成二维码（使用服务器域名）
4. 手机扫码访问

### ✅ **性能监控**

```bash
# 查看应用状态
pm2 status
pm2 logs birthday-app

# 查看服务器资源
htop
df -h

# 查看 Nginx 访问日志
sudo tail -f /var/log/nginx/access.log
```

---

## 🛠️ 常见问题排查

### ❓ **二维码扫码无法访问**
- 确保防火墙开放80/443端口
- 检查域名DNS解析是否正确
- 确认Nginx配置是否正确

### ❓ **图片无法显示**
- 检查 `uploads` 目录权限：`chmod 755 uploads`
- 确认文件路径在数据库中正确
- 查看浏览器控制台错误信息

### ❓ **按钮排版仍然有问题**
- 清除浏览器缓存
- 检查 CSS 文件版本号是否更新
- 访问 `/fix-test.html` 页面进行验证

### ❓ **文件上传失败**
- 检查磁盘空间：`df -h`
- 确认上传目录权限
- 调整Nginx文件大小限制

---

## 📊 性能优化建议

### 🚀 **缓存策略**
- 静态资源设置长期缓存
- API响应适当缓存
- 使用CDN加速图片加载

### 🗄️ **数据库优化**
- 创建必要的索引
- 定期清理过期数据
- 监控查询性能

### 📈 **服务器监控**
- 使用 `pm2 monit` 监控应用
- 设置日志轮转
- 配置报警机制

---

## 🎉 **部署完成！**

恭喜！您的浪漫生日回忆册现已成功部署到生产服务器！

**现在您的女朋友可以：**
- 📱 在任何地方访问美好回忆
- 📲 扫描二维码查看专属内容
- 💜 享受完美的移动端体验
- 🎵 播放您录制的甜蜜话语

**记住：** 定期备份数据库和上传的文件！

---

## 🆘 **需要帮助？**

如果遇到问题，请提供：
1. 错误日志：`pm2 logs birthday-app`
2. Nginx日志：`sudo tail /var/log/nginx/error.log`
3. 系统信息：`uname -a && node --version`

祝您部署顺利！💜
