#!/bin/bash

# 生日回忆册自动部署脚本
# Usage: ./deploy.sh [production|development]

set -e

# 配置变量
APP_NAME="birthday-memory-app"
APP_DIR="/var/www/birthday"
SERVER_DIR="$APP_DIR/server"
NODE_VERSION="18"
PM2_APP_NAME="birthday-app"

# 检查参数
ENVIRONMENT=${1:-development}
echo "🚀 开始部署到 $ENVIRONMENT 环境"

# 检查Node.js版本
echo "📦 检查Node.js环境..."
if ! command -v node &> /dev/null; then
    echo "❌ Node.js未安装，请先安装Node.js $NODE_VERSION"
    exit 1
fi

NODE_CURRENT=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_CURRENT" -lt "$NODE_VERSION" ]; then
    echo "⚠️ Node.js版本过低，当前版本: $NODE_CURRENT，推荐版本: $NODE_VERSION+"
fi

# 检查MongoDB
echo "🗄️ 检查MongoDB连接..."
if command -v mongosh &> /dev/null; then
    echo "✅ MongoDB客户端已安装"
elif command -v mongo &> /dev/null; then
    echo "✅ MongoDB客户端已安装 (旧版本)"
else
    echo "⚠️ MongoDB客户端未安装，请确保MongoDB服务可用"
fi

# 安装依赖
echo "📥 安装依赖包..."
cd "$SERVER_DIR"
if [ "$ENVIRONMENT" = "production" ]; then
    npm ci --only=production
else
    npm install
fi
cd ..

# 创建必要目录
echo "📁 创建目录结构..."
mkdir -p uploads/image uploads/audio
mkdir -p logs

# 环境配置检查
echo "⚙️ 检查环境配置..."
if [ ! -f .env ]; then
    if [ -f config.example.js ]; then
        echo "📋 未找到.env文件，请根据config.example.js创建配置文件"
        echo "或者复制以下内容到.env文件："
        cat << EOF

# 基础配置
PORT=3000
NODE_ENV=$ENVIRONMENT

# MongoDB配置
MONGODB_URI=mongodb://localhost:27017/birthday_memories

# 如果使用MongoDB Atlas:
# MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/birthday_memories

EOF
    fi
else
    echo "✅ 环境配置文件已存在"
fi

# 测试服务器启动
echo "🔧 测试服务器配置..."
cd "$SERVER_DIR"
timeout 10s node -e "
const app = require('./server.js');
console.log('✅ 服务器配置验证通过');
process.exit(0);
" || echo "⚠️ 服务器配置可能有问题，请检查"
cd ..

# 生产环境部署
if [ "$ENVIRONMENT" = "production" ]; then
    echo "🏗️ 生产环境部署..."
    
    # 检查PM2
    if ! command -v pm2 &> /dev/null; then
        echo "📦 安装PM2..."
        npm install -g pm2
    fi
    
    # 停止旧进程
    pm2 stop $PM2_APP_NAME 2>/dev/null || true
    
    # 启动新进程
    echo "🚀 启动应用..."
    pm2 start "$SERVER_DIR/server.js" --name $PM2_APP_NAME --env production
    
    # 保存PM2配置
    pm2 save
    
    # 设置开机启动
    pm2 startup | grep -E '^sudo' | sh || echo "⚠️ 请手动执行PM2启动命令"
    
    echo "✅ 生产环境部署完成！"
    echo "📊 应用状态："
    pm2 status
    
    echo "📱 应用访问地址："
    echo "   本地: http://localhost:$PORT"
    echo "   如果配置了域名: https://your-domain.com"
    
    echo "📋 常用命令："
    echo "   查看日志: pm2 logs $PM2_APP_NAME"
    echo "   重启应用: pm2 restart $PM2_APP_NAME"
    echo "   停止应用: pm2 stop $PM2_APP_NAME"
    
else
    echo "🔧 开发环境设置完成！"
    echo "运行以下命令启动开发服务器："
    echo "   cd server && npm run dev"
    echo ""
    echo "或直接启动："
    echo "   cd server && node server.js"
fi

# 检查防火墙设置
if command -v ufw &> /dev/null; then
    echo "🔥 检查防火墙设置..."
    if ufw status | grep -q "Status: active"; then
        if ! ufw status | grep -q "3000"; then
            echo "⚠️ 防火墙可能阻止端口3000，运行以下命令开放端口："
            echo "   sudo ufw allow 3000"
        fi
    fi
fi

# 最终检查
echo ""
echo "🎉 部署脚本执行完成！"
echo "📋 部署摘要："
echo "   - 环境: $ENVIRONMENT"
echo "   - Node.js版本: $(node -v)"
echo "   - 应用目录: $(pwd)"
echo "   - 上传目录: $(pwd)/uploads"
echo ""
echo "💡 接下来的步骤："
echo "1. 确保MongoDB服务正在运行"
echo "2. 配置.env文件 (如果还没有)"
echo "3. 启动应用并测试功能"
echo "4. 配置Nginx反向代理 (生产环境推荐)"
echo "5. 配置HTTPS证书 (生产环境推荐)"
echo ""
echo "❤️ 祝您的生日回忆册使用愉快！"
