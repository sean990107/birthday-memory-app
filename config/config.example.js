// 环境配置示例文件
// 使用时请复制为 .env 文件

module.exports = {
    // 服务器配置
    PORT: process.env.PORT || 3000,
    NODE_ENV: process.env.NODE_ENV || 'development',

    // MongoDB配置
    MONGODB_URI: process.env.MONGODB_URI || 'mongodb://localhost:27017/birthday_memories',
    
    // 如果使用MongoDB Atlas云数据库，URI格式如下：
    // MONGODB_URI: 'mongodb+srv://username:password@cluster.mongodb.net/birthday_memories',

    // 文件上传配置
    MAX_FILE_SIZE: 50 * 1024 * 1024, // 50MB
    MAX_FILES_COUNT: 10,

    // 安全配置
    RATE_LIMIT: {
        windowMs: 15 * 60 * 1000, // 15分钟
        max: 100 // 最大请求数
    },

    UPLOAD_RATE_LIMIT: {
        windowMs: 15 * 60 * 1000, // 15分钟
        max: 20 // 最大上传请求数
    },

    // CORS配置
    ALLOWED_ORIGINS: process.env.NODE_ENV === 'production' 
        ? ['https://your-domain.com'] // 替换为您的域名
        : ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:5500']
};
