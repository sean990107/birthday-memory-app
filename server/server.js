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
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://studentcsh:csh12300..@cluster0.xk00m.mongodb.net/birthday_memories?retryWrites=true&w=majority&appName=Cluster0';

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
    type: { type: String, enum: ['image', 'audio', 'gallery'], required: true }, // 🖼️ 添加gallery类型
    mimeType: { type: String }, // gallery类型时为可选
    size: { type: Number }, // gallery类型时为可选
    filePath: { type: String }, // gallery类型时为可选
    thumbnailPath: { type: String }, // 图片缩略图路径
    
    // 🖼️ 图片组合专用字段
    images: [{
        id: String,        // 原图片的ID
        name: String,      // 图片名称
        url: String,       // 图片URL路径
        thumbnail: String  // 缩略图路径
    }],
    uploadDate: { type: Date, default: Date.now },
    metadata: {
        width: Number,
        height: Number,
        duration: Number, // 音频时长
        imageCount: Number // 🖼️ 图片组合中的图片数量
    }
}, {
    timestamps: true,
    collection: 'memories' // 确保集合名称正确
});

const Memory = mongoose.model('Memory', memorySchema);

// File模型（用于临时文件存储）
const fileSchema = new mongoose.Schema({
    id: { type: String, unique: true, required: true },
    originalName: { type: String, required: true },
    displayName: { type: String },
    filePath: { type: String, required: true },
    thumbnailPath: { type: String },
    size: { type: Number, required: true },
    mimeType: { type: String, required: true },
    uploadDate: { type: Date, default: Date.now },
    metadata: {
        width: Number,
        height: Number,
        format: String
    }
}, {
    timestamps: true,
    collection: 'files'
});

const File = mongoose.model('File', fileSchema);

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
        
        // 为老数据动态添加缩略图字段
        const processedMemories = memories.map(memory => {
            if (memory.type === 'gallery' && memory.images && memory.images.length > 0) {
                memory.images = memory.images.map(img => ({
                    ...img.toObject(),
                    thumbnail: img.thumbnail || `/api/file/${img.id}?thumb=true`
                }));
            }
            return memory;
        });
        
        res.json({
            success: true,
            data: processedMemories
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
        
        // 为老数据动态添加缩略图字段
        if (memory.type === 'gallery' && memory.images && memory.images.length > 0) {
            memory.images = memory.images.map(img => ({
                ...img.toObject(),
                thumbnail: img.thumbnail || `/api/file/${img.id}?thumb=true`
            }));
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
// 🆕 只上传文件，不创建记忆（用于图片组合）
app.post('/api/upload-files-only', uploadLimiter, upload.array('files', 10), async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({
                success: false,
                message: '没有上传文件'
            });
        }

        const uploadedFiles = [];

        for (const file of req.files) {
            const fileId = uuidv4();
            const type = file.mimetype.startsWith('image/') ? 'image' : 'audio';
            
            let thumbnailPath = null;
            let metadata = {};

            // 为图片生成缩略图
            if (type === 'image') {
                try {
                    const thumbnailFilename = `thumb_${path.basename(file.path)}`;
                    thumbnailPath = path.join(path.dirname(file.path), thumbnailFilename);
                    
                    await sharp(file.path)
                        .resize(300, 300, { 
                            fit: 'inside', 
                            withoutEnlargement: true 
                        })
                        .jpeg({ quality: 85 })
                        .toFile(thumbnailPath);
                    
                    console.log(`✅ 生成缩略图: ${thumbnailPath}`);
                    
                    // 获取图片元数据
                    const imageMetadata = await sharp(file.path).metadata();
                    metadata = {
                        width: imageMetadata.width,
                        height: imageMetadata.height,
                        format: imageMetadata.format
                    };
                } catch (error) {
                    console.error(`❌ 缩略图生成失败 ${file.path}:`, error);
                }
            }

            // 只返回文件信息，不创建记忆记录
            const fileInfo = {
                id: fileId,
                originalName: file.originalname,
                filePath: file.path,
                thumbnailPath,
                size: file.size,
                mimeType: file.mimetype,
                type,
                metadata
            };

            // 临时存储文件信息（用于后续创建图片组合时使用）
            await File.create({
                id: fileId,
                originalName: file.originalname,
                displayName: file.originalname,
                filePath: file.path,
                thumbnailPath,
                size: file.size,
                mimeType: file.mimetype,
                uploadDate: new Date(),
                metadata
            });

            uploadedFiles.push(fileInfo);
        }

        console.log(`📁 成功上传${uploadedFiles.length}个文件（仅文件，未创建记忆）`);
        
        res.json({
            success: true,
            message: `成功上传 ${uploadedFiles.length} 个文件`,
            data: uploadedFiles
        });

    } catch (error) {
        console.error('❌ 文件上传失败:', error);
        res.status(500).json({
            success: false,
            message: '服务器错误: ' + error.message
        });
    }
});

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
            const oldAudioPath = path.isAbsolute(memory.audioNote) 
                ? memory.audioNote  // 兼容旧的绝对路径
                : path.join(uploadsDir, memory.audioNote);  // 新的相对路径
            await fs.remove(oldAudioPath).catch(console.error);
        }

        // 更新音频笔记路径（只存储相对路径，避免环境路径冲突）
        const relativePath = path.relative(uploadsDir, req.file.path);
        memory.audioNote = relativePath;
        await memory.save();
        
        console.log(`✅ 录音笔记上传成功: ${memory.id}, 相对路径: ${relativePath}`);

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

// 🖼️ 创建图片组合
app.post('/api/gallery', async (req, res) => {
    try {
        console.log('📸 创建图片组合请求:', req.body);
        
        const { displayName, description, images } = req.body;
        
        // 验证输入
        if (!images || !Array.isArray(images) || images.length < 2) {
            return res.status(400).json({
                success: false,
                message: '至少需要2张图片才能创建组合'
            });
        }
        
        // 验证所有图片是否存在（检查File集合中的临时文件）
        const imageIds = images.map(img => img.id);
        const existingFiles = await File.find({ 
            id: { $in: imageIds }
        });
        
        if (existingFiles.length !== imageIds.length) {
            return res.status(400).json({
                success: false,
                message: '部分图片不存在或不是有效的图片文件'
            });
        }
        
        // 创建图片组合对象
        const galleryId = uuidv4();
        const galleryData = {
            id: galleryId,
            name: displayName || `图片组合_${new Date().toLocaleDateString()}`,
            originalName: displayName || `图片组合_${new Date().toLocaleDateString()}`,
            displayName: displayName || `📸 图片组合 (${images.length}张)`,
            description: description || `包含${images.length}张精美图片的回忆集合`,
            type: 'gallery',
            images: images.map(img => ({
                id: img.id,
                name: img.name,
                url: `/api/file/${img.id}`,
                thumbnail: `/api/file/${img.id}?thumb=true`
            })),
            uploadDate: new Date(),
            metadata: {
                imageCount: images.length
            }
        };
        
        // 保存到数据库
        const gallery = new Memory(galleryData);
        await gallery.save();
        
        console.log('✅ 图片组合创建成功:', galleryId);
        
        res.json({
            success: true,
            data: gallery,
            message: `成功创建包含${images.length}张图片的组合`
        });
        
    } catch (error) {
        console.error('❌ 创建图片组合失败:', error);
        res.status(500).json({
            success: false,
            message: '创建图片组合失败: ' + error.message
        });
    }
});

// 🖼️ 更新图片组合
app.put('/api/gallery/:id', async (req, res) => {
    try {
        console.log('📸 更新图片组合请求:', req.params.id, req.body);
        
        const galleryId = req.params.id;
        const { displayName, description, images } = req.body;
        
        // 验证图片组合是否存在
        const existingGallery = await Memory.findOne({ id: galleryId, type: 'gallery' });
        if (!existingGallery) {
            return res.status(404).json({
                success: false,
                message: '图片组合不存在'
            });
        }
        
        // 验证输入
        if (!images || !Array.isArray(images) || images.length < 1) {
            return res.status(400).json({
                success: false,
                message: '图片组合至少需要1张图片'
            });
        }
        
        // 验证所有图片是否存在
        const imageIds = images.map(img => img.id);
        const existingImages = await Memory.find({ 
            id: { $in: imageIds }, 
            type: 'image' 
        });
        
        if (existingImages.length !== imageIds.length) {
            return res.status(400).json({
                success: false,
                message: '部分图片不存在或不是有效的图片文件'
            });
        }
        
        // 更新图片组合
        const updatedData = {
            displayName: displayName || existingGallery.displayName,
            description: description || existingGallery.description,
            images: images.map(img => ({
                id: img.id,
                name: img.name,
                url: `/api/file/${img.id}`,
                thumbnail: `/api/file/${img.id}?thumb=true`
            })),
            metadata: {
                imageCount: images.length
            }
        };
        
        const updatedGallery = await Memory.findOneAndUpdate(
            { id: galleryId },
            updatedData,
            { new: true }
        );
        
        console.log('✅ 图片组合更新成功:', galleryId);
        
        res.json({
            success: true,
            data: updatedGallery,
            message: `图片组合已更新，包含${images.length}张图片`
        });
        
    } catch (error) {
        console.error('❌ 更新图片组合失败:', error);
        res.status(500).json({
            success: false,
            message: '更新图片组合失败: ' + error.message
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
            const audioPath = path.isAbsolute(memory.audioNote) 
                ? memory.audioNote  // 兼容旧的绝对路径
                : path.join(uploadsDir, memory.audioNote);  // 新的相对路径
            await fs.remove(audioPath).catch(console.error);
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
        
        // 首先在Memory集合中查找
        let fileRecord = await Memory.findOne({ id: req.params.id });
        
        // 如果Memory中没有，再在File集合中查找
        if (!fileRecord) {
            fileRecord = await File.findOne({ id: req.params.id });
        }
        
        if (!fileRecord) {
            console.log(`❌ 文件不存在: ${req.params.id}`);
            return res.status(404).json({
                success: false,
                message: '文件不存在'
            });
        }

        console.log(`📂 找到记录:`, {
            id: fileRecord.id,
            filePath: fileRecord.filePath,
            originalName: fileRecord.originalName,
            displayName: fileRecord.displayName
        });

        let filePath;
        let mimeType = fileRecord.mimeType;
        
        // 根据查询参数选择文件类型
        if (req.query.type === 'audioNote') {
            if (!fileRecord.audioNote) {
                return res.status(404).json({
                    success: false,
                    message: '音频笔记不存在'
                });
            }
            // 构建完整的音频笔记路径（相对路径 + 当前环境的uploads目录）
            const audioNotePath = path.isAbsolute(fileRecord.audioNote) 
                ? fileRecord.audioNote  // 兼容旧的绝对路径数据
                : path.join(uploadsDir, fileRecord.audioNote);  // 新的相对路径数据
            
            if (!fs.existsSync(audioNotePath)) {
                console.log(`❌ 音频笔记文件不存在: ${audioNotePath}`);
                return res.status(404).json({
                    success: false,
                    message: '音频笔记文件不存在'
                });
            }
            filePath = audioNotePath;
            mimeType = 'audio/wav'; // 音频笔记默认为wav格式
        } else if (req.query.thumb && fileRecord.thumbnailPath) {
            // 检查缩略图是否存在，如果不存在则回退到原图
            if (fs.existsSync(fileRecord.thumbnailPath)) {
                filePath = fileRecord.thumbnailPath;
                mimeType = 'image/jpeg'; // 缩略图为jpeg格式
            } else {
                console.log(`⚠️  缩略图不存在，回退到原图: ${fileRecord.thumbnailPath}`);
                filePath = fileRecord.filePath;
            }
        } else {
            filePath = fileRecord.filePath;
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
            res.setHeader('Content-Disposition', `inline; filename="audio-note-${fileRecord.id}.wav"`);
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
