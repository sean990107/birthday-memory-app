const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const fs = require('fs-extra');
const multer = require('multer');
const sharp = require('sharp');
const { v4: uuidv4 } = require('uuid');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/birthday_memories';

// 安全中间件
app.use(helmet({
    contentSecurityPolicy: false, // 为了支持内联样式和脚本
}));
app.use(compression());

// 速率限制
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15分钟
    max: 100, // 每个IP最多100个请求
    message: '请求过于频繁，请稍后再试'
});
app.use(limiter);

// 上传速率限制
const uploadLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15分钟
    max: 20, // 每个IP最多20个上传请求
    message: '上传过于频繁，请稍后再试'
});

// CORS配置
app.use(cors({
    origin: process.env.NODE_ENV === 'production' 
        ? ['https://your-domain.com'] // 替换为您的域名
        : ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:5500'],
    credentials: true
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// 静态文件服务
app.use(express.static(path.join(__dirname, '../public')));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// 健康检查接口（用于网络诊断）
app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        status: 'ok',
        timestamp: new Date().toISOString(),
        message: '服务器运行正常',
        port: PORT,
        mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
    });
});

// 确保上传目录存在
const uploadsDir = path.join(__dirname, '../uploads');
fs.ensureDirSync(uploadsDir);

// MongoDB连接
mongoose.connect(MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
.then(() => {
    console.log('✅ MongoDB连接成功');
})
.catch(err => {
    console.error('❌ MongoDB连接失败:', err);
    process.exit(1);
});

// Memory模型
const memorySchema = new mongoose.Schema({
    id: { type: String, unique: true, required: true },
    name: { type: String, required: true },
    originalName: { type: String, required: true },
    displayName: { type: String }, // 用户自定义显示名称
    description: { type: String, default: '' }, // 用户添加的文字描述
    audioNote: { type: String }, // 录音笔记文件路径
    type: { type: String, enum: ['image', 'audio'], required: true },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true },
    filePath: { type: String, required: true },
    thumbnailPath: { type: String }, // 图片缩略图路径
    uploadDate: { type: Date, default: Date.now },
    metadata: {
        width: Number,
        height: Number,
        duration: Number // 音频时长
    }
}, {
    timestamps: true,
    collection: 'memories' // 确保集合名称正确
});

const Memory = mongoose.model('Memory', memorySchema);

// 文件上传配置
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = path.join(uploadsDir, req.body.type || 'misc');
        fs.ensureDirSync(uploadPath);
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        const uniqueName = uuidv4() + path.extname(file.originalname);
        cb(null, uniqueName);
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 50 * 1024 * 1024, // 50MB限制
        files: 10 // 最多10个文件
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = [
            'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
            'audio/mp3', 'audio/wav', 'audio/m4a', 'audio/mpeg', 'audio/ogg', 'audio/webm', 'audio/mp4'
        ];
        
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error(`不支持的文件类型: ${file.mimetype}`), false);
        }
    }
});

// API路由

// 获取所有回忆
app.get('/api/memories', async (req, res) => {
    try {
        const memories = await Memory.find().sort({ uploadDate: -1 });
        res.json({
            success: true,
            data: memories
        });
    } catch (error) {
        console.error('获取回忆失败:', error);
        res.status(500).json({
            success: false,
            message: '获取回忆失败',
            error: error.message
        });
    }
});

// 根据ID获取单个回忆
app.get('/api/memories/:id', async (req, res) => {
    try {
        const memory = await Memory.findOne({ id: req.params.id });
        if (!memory) {
            return res.status(404).json({
                success: false,
                message: '回忆不存在'
            });
        }
        res.json({
            success: true,
            data: memory
        });
    } catch (error) {
        console.error('获取回忆失败:', error);
        res.status(500).json({
            success: false,
            message: '获取回忆失败',
            error: error.message
        });
    }
});

// 文件上传接口
app.post('/api/upload', uploadLimiter, upload.array('files', 10), async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({
                success: false,
                message: '没有上传文件'
            });
        }

        const uploadedMemories = [];

        for (const file of req.files) {
            const memoryId = uuidv4();
            const type = file.mimetype.startsWith('image/') ? 'image' : 'audio';
            
            let thumbnailPath = null;
            let metadata = {};

            // 为图片生成缩略图
            if (type === 'image') {
                try {
                    const thumbnailName = `thumb_${path.basename(file.filename)}`;
                    thumbnailPath = path.join(path.dirname(file.path), thumbnailName);
                    
                    const imageInfo = await sharp(file.path)
                        .resize(400, 400, { 
                            fit: 'inside', 
                            withoutEnlargement: true 
                        })
                        .jpeg({ quality: 80 })
                        .toFile(thumbnailPath);
                    
                    metadata.width = imageInfo.width;
                    metadata.height = imageInfo.height;
                } catch (thumbError) {
                    console.warn('缩略图生成失败:', thumbError);
                }
            }

            const memory = new Memory({
                id: memoryId,
                name: path.basename(file.filename, path.extname(file.filename)),
                originalName: Buffer.from(file.originalname, 'latin1').toString('utf8'), // 修复中文文件名
                displayName: Buffer.from(file.originalname, 'latin1').toString('utf8'), // 默认显示名称
                description: req.body.description || '', // 用户描述
                type: type,
                mimeType: file.mimetype,
                size: file.size,
                filePath: file.path,
                thumbnailPath: thumbnailPath,
                metadata: metadata
            });

            await memory.save();
            uploadedMemories.push(memory);
        }

        res.json({
            success: true,
            message: `成功上传 ${uploadedMemories.length} 个文件`,
            data: uploadedMemories
        });

    } catch (error) {
        console.error('文件上传失败:', error);
        
        // 清理已上传的文件
        if (req.files) {
            for (const file of req.files) {
                fs.remove(file.path).catch(console.error);
            }
        }

        res.status(500).json({
            success: false,
            message: '文件上传失败',
            error: error.message
        });
    }
});

// 更新回忆信息
app.put('/api/memories/:id', async (req, res) => {
    try {
        const { displayName, description } = req.body;
        const memory = await Memory.findOne({ id: req.params.id });
        
        if (!memory) {
            return res.status(404).json({
                success: false,
                message: '回忆不存在'
            });
        }

        // 更新字段
        if (displayName !== undefined) memory.displayName = displayName;
        if (description !== undefined) memory.description = description;
        
        await memory.save();

        res.json({
            success: true,
            message: '回忆更新成功',
            data: memory
        });

    } catch (error) {
        console.error('更新回忆失败:', error);
        res.status(500).json({
            success: false,
            message: '更新回忆失败',
            error: error.message
        });
    }
});

// 上传音频笔记
app.post('/api/memories/:id/audio-note', uploadLimiter, upload.single('audioNote'), async (req, res) => {
    try {
        const memory = await Memory.findOne({ id: req.params.id });
        
        if (!memory) {
            return res.status(404).json({
                success: false,
                message: '回忆不存在'
            });
        }

        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: '没有上传音频文件'
            });
        }

        // 删除旧的音频笔记
        if (memory.audioNote) {
            await fs.remove(memory.audioNote).catch(console.error);
        }

        // 更新音频笔记路径
        memory.audioNote = req.file.path;
        await memory.save();

        res.json({
            success: true,
            message: '音频笔记上传成功',
            data: memory
        });

    } catch (error) {
        console.error('音频笔记上传失败:', error);
        if (req.file) {
            await fs.remove(req.file.path).catch(console.error);
        }
        res.status(500).json({
            success: false,
            message: '音频笔记上传失败',
            error: error.message
        });
    }
});

// 删除回忆
app.delete('/api/memories/:id', async (req, res) => {
    try {
        const memory = await Memory.findOne({ id: req.params.id });
        if (!memory) {
            return res.status(404).json({
                success: false,
                message: '回忆不存在'
            });
        }

        // 删除文件
        await fs.remove(memory.filePath).catch(console.error);
        if (memory.thumbnailPath) {
            await fs.remove(memory.thumbnailPath).catch(console.error);
        }
        if (memory.audioNote) {
            await fs.remove(memory.audioNote).catch(console.error);
        }

        // 删除数据库记录
        await Memory.deleteOne({ id: req.params.id });

        res.json({
            success: true,
            message: '回忆删除成功'
        });

    } catch (error) {
        console.error('删除回忆失败:', error);
        res.status(500).json({
            success: false,
            message: '删除回忆失败',
            error: error.message
        });
    }
});

// 文件访问接口
app.get('/api/file/:id', async (req, res) => {
    try {
        console.log(`🔍 文件访问请求: ID=${req.params.id}, 查询参数:`, req.query);
        
        const memory = await Memory.findOne({ id: req.params.id });
        if (!memory) {
            console.log(`❌ 文件不存在: ${req.params.id}`);
            return res.status(404).json({
                success: false,
                message: '文件不存在'
            });
        }

        console.log(`📂 找到记录:`, {
            id: memory.id,
            filePath: memory.filePath,
            originalName: memory.originalName,
            displayName: memory.displayName
        });

        let filePath;
        let mimeType = memory.mimeType;
        
        // 根据查询参数选择文件类型
        if (req.query.type === 'audioNote') {
            if (!memory.audioNote || !fs.existsSync(memory.audioNote)) {
                return res.status(404).json({
                    success: false,
                    message: '音频笔记不存在'
                });
            }
            filePath = memory.audioNote;
            mimeType = 'audio/wav'; // 音频笔记默认为wav格式
        } else if (req.query.thumb && memory.thumbnailPath) {
            filePath = memory.thumbnailPath;
            mimeType = 'image/jpeg'; // 缩略图为jpeg格式
        } else {
            filePath = memory.filePath;
        }

        if (!fs.existsSync(filePath)) {
            console.log(`❌ 文件不存在: ${filePath}`);
            return res.status(404).json({
                success: false,
                message: '文件已被删除'
            });
        }

        console.log(`✅ 发送文件: ${filePath}, MIME: ${mimeType}`);

        // 设置正确的Content-Type和文件名
        res.setHeader('Content-Type', mimeType);
        res.setHeader('Cache-Control', 'public, max-age=31536000'); // 1年缓存
        res.setHeader('Access-Control-Allow-Origin', '*'); // 允许跨域访问
        
        // 为音频笔记设置合适的文件名
        if (req.query.type === 'audioNote') {
            res.setHeader('Content-Disposition', `inline; filename="audio-note-${memory.id}.wav"`);
        }
        
        res.sendFile(path.resolve(filePath));

    } catch (error) {
        console.error('文件访问失败:', error);
        res.status(500).json({
            success: false,
            message: '文件访问失败',
            error: error.message
        });
    }
});

// 健康检查
app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        message: '服务运行正常',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// 首页路由
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

// 查看页面路由
app.get('/view.html', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/view.html'));
});

// 错误处理中间件
app.use((error, req, res, next) => {
    console.error('服务器错误:', error);
    
    if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
                success: false,
                message: '文件过大，最大支持50MB'
            });
        }
        if (error.code === 'LIMIT_FILE_COUNT') {
            return res.status(400).json({
                success: false,
                message: '文件数量过多，最多支持10个文件'
            });
        }
    }

    res.status(500).json({
        success: false,
        message: '服务器内部错误',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
});

// 404处理
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: '请求的资源不存在'
    });
});

// 启动服务器 - 监听所有接口，允许局域网访问
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 服务器运行在端口 ${PORT}`);
    console.log(`📱 本地访问地址: http://localhost:${PORT}`);
    console.log(`🌐 局域网访问地址: http://192.168.1.46:${PORT}`);
    console.log(`📁 上传目录: ${uploadsDir}`);
    console.log(`🗄️ MongoDB URI: ${MONGODB_URI}`);
});

// 优雅关闭
process.on('SIGINT', async () => {
    console.log('\n正在关闭服务器...');
    await mongoose.connection.close();
    console.log('MongoDB连接已关闭');
    process.exit(0);
});

module.exports = app;
