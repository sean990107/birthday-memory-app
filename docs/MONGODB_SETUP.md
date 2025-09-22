# MongoDB 配置指南

本文档将帮助您为生日回忆册应用配置MongoDB数据库。

## 🚀 快速选择

### 👥 推荐方案：MongoDB Atlas (免费云数据库)
- ✅ 零配置，开箱即用
- ✅ 免费套餐512MB存储
- ✅ 自动备份和高可用
- ✅ 全球CDN加速
- ✅ 安全性高

### 🏠 自建方案：本地MongoDB
- ✅ 完全控制，无网络依赖
- ✅ 无存储限制
- ❌ 需要自己维护和备份
- ❌ 配置相对复杂

---

## 方案一：MongoDB Atlas (推荐)

### 1. 注册并创建集群

1. 访问 [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. 点击 "Try Free" 注册账号
3. 选择免费的 M0 集群
4. 选择云服务商和区域 (推荐选择离您最近的区域)
5. 集群名称可以保持默认或改为 `birthday-cluster`

### 2. 配置数据库访问

#### 设置数据库用户
1. 在 Atlas 面板中，点击 "Database Access"
2. 点击 "Add New Database User"
3. 选择 "Password" 认证方式
4. 设置用户名和密码 (例如: `birthday_user`)
5. 权限选择 "Read and write to any database"
6. 点击 "Add User"

#### 配置网络访问
1. 点击 "Network Access"
2. 点击 "Add IP Address"
3. 选择 "Allow Access from Anywhere" (0.0.0.0/0)
   - 注意：生产环境建议限制具体IP地址
4. 点击 "Confirm"

### 3. 获取连接字符串

1. 回到 "Clusters" 页面
2. 点击您的集群旁边的 "Connect" 按钮
3. 选择 "Connect your application"
4. Driver版本选择 "Node.js" 和 "4.1 or later"
5. 复制连接字符串，类似：
   ```
   mongodb+srv://birthday_user:<password>@birthday-cluster.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```
6. 将 `<password>` 替换为您设置的真实密码

### 4. 配置应用

在项目根目录创建或编辑 `.env` 文件：

```bash
PORT=3000
NODE_ENV=development

# MongoDB Atlas 连接
MONGODB_URI=mongodb+srv://birthday_user:your_password@birthday-cluster.xxxxx.mongodb.net/birthday_memories?retryWrites=true&w=majority
```

**注意：**
- 将 `your_password` 替换为真实密码
- 将 `birthday_memories` 作为数据库名称
- 连接字符串末尾添加了数据库名称

---

## 方案二：本地MongoDB

### 1. 安装MongoDB

#### Ubuntu/Debian
```bash
# 导入公钥
wget -qO - https://www.mongodb.org/static/pgp/server-6.0.asc | sudo apt-key add -

# 添加MongoDB仓库
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu focal/mongodb-org/6.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-6.0.list

# 更新包列表并安装
sudo apt-get update
sudo apt-get install -y mongodb-org

# 启动服务
sudo systemctl start mongod
sudo systemctl enable mongod
```

#### CentOS/RHEL
```bash
# 创建仓库文件
sudo tee /etc/yum.repos.d/mongodb-org-6.0.repo << EOF
[mongodb-org-6.0]
name=MongoDB Repository
baseurl=https://repo.mongodb.org/yum/redhat/\$releasever/mongodb-org/6.0/x86_64/
gpgcheck=1
enabled=1
gpgkey=https://www.mongodb.org/static/pgp/server-6.0.asc
EOF

# 安装
sudo yum install -y mongodb-org

# 启动服务
sudo systemctl start mongod
sudo systemctl enable mongod
```

#### macOS
```bash
# 使用Homebrew安装
brew tap mongodb/brew
brew install mongodb-community@6.0

# 启动服务
brew services start mongodb/brew/mongodb-community
```

#### Windows
1. 下载 [MongoDB Community Server](https://www.mongodb.com/try/download/community)
2. 运行安装程序，选择 "Complete" 安装
3. 勾选 "Install MongoDB as a Service"
4. 可选择安装 MongoDB Compass GUI工具

### 2. 验证安装

```bash
# 检查服务状态
sudo systemctl status mongod

# 连接数据库测试
mongosh
# 或者旧版本使用: mongo

# 在MongoDB shell中执行
> show dbs
> exit
```

### 3. 配置应用

在项目根目录创建或编辑 `.env` 文件：

```bash
PORT=3000
NODE_ENV=development

# 本地MongoDB连接
MONGODB_URI=mongodb://localhost:27017/birthday_memories
```

### 4. 可选：配置认证 (生产环境推荐)

```bash
# 进入MongoDB shell
mongosh

# 切换到admin数据库
use admin

# 创建管理员用户
db.createUser({
  user: "admin",
  pwd: "your_admin_password",
  roles: ["userAdminAnyDatabase", "dbAdminAnyDatabase", "readWriteAnyDatabase"]
})

# 创建应用专用用户
use birthday_memories
db.createUser({
  user: "birthday_user",
  pwd: "your_app_password",
  roles: ["readWrite"]
})
```

启用认证：
```bash
# 编辑配置文件
sudo nano /etc/mongod.conf

# 添加或修改以下配置
security:
  authorization: enabled

# 重启服务
sudo systemctl restart mongod
```

更新 `.env` 文件：
```bash
MONGODB_URI=mongodb://birthday_user:your_app_password@localhost:27017/birthday_memories
```

---

## 🔧 数据库管理

### 常用MongoDB命令

```bash
# 连接数据库
mongosh "mongodb+srv://cluster.xxxxx.mongodb.net/birthday_memories" --username birthday_user

# 查看数据库
show dbs

# 选择数据库
use birthday_memories

# 查看集合(表)
show collections

# 查看回忆数据
db.memories.find().pretty()

# 统计回忆数量
db.memories.count()

# 查看最新的5条回忆
db.memories.find().sort({createdAt: -1}).limit(5)

# 删除特定回忆 (小心使用)
db.memories.deleteOne({id: "回忆ID"})

# 备份数据库 (本地MongoDB)
mongodump --db birthday_memories --out /path/to/backup

# 恢复数据库 (本地MongoDB)
mongorestore --db birthday_memories /path/to/backup/birthday_memories
```

### MongoDB Compass (GUI工具)

推荐安装 [MongoDB Compass](https://www.mongodb.com/products/compass) 来可视化管理数据库：

1. 下载并安装 MongoDB Compass
2. 使用连接字符串连接数据库
3. 可视化查看、编辑、删除数据
4. 监控性能和索引

---

## 🛠️ 故障排除

### 常见问题

#### 1. 连接超时
```
Error: MongoServerSelectionError: connection timed out
```

**解决方案：**
- Atlas：检查网络访问设置，确保IP地址被允许
- 本地：检查MongoDB服务是否启动 `sudo systemctl status mongod`
- 检查防火墙设置

#### 2. 认证失败
```
Error: Authentication failed
```

**解决方案：**
- 检查用户名和密码是否正确
- 确认用户权限设置
- Atlas：确保连接字符串中的密码已正确替换

#### 3. 数据库无法创建
```
Error: not authorized on birthday_memories to execute command
```

**解决方案：**
- 检查用户权限，确保有 `readWrite` 权限
- Atlas：确保用户权限设置为 "Read and write to any database"

#### 4. 空间不足 (Atlas免费版)
```
Error: Quota exceeded
```

**解决方案：**
- 删除不必要的数据
- 升级到付费计划
- 考虑使用本地MongoDB

### 监控和维护

```bash
# 检查数据库大小
db.stats()

# 检查集合大小
db.memories.stats()

# 创建索引优化查询性能
db.memories.createIndex({createdAt: -1})
db.memories.createIndex({type: 1})

# 查看索引
db.memories.getIndexes()
```

---

## 📊 性能优化

### 1. 索引优化
```javascript
// 在应用启动时创建必要的索引
db.memories.createIndex({id: 1}, {unique: true})
db.memories.createIndex({uploadDate: -1})
db.memories.createIndex({type: 1})
db.memories.createIndex({size: 1})
```

### 2. 查询优化
- 使用投影只返回需要的字段
- 合理使用 limit() 和 skip()
- 避免复杂的 $where 查询

### 3. 存储优化
- 定期清理不需要的数据
- 对大文件考虑使用GridFS
- 监控存储使用情况

---

## 🔒 安全建议

1. **强密码**：使用复杂的数据库密码
2. **网络限制**：限制数据库访问IP (生产环境)
3. **定期备份**：设置自动备份策略
4. **监控访问**：启用数据库访问日志
5. **SSL连接**：生产环境启用SSL连接

---

## 🎯 总结

- **开发/测试环境**：推荐使用 MongoDB Atlas 免费版
- **生产环境**：根据需求选择 Atlas 付费版或自建MongoDB
- **个人使用**：Atlas 免费版完全够用
- **企业使用**：建议自建MongoDB集群

选择适合您需求的方案，按照上述步骤配置即可！如有问题，可以参考故障排除部分或查看MongoDB官方文档。
