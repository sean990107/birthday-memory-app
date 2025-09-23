// 全局变量
let memories = [];
let currentQRData = '';
let isConnected = false;

// DOM 加载完成后初始化
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

// 初始化应用
async function initializeApp() {
    try {
        // 加载QR配置
        loadQRConfig();
        console.log('🔧 QR配置加载完成:', qrConfig);
        
        setupEventListeners();
        setupMagicalEffects();
        createStarsBackground();
        
        // 检查服务器连接
        showLoading();
        isConnected = await memoryAPI.checkHealth();
        
        if (isConnected) {
            await loadMemoriesFromServer();
            showNotification('✅ 云端数据库连接成功！所有数据已保存到云端', 'success');
            console.log('🌐 当前使用云端存储: MongoDB + 服务器文件系统');
        } else {
            // fallback到本地存储
            memories = JSON.parse(localStorage.getItem('birthdayMemories')) || [];
            showNotification('⚠️ 无法连接云端数据库，临时使用本地存储', 'error');
            console.warn('⚠️ 当前使用本地存储fallback模式');
        }
        
        renderMemories();
    } catch (error) {
        console.error('应用初始化失败:', error);
        // fallback到本地存储
        memories = JSON.parse(localStorage.getItem('birthdayMemories')) || [];
        renderMemories();
        showNotification('❌ 云端数据库连接失败，临时使用本地存储', 'error');
        console.warn('⚠️ 应用启动失败，使用本地存储fallback模式');
    } finally {
        hideLoading();
    }
}

// 从服务器加载回忆数据
async function loadMemoriesFromServer() {
    try {
        memories = await memoryAPI.getMemories();
        console.log(`从服务器加载了 ${memories.length} 条回忆`);
    } catch (error) {
        console.error('从服务器加载数据失败:', error);
        throw error;
    }
}

// 设置事件监听器
function setupEventListeners() {
    const fileInput = document.getElementById('fileInput');
    const uploadArea = document.getElementById('uploadArea');
    const modal = document.getElementById('qrModal');
    const closeBtn = document.querySelector('.close');

    // 文件输入监听
    fileInput.addEventListener('change', handleFileSelect);

    // 拖拽上传
    setupDragAndDrop(uploadArea);

    // 模态框关闭
    closeBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', function(e) {
        if (e.target === modal) {
            closeModal();
        }
    });

    // 键盘支持
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && modal.style.display === 'block') {
            closeModal();
        }
    });
}

// 设置拖拽上传
function setupDragAndDrop(element) {
    element.addEventListener('dragover', function(e) {
        e.preventDefault();
        element.classList.add('drag-over');
    });

    element.addEventListener('dragleave', function(e) {
        e.preventDefault();
        element.classList.remove('drag-over');
    });

    element.addEventListener('drop', function(e) {
        e.preventDefault();
        element.classList.remove('drag-over');
        const files = e.dataTransfer.files;
        handleFiles(files);
    });
}

// 处理文件选择
function handleFileSelect(event) {
    const files = event.target.files;
    handleFiles(files);
}

// 处理文件上传
async function handleFiles(files) {
    if (files.length === 0) return;

    // 检查文件大小
    for (let file of files) {
        const maxSize = isConnected ? 50 * 1024 * 1024 : 10 * 1024 * 1024; // 服务器支持50MB，本地10MB
        if (file.size > maxSize) {
            const sizeText = isConnected ? '50MB' : '10MB';
            showNotification(`文件 ${file.name} 过大（超过${sizeText}），请选择较小的文件`, 'error');
            return;
        }
    }

    // 验证文件类型并分组
    const validFiles = Array.from(files).filter(file => {
        if (isValidFile(file)) {
            return true;
        } else {
            showNotification('不支持的文件类型: ' + file.name, 'error');
            return false;
        }
    });

    if (validFiles.length === 0) return;

    // 🎨 分离图片和音频文件
    const imageFiles = validFiles.filter(file => file.type.startsWith('image/'));
    const audioFiles = validFiles.filter(file => file.type.startsWith('audio/'));

    showLoading();

    try {
        if (isConnected) {
            // 🖼️ 如果上传了多张图片，直接创建图片组合
            if (imageFiles.length > 1) {
                // 只上传图片文件用于组合（不创建单独记忆）
                const galleryMemory = await createImageGallery(imageFiles);
                if (galleryMemory) {
                    memories.push(galleryMemory);
                }
                
                // 如果还有音频文件，单独上传
                if (audioFiles.length > 0) {
                    const audioMemories = await memoryAPI.uploadFiles(audioFiles);
                    memories.push(...audioMemories);
                }
            } else {
                // 单文件上传（图片或音频）
                const uploadedMemories = await memoryAPI.uploadFiles(validFiles);
                memories.push(...uploadedMemories);
            }
            
            const totalFiles = imageFiles.length + audioFiles.length;
            showEnhancedNotification(`🌐 成功上传 ${totalFiles} 个文件到云端数据库！${imageFiles.length > 1 ? '已创建图片轮播' : ''}`, 'success');
            console.log(`✅ 文件已保存到云端: MongoDB数据库 + 服务器存储`);
        } else {
            // fallback到本地存储
            for (let file of validFiles) {
                await processFileLocally(file);
            }
            showEnhancedNotification(`⚠️ 云端不可用，临时保存 ${validFiles.length} 个文件到本地`, 'info');
            console.warn('⚠️ 使用本地存储fallback，建议检查网络连接');
        }
    } catch (error) {
        console.error('文件处理错误:', error);
        showNotification('文件上传失败：' + error.message, 'error');
    }

    hideLoading();
    renderMemories();
    
    // 清空文件输入
    document.getElementById('fileInput').value = '';
}

// 验证文件类型
function isValidFile(file) {
    const validTypes = [
        'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
        'audio/mp3', 'audio/wav', 'audio/m4a', 'audio/mpeg', 'audio/ogg'
    ];
    return validTypes.includes(file.type);
}

// 处理单个文件（本地存储fallback）
async function processFileLocally(file) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        
        reader.onload = function(e) {
            const memory = {
                id: generateId(),
                name: file.name,
                originalName: file.name,
                type: file.type.startsWith('image/') ? 'image' : 'audio',
                mimeType: file.type,
                data: e.target.result, // base64 data for local storage
                uploadDate: new Date().toISOString(),
                size: file.size,
                isLocal: true // 标记为本地存储
            };
            
            memories.push(memory);
            saveMemoriesLocally();
            resolve();
        };
        
        reader.readAsDataURL(file);
    });
}

// 生成唯一ID
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// 保存到本地存储（仅用于fallback）
function saveMemoriesLocally() {
    const localMemories = memories.filter(m => m.isLocal);
    localStorage.setItem('birthdayMemories', JSON.stringify(localMemories));
}

// 渲染回忆列表
function renderMemories() {
    const grid = document.getElementById('memoriesGrid');
    
    if (memories.length === 0) {
        grid.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">💜</div>
                <h3>还没有回忆呢</h3>
                <p>上传第一张照片或音频，开始记录美好时光吧！</p>
            </div>
        `;
        return;
    }

    grid.innerHTML = memories.map(memory => createMemoryCard(memory)).join('');
}

// 🖼️ 创建图片组合回忆
async function createImageGallery(images) {
    try {
        if (images.length < 2) return null;
        
        // 判断是文件数组还是记忆对象数组
        const isFileArray = images[0] instanceof File;
        
        let imageData;
        
        if (isFileArray) {
            // 📤 先上传文件获得文件信息（但不创建单独记忆）
            const uploadedFiles = await uploadFilesOnly(images);
            imageData = uploadedFiles.map(file => ({
                id: file.id,
                name: file.originalName,
                url: memoryAPI.getFileURL(file.id),
                thumbnail: memoryAPI.getFileURL(file.id, true)
            }));
        } else {
            // 已经是记忆对象，直接使用
            imageData = images.map(img => ({
                id: img.id,
                name: img.originalName || img.name,
                url: memoryAPI.getFileURL(img.id),
                thumbnail: memoryAPI.getFileURL(img.id, true)
            }));
        }
        
        // 创建图片组合数据
        const galleryData = {
            displayName: `📸 图片组合 (${images.length}张)`,
            description: `包含${images.length}张精美图片的回忆集合`,
            images: imageData
        };
        
        // 向服务器创建图片组合
        const galleryMemory = await memoryAPI.createImageGallery(galleryData);
        console.log('✅ 图片组合创建成功:', galleryMemory);
        
        return galleryMemory;
    } catch (error) {
        console.error('❌ 创建图片组合失败:', error);
        // 如果组合创建失败，返回null，保持原始单独图片
        return null;
    }
}

// 🆕 只上传文件，不创建记忆
async function uploadFilesOnly(files) {
    try {
        const formData = new FormData();
        
        for (let i = 0; i < files.length; i++) {
            formData.append('files', files[i]);
        }
        
        // 添加参数，告诉服务器只上传文件，不创建记忆
        formData.append('createMemories', 'false');

        const response = await fetch(`${memoryAPI.apiURL}/upload-files-only`, {
            method: 'POST',
            body: formData
        });

        const data = await response.json();
        
        if (!data.success) {
            throw new Error(data.message || '文件上传失败');
        }
        
        return data.data;
    } catch (error) {
        console.error('文件上传失败:', error);
        throw error;
    }
}

// 创建回忆卡片
function createMemoryCard(memory) {
    const date = new Date(memory.uploadDate || memory.createdAt).toLocaleDateString('zh-CN');
    const sizeText = formatFileSize(memory.size);
    const displayName = memory.displayName || memory.originalName || memory.name;
    
    // 🖼️ 处理图片组合类型
    if (memory.type === 'gallery' && memory.images && memory.images.length > 0) {
        return createGalleryCard(memory);
    }
    
    // 获取预览URL
    let previewSrc = '';
    if (memory.type === 'image') {
        if (memory.isLocal && memory.data) {
            previewSrc = memory.data; // 本地base64数据
        } else if (memory.id && isConnected) {
            previewSrc = memoryAPI.getFileURL(memory.id, true); // 服务器缩略图
        }
    }
    
    const hasDescription = memory.description && memory.description.trim();
    const hasAudioNote = memory.audioNote;
    
    return `
        <div class="memory-card" data-id="${memory.id}">
            <div class="memory-preview ${memory.type}">
                ${memory.type === 'image' && previewSrc
                    ? `<img src="${previewSrc}" alt="${displayName}" loading="lazy" 
                         onerror="this.style.display='none'; this.parentElement.innerHTML='<i class=\"fas fa-image audio-icon\" style=\"opacity:0.5\"></i>';">` 
                    : `<i class="fas fa-${memory.type === 'image' ? 'image' : 'music'} audio-icon"></i>`
                }
                ${hasAudioNote ? `<div class="audio-note-indicator"><i class="fas fa-microphone"></i></div>` : ''}
            </div>
            <div class="memory-info">
                <div class="memory-title">${truncateText(displayName, 30)}</div>
                ${hasDescription ? `<div class="memory-description">${truncateText(memory.description, 50)}</div>` : ''}
                <div class="memory-date">
                    📅 ${date} • 📁 ${sizeText}
                    ${memory.isLocal ? ' • 💾 本地' : ' • ☁️ 服务器'}
                </div>
                <div class="memory-actions">
                    <button class="btn-view" onclick="viewMemory('${memory.id}')">
                        <i class="fas fa-eye"></i> 查看
                    </button>
                    <button class="btn-edit" onclick="editMemory('${memory.id}')" title="编辑描述和录音">
                        <i class="fas fa-edit"></i> 编辑
                    </button>
                    <button class="btn-qr" onclick="generateQR('${memory.id}')">
                        <i class="fas fa-qrcode"></i> 二维码
                    </button>
                    ${!memory.isLocal ? `<button class="btn-delete" onclick="deleteMemory('${memory.id}')" 
                        style="background: rgba(239, 68, 68, 0.1); color: #EF4444; border: 2px solid #EF4444; padding: 6px 12px; border-radius: 15px; font-size: 0.8rem;" title="删除回忆">
                        <i class="fas fa-trash"></i>
                    </button>` : ''}
                </div>
            </div>
        </div>
    `;
}

// 🎠 创建图片组合卡片
function createGalleryCard(memory) {
    const date = new Date(memory.uploadDate || memory.createdAt).toLocaleDateString('zh-CN');
    const displayName = memory.displayName || `图片组合 (${memory.images.length}张)`;
    const hasDescription = memory.description && memory.description.trim();
    const hasAudioNote = memory.audioNote;
    
    return `
        <div class="memory-card gallery-card" data-id="${memory.id}">
            <div class="memory-preview gallery">
                <div class="gallery-preview">
                    <div class="gallery-main-image">
                        <img src="${memory.images[0].thumbnail}" alt="${memory.images[0].name}" loading="lazy">
                        <div class="gallery-count">
                            <i class="fas fa-images"></i> ${memory.images.length}
                        </div>
                    </div>
                    <div class="gallery-thumbnails">
                        ${memory.images.slice(1, 4).map(img => 
                            `<div class="gallery-thumb">
                                <img src="${img.thumbnail}" alt="${img.name}" loading="lazy">
                            </div>`
                        ).join('')}
                        ${memory.images.length > 4 ? `<div class="gallery-more">+${memory.images.length - 4}</div>` : ''}
                    </div>
                </div>
                ${hasAudioNote ? `<div class="audio-note-indicator"><i class="fas fa-microphone"></i></div>` : ''}
            </div>
            <div class="memory-info">
                <div class="memory-title">${truncateText(displayName, 30)}</div>
                ${hasDescription ? `<div class="memory-description">${truncateText(memory.description, 50)}</div>` : ''}
                <div class="memory-date">
                    📅 ${date} • 🖼️ ${memory.images.length}张图片
                    ${memory.isLocal ? ' • 💾 本地' : ' • ☁️ 服务器'}
                </div>
                <div class="memory-actions">
                    <button class="btn-view" onclick="viewMemory('${memory.id}')">
                        <i class="fas fa-eye"></i> 查看轮播
                    </button>
                    <button class="btn-edit" onclick="editMemory('${memory.id}')" title="编辑描述和录音">
                        <i class="fas fa-edit"></i> 编辑
                    </button>
                    <button class="btn-qr" onclick="generateQR('${memory.id}')">
                        <i class="fas fa-qrcode"></i> 二维码
                    </button>
                    ${!memory.isLocal ? `<button class="btn-delete" onclick="deleteMemory('${memory.id}')" 
                        style="background: rgba(239, 68, 68, 0.1); color: #EF4444; border: 2px solid #EF4444; padding: 6px 12px; border-radius: 15px; font-size: 0.8rem;" title="删除回忆">
                        <i class="fas fa-trash"></i>
                    </button>` : ''}
                </div>
            </div>
        </div>
    `;
}

// 格式化文件大小
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// 截断文本
function truncateText(text, maxLength) {
    if (text.length <= maxLength) return text;
    return text.substr(0, maxLength) + '...';
}

// 查看回忆
function viewMemory(id) {
    const memory = memories.find(m => m.id === id);
    if (!memory) return;

    // 创建查看URL并跳转
    const viewUrl = `view.html?id=${id}`;
    
    // 在新窗口打开，提供更好的用户体验
    window.open(viewUrl, '_blank');
}

// 生成二维码
async function generateQR(id) {
    const memory = memories.find(m => m.id === id);
    if (!memory) {
        showNotification('未找到指定的回忆', 'error');
        return;
    }

    showLoading();

    try {
        // 检查QRCode库
        if (typeof QRCode === 'undefined') {
            throw new Error('QRCode库未加载，请刷新页面');
        }

        // 生成查看链接 - 使用配置的基础URL
        loadQRConfig(); // 确保加载最新配置
        const baseUrl = getQRBaseURL();
        const viewUrl = `${baseUrl}/view.html?id=${id}`;
        
        console.log('生成二维码URL:', viewUrl);
        console.log('QR配置模式:', qrConfig.mode, qrConfig.mode === 'custom' ? `自定义地址: ${qrConfig.customBaseURL}` : '自动模式');
        currentQRData = viewUrl;

        // 显示modal
        showModal();
        
        // 设置直接链接
        const directLink = document.getElementById('qrDirectLink');
        if (directLink) {
            directLink.href = viewUrl;
        }
        
        // 等待modal完全显示
        await new Promise(resolve => setTimeout(resolve, 300));
        
        // 获取canvas元素
        const canvas = document.getElementById('qrCanvas');
        if (!canvas) {
            throw new Error('未找到二维码画布元素');
        }

        // 清空canvas
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        console.log('🎯 开始生成二维码...');
        
        // 生成二维码
        await QRCode.toCanvas(canvas, viewUrl, {
            width: 256,
            margin: 2,
            color: {
                dark: '#8B5CF6',
                light: '#FFFFFF'
            }
        });

        console.log('✅ 二维码生成成功！');
        
    } catch (error) {
        console.error('❌ 二维码生成失败:', error);
        
        let errorMessage = '二维码生成失败: ';
        if (error.message.includes('未加载') || error.message.includes('库')) {
            errorMessage += '请刷新页面重新加载';
        } else if (error.message.includes('画布')) {
            errorMessage += '界面异常，请刷新页面';
        } else if (error.message.includes('网络') || error.message.includes('超时')) {
            errorMessage += '网络连接问题，请检查网络后重试';
        } else {
            errorMessage += error.message;
        }
        
        showNotification(errorMessage, 'error');
        closeModal();
    } finally {
        hideLoading();
    }
}

// 显示模态框
function showModal() {
    const modal = document.getElementById('qrModal');
    modal.style.display = 'block';
    document.body.style.overflow = 'hidden';
}

// 关闭模态框
function closeModal() {
    const modal = document.getElementById('qrModal');
    modal.style.display = 'none';
    document.body.style.overflow = 'auto';
}

// 下载二维码
function downloadQR() {
    const canvas = document.getElementById('qrCanvas');
    const link = document.createElement('a');
    link.download = `birthday-memory-qr-${Date.now()}.png`;
    link.href = canvas.toDataURL();
    link.click();
    
    showNotification('二维码已下载 💜', 'success');
}

// 显示加载动画
function showLoading() {
    const overlay = document.getElementById('loadingOverlay');
    overlay.style.display = 'flex';
}

// 隐藏加载动画
function hideLoading() {
    const overlay = document.getElementById('loadingOverlay');
    overlay.style.display = 'none';
}

// 显示通知
function showNotification(message, type = 'info') {
    // 移除现有通知
    const existingNotification = document.querySelector('.notification');
    if (existingNotification) {
        existingNotification.remove();
    }

    // 创建通知元素
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <span class="notification-icon">
                ${type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️'}
            </span>
            <span class="notification-message">${message}</span>
        </div>
    `;

    // 添加样式
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${type === 'success' ? 'linear-gradient(135deg, #10B981, #059669)' : 
                     type === 'error' ? 'linear-gradient(135deg, #EF4444, #DC2626)' : 
                     'linear-gradient(135deg, #8B5CF6, #A855F7)'};
        color: white;
        padding: 15px 20px;
        border-radius: 10px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.15);
        z-index: 10000;
        animation: slideInRight 0.3s ease-out;
        max-width: 300px;
        backdrop-filter: blur(10px);
    `;

    // 添加到页面
    document.body.appendChild(notification);

    // 自动移除
    setTimeout(() => {
        notification.style.animation = 'slideOutRight 0.3s ease-in';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 3000);
}

// 创建星空背景
function createStarsBackground() {
    // 在现有的CSS星空基础上添加一些动态星星
    const starsContainer = document.querySelector('.stars');
    
    // 添加一些随机闪烁的星星
    for (let i = 0; i < 20; i++) {
        const star = document.createElement('div');
        star.style.cssText = `
            position: absolute;
            width: 2px;
            height: 2px;
            background: white;
            border-radius: 50%;
            left: ${Math.random() * 100}%;
            top: ${Math.random() * 100}%;
            animation: twinkle ${2 + Math.random() * 3}s ease-in-out infinite alternate;
            animation-delay: ${Math.random() * 2}s;
        `;
        starsContainer.appendChild(star);
    }
}

// 添加CSS动画
const style = document.createElement('style');
style.textContent = `
@keyframes slideInRight {
    from {
        transform: translateX(100%);
        opacity: 0;
    }
    to {
        transform: translateX(0);
        opacity: 1;
    }
}

@keyframes slideOutRight {
    from {
        transform: translateX(0);
        opacity: 1;
    }
    to {
        transform: translateX(100%);
        opacity: 0;
    }
}

.notification-content {
    display: flex;
    align-items: center;
    gap: 10px;
}

.notification-icon {
    font-size: 1.2em;
}

.empty-state {
    grid-column: 1 / -1;
    text-align: center;
    padding: 60px 20px;
    color: white;
    opacity: 0.8;
}

.empty-icon {
    font-size: 4rem;
    margin-bottom: 20px;
    animation: heartBeat 2s ease-in-out infinite;
}

.empty-state h3 {
    font-size: 1.8rem;
    margin-bottom: 10px;
    font-weight: 600;
}

.empty-state p {
    font-size: 1.1rem;
    opacity: 0.8;
}
`;

document.head.appendChild(style);

// 工具函数：获取URL参数
function getUrlParameter(name) {
    name = name.replace(/[\[]/, '\\[').replace(/[\]]/, '\\]');
    const regex = new RegExp('[\\?&]' + name + '=([^&#]*)');
    const results = regex.exec(location.search);
    return results === null ? '' : decodeURIComponent(results[1].replace(/\+/g, ' '));
}

// 设置魔法效果
function setupMagicalEffects() {
    // 点击时的爱心爆炸效果
    document.addEventListener('click', createHeartBurst);
    
    // 鼠标移动时的魔法光圈
    let magicCircleTimeout;
    document.addEventListener('mousemove', function(e) {
        clearTimeout(magicCircleTimeout);
        magicCircleTimeout = setTimeout(() => {
            createMagicCircle(e.clientX, e.clientY);
        }, 100);
    });

    // 为按钮添加脉冲效果
    const buttons = document.querySelectorAll('button');
    buttons.forEach(button => {
        button.classList.add('pulse-button');
    });

    // 定期创建爱心粒子
    setInterval(createLoveParticles, 3000);
}

// 创建爱心爆炸效果
function createHeartBurst(e) {
    const burst = document.createElement('div');
    burst.className = 'heart-burst';
    burst.style.left = e.clientX + 'px';
    burst.style.top = e.clientY + 'px';

    const hearts = ['💜', '💖', '✨', '🌸', '💕'];
    
    for (let i = 0; i < 8; i++) {
        const heart = document.createElement('div');
        heart.className = 'burst-heart';
        heart.textContent = hearts[Math.floor(Math.random() * hearts.length)];
        
        const angle = (i / 8) * 2 * Math.PI;
        const distance = 50 + Math.random() * 30;
        
        heart.style.setProperty('--tx', Math.cos(angle) * distance + 'px');
        heart.style.setProperty('--ty', Math.sin(angle) * distance + 'px');
        heart.style.animationDelay = Math.random() * 0.3 + 's';
        
        burst.appendChild(heart);
    }

    document.body.appendChild(burst);
    
    setTimeout(() => {
        if (burst.parentNode) {
            burst.parentNode.removeChild(burst);
        }
    }, 1000);
}

// 创建魔法光圈
function createMagicCircle(x, y) {
    const circle = document.createElement('div');
    circle.className = 'magic-circle';
    circle.style.left = (x - 50) + 'px';
    circle.style.top = (y - 50) + 'px';
    
    document.body.appendChild(circle);
    
    setTimeout(() => {
        if (circle.parentNode) {
            circle.parentNode.removeChild(circle);
        }
    }, 600);
}

// 创建爱心粒子
function createLoveParticles() {
    const particles = ['💜', '💖', '✨', '🌸'];
    
    for (let i = 0; i < 5; i++) {
        setTimeout(() => {
            const particle = document.createElement('div');
            particle.className = 'particle';
            particle.textContent = particles[Math.floor(Math.random() * particles.length)];
            particle.style.left = Math.random() * 100 + '%';
            particle.style.animationDelay = Math.random() * 1 + 's';
            
            const container = document.querySelector('.love-particles') || createParticleContainer();
            container.appendChild(particle);
            
            setTimeout(() => {
                if (particle.parentNode) {
                    particle.parentNode.removeChild(particle);
                }
            }, 3000);
        }, i * 200);
    }
}

// 创建粒子容器
function createParticleContainer() {
    const container = document.createElement('div');
    container.className = 'love-particles';
    document.body.appendChild(container);
    return container;
}

// 创建庆祝动画
function createCelebration() {
    const celebration = document.createElement('div');
    celebration.className = 'celebration';
    
    const colors = ['#8B5CF6', '#F472B6', '#A855F7', '#EC4899'];
    
    for (let i = 0; i < 50; i++) {
        const confetti = document.createElement('div');
        confetti.className = 'confetti';
        confetti.style.left = Math.random() * 100 + '%';
        confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
        confetti.style.animationDelay = Math.random() * 3 + 's';
        confetti.style.animationDuration = (2 + Math.random()) + 's';
        
        celebration.appendChild(confetti);
    }
    
    document.body.appendChild(celebration);
    
    setTimeout(() => {
        if (celebration.parentNode) {
            celebration.parentNode.removeChild(celebration);
        }
    }, 4000);
}

// 增强的通知函数，添加庆祝效果
function showEnhancedNotification(message, type = 'info') {
    showNotification(message, type);
    
    if (type === 'success') {
        createCelebration();
    }
}

// 删除回忆
async function deleteMemory(id) {
    if (!confirm('确定要删除这个美好回忆吗？')) {
        return;
    }

    showLoading();
    try {
        if (isConnected) {
            await memoryAPI.deleteMemory(id);
            memories = memories.filter(m => m.id !== id);
            showNotification('回忆删除成功', 'success');
        } else {
            // 本地删除
            memories = memories.filter(m => m.id !== id);
            saveMemoriesLocally();
            showNotification('本地回忆删除成功', 'success');
        }
        renderMemories();
    } catch (error) {
        console.error('删除失败:', error);
        showNotification('删除失败：' + error.message, 'error');
    }
    hideLoading();
}

// 编辑相关变量
let currentEditingId = null;
let mediaRecorder = null;
let recordedChunks = [];
let recordedAudioBlob = null;

// 编辑回忆
function editMemory(id) {
    const memory = memories.find(m => m.id === id);
    if (!memory) {
        showNotification('未找到指定的回忆', 'error');
        return;
    }

    // 检查是否是服务器连接状态
    if (!isConnected) {
        showNotification('需要服务器连接才能编辑回忆', 'error');
        return;
    }

    if (memory.isLocal) {
        showNotification('本地存储的回忆暂不支持编辑，请重新上传到服务器', 'info');
        return;
    }

    currentEditingId = id;
    
    // 填充表单
    document.getElementById('editDisplayName').value = memory.displayName || memory.originalName || memory.name;
    document.getElementById('editDescription').value = memory.description || '';
    
    // 🖼️ 处理图片组合编辑
    const imageManagement = document.getElementById('imageManagement');
    if (memory.type === 'gallery' && memory.images && memory.images.length > 0) {
        imageManagement.style.display = 'block';
        renderCurrentImages(memory.images);
    } else {
        imageManagement.style.display = 'none';
    }
    
    // 重置录音状态
    resetRecording();
    
    // 显示编辑模态框
    document.getElementById('editModal').style.display = 'block';
    document.body.style.overflow = 'hidden';
}

// 关闭编辑模态框
function closeEditModal() {
    document.getElementById('editModal').style.display = 'none';
    document.body.style.overflow = 'auto';
    currentEditingId = null;
    resetRecording();
    clearImageManager();
}

// 🖼️ 图片管理功能
let currentEditingImages = [];

// 渲染当前图片列表
function renderCurrentImages(images) {
    currentEditingImages = [...images]; // 复制数组
    const container = document.getElementById('currentImages');
    
    container.innerHTML = images.map((img, index) => `
        <div class="image-item" data-index="${index}">
            <img src="${img.thumbnail}" alt="${img.name}" loading="lazy">
            <button class="delete-btn" onclick="removeImage(${index})" title="删除图片">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `).join('');
    
    console.log('🖼️ 渲染了', images.length, '张图片');
}

// 删除图片
function removeImage(index) {
    if (currentEditingImages.length <= 1) {
        showNotification('图片组合至少需要保留一张图片', 'error');
        return;
    }
    
    if (confirm('确定要删除这张图片吗？')) {
        currentEditingImages.splice(index, 1);
        renderCurrentImages(currentEditingImages);
        showNotification('图片已删除（未保存，需要点击保存按钮确认）', 'info');
    }
}

// 清空图片管理器
function clearImageManager() {
    currentEditingImages = [];
    const container = document.getElementById('currentImages');
    if (container) {
        container.innerHTML = '';
    }
    
    // 重置文件输入
    const newImageUpload = document.getElementById('newImageUpload');
    if (newImageUpload) {
        newImageUpload.value = '';
    }
}

// 重置录音状态
function resetRecording() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
    }
    
    recordedChunks = [];
    recordedAudioBlob = null;
    
    document.getElementById('recordBtn').style.display = 'inline-block';
    document.getElementById('stopRecordBtn').style.display = 'none';
    document.getElementById('playRecordBtn').style.display = 'none';
    document.getElementById('recordingStatus').textContent = '';
    document.getElementById('previewAudio').style.display = 'none';
}

// 开始录音
async function startRecording() {
    console.log('🎤 开始录音请求...');
    
    try {
        // 🔧 添加浏览器兼容性检查
        if (!navigator.mediaDevices) {
            throw new Error('您的浏览器不支持录音功能，建议使用Chrome、Firefox或Safari最新版本');
        }
        
        if (!navigator.mediaDevices.getUserMedia) {
            throw new Error('您的浏览器不支持麦克风访问，建议升级浏览器到最新版本');
        }
        
        // 检查是否在安全环境下（HTTPS 或 localhost）
        const isSecure = location.protocol === 'https:' || 
                        location.hostname === 'localhost' || 
                        location.hostname === '127.0.0.1' ||
                        location.hostname.startsWith('192.168.') ||
                        location.hostname.startsWith('10.') ||
                        location.hostname.startsWith('172.');
        
        if (!isSecure) {
            console.warn('⚠️ 非安全环境，某些浏览器可能限制录音功能');
        }
        
        console.log('🔍 请求麦克风权限...');
        document.getElementById('recordingStatus').innerHTML = '<i class="fas fa-spinner fa-spin"></i> 请求麦克风权限...';
        
        // 请求麦克风权限
        const stream = await navigator.mediaDevices.getUserMedia({ 
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
            } 
        });
        
        console.log('✅ 麦克风权限获取成功');
        console.log('🎤 音频轨道信息:', stream.getAudioTracks());
        
        // 检查MediaRecorder支持的格式
        const supportedTypes = [
            'audio/webm;codecs=opus',
            'audio/webm',
            'audio/mp4',
            'audio/wav'
        ];
        
        let selectedType = 'audio/webm';
        if (window.MediaRecorder) {
            for (const type of supportedTypes) {
                if (MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(type)) {
                    selectedType = type;
                    console.log('✅ 使用音频格式:', type);
                    break;
                }
            }
        }
        
        mediaRecorder = new MediaRecorder(stream, { 
            mimeType: selectedType 
        });
        recordedChunks = [];
        
        mediaRecorder.ondataavailable = (event) => {
            console.log('📊 录音数据块:', event.data.size, 'bytes');
            if (event.data.size > 0) {
                recordedChunks.push(event.data);
            }
        };
        
        mediaRecorder.onerror = (event) => {
            console.error('❌ MediaRecorder错误:', event.error);
            showNotification('录音过程中发生错误：' + event.error, 'error');
            document.getElementById('recordingStatus').innerHTML = '<i class="fas fa-exclamation-triangle"></i> 录音出错';
        };
        
        mediaRecorder.onstop = () => {
            console.log('⏹️ 录音停止，总数据块:', recordedChunks.length);
            
            if (recordedChunks.length === 0) {
                console.error('❌ 没有录音数据');
                document.getElementById('recordingStatus').innerHTML = '<i class="fas fa-exclamation-triangle"></i> 录音数据为空';
                showNotification('录音失败：没有录音数据', 'error');
                return;
            }
            
            recordedAudioBlob = new Blob(recordedChunks, { type: 'audio/webm' });
            console.log('✅ 录音完成，文件大小:', recordedAudioBlob.size, 'bytes');
            
            const audioUrl = URL.createObjectURL(recordedAudioBlob);
            const previewAudio = document.getElementById('previewAudio');
            previewAudio.src = audioUrl;
            previewAudio.style.display = 'block';
            
            document.getElementById('playRecordBtn').style.display = 'inline-block';
            document.getElementById('recordingStatus').innerHTML = '<i class="fas fa-check"></i> 录音完成！点击试听';
            
            showNotification('录音完成！', 'success');
            
            // 停止所有音频轨道
            stream.getTracks().forEach(track => {
                console.log('🔇 停止音频轨道:', track.label);
                track.stop();
            });
        };
        
        mediaRecorder.start();
        console.log('🔴 开始录音...');
        
        document.getElementById('recordBtn').style.display = 'none';
        document.getElementById('stopRecordBtn').style.display = 'inline-block';
        document.getElementById('recordingStatus').innerHTML = '<i class="fas fa-circle recording-dot"></i> 正在录音...';
        
        showNotification('开始录音...', 'info');
        
    } catch (error) {
        console.error('❌ 录音失败详细错误:', error);
        
        let errorMessage = '录音失败：';
        let statusMessage = '';
        
        if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
            errorMessage = '录音权限被拒绝，请在浏览器地址栏点击🔒图标，允许麦克风权限后刷新页面';
            statusMessage = '<i class="fas fa-microphone-slash"></i> 麦克风权限被拒绝';
        } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
            errorMessage = '未找到可用的麦克风设备，请检查麦克风是否连接';
            statusMessage = '<i class="fas fa-microphone-slash"></i> 未找到麦克风';
        } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
            errorMessage = '麦克风被其他应用占用，请关闭其他录音应用后重试';
            statusMessage = '<i class="fas fa-microphone-slash"></i> 麦克风被占用';
        } else if (error.name === 'OverconstrainedError' || error.name === 'ConstraintNotSatisfiedError') {
            errorMessage = '录音参数不支持，请尝试更新浏览器';
            statusMessage = '<i class="fas fa-exclamation-triangle"></i> 录音参数不支持';
        } else if (error.name === 'NotSupportedError') {
            errorMessage = '您的浏览器不支持录音功能，建议使用Chrome或Firefox';
            statusMessage = '<i class="fas fa-exclamation-circle"></i> 浏览器不支持录音';
        } else if (error.name === 'AbortError') {
            errorMessage = '录音被中断';
            statusMessage = '<i class="fas fa-stop"></i> 录音被中断';
        } else {
            // 显示真实错误信息以便调试
            errorMessage = '录音失败：' + (error.message || error.name || '未知错误');
            statusMessage = '<i class="fas fa-exclamation-triangle"></i> 录音失败';
            console.error('🔍 详细错误信息:', {
                name: error.name,
                message: error.message,
                stack: error.stack,
                navigator: !!navigator.mediaDevices,
                getUserMedia: !!navigator.mediaDevices?.getUserMedia,
                MediaRecorder: !!window.MediaRecorder
            });
        }
        
        showNotification(errorMessage, 'error');
        document.getElementById('recordingStatus').innerHTML = statusMessage;
        
        // 重置录音按钮状态
        document.getElementById('recordBtn').style.display = 'inline-block';
        document.getElementById('stopRecordBtn').style.display = 'none';
    }
}

// 停止录音
function stopRecording() {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
        
        document.getElementById('recordBtn').style.display = 'inline-block';
        document.getElementById('stopRecordBtn').style.display = 'none';
    }
}

// 播放录音
function playRecording() {
    const previewAudio = document.getElementById('previewAudio');
    if (previewAudio.src) {
        previewAudio.play();
    }
}

// 保存编辑
async function saveMemoryEdit() {
    if (!currentEditingId) {
        showNotification('编辑ID丢失，请重新编辑', 'error');
        return;
    }

    const displayName = document.getElementById('editDisplayName').value.trim();
    const description = document.getElementById('editDescription').value.trim();
    
    console.log('开始保存编辑，ID:', currentEditingId, '连接状态:', isConnected);
    
    if (!isConnected) {
        showNotification('服务器连接已断开，无法保存', 'error');
        return;
    }
    
    showLoading();
    
    try {
        // 更新基本信息
        const updates = {};
        if (displayName) updates.displayName = displayName;
        if (description) updates.description = description;
        
        console.log('更新数据:', updates);
        
        if (Object.keys(updates).length > 0) {
            const updatedMemory = await memoryAPI.updateMemory(currentEditingId, updates);
            console.log('基本信息更新成功:', updatedMemory);
        }
        
        // 🖼️ 处理图片组合变化
        const currentMemory = memories.find(m => m.id === currentEditingId);
        if (currentMemory && currentMemory.type === 'gallery' && currentEditingImages.length > 0) {
            // 检查图片是否有变化
            const originalImageIds = currentMemory.images.map(img => img.id).sort();
            const currentImageIds = currentEditingImages.map(img => img.id).sort();
            
            if (JSON.stringify(originalImageIds) !== JSON.stringify(currentImageIds)) {
                console.log('🖼️ 图片组合发生变化，更新中...');
                console.log('原始图片:', originalImageIds);
                console.log('现在图片:', currentImageIds);
                
                // 重新创建图片组合
                const galleryData = {
                    displayName: displayName || currentMemory.displayName,
                    description: description || currentMemory.description,
                    images: currentEditingImages.map(img => ({
                        id: img.id,
                        name: img.name,
                        url: `/api/file/${img.id}`,
                        thumbnail: `/api/file/${img.id}?thumb=true`
                    }))
                };
                
                await memoryAPI.updateGallery(currentEditingId, galleryData);
                console.log('✅ 图片组合更新成功');
                showNotification('图片组合已更新', 'success');
            }
        }
        
        // 上传录音笔记（如果有）
        if (recordedAudioBlob) {
            console.log('上传录音笔记...');
            console.log('录音文件信息:', {
                size: recordedAudioBlob.size,
                type: recordedAudioBlob.type
            });
            
            // 根据实际类型创建文件
            let fileName = 'audio-note.webm';
            let mimeType = recordedAudioBlob.type || 'audio/webm';
            
            if (mimeType.includes('wav')) {
                fileName = 'audio-note.wav';
            } else if (mimeType.includes('mp4')) {
                fileName = 'audio-note.mp4';
            } else if (mimeType.includes('webm')) {
                fileName = 'audio-note.webm';
            }
            
            const audioFile = new File([recordedAudioBlob], fileName, { type: mimeType });
            console.log('上传音频文件:', fileName, '大小:', audioFile.size, 'bytes');
            
            await memoryAPI.uploadAudioNote(currentEditingId, audioFile);
            console.log('录音笔记上传成功');
        }
        
        // 处理上传的音频文件
        const audioUpload = document.getElementById('audioUpload');
        if (audioUpload.files.length > 0) {
            console.log('上传音频文件...');
            await memoryAPI.uploadAudioNote(currentEditingId, audioUpload.files[0]);
            console.log('音频文件上传成功');
        }
        
        // 刷新数据
        console.log('刷新数据...');
        await loadMemoriesFromServer();
        renderMemories();
        closeEditModal();
        
        showEnhancedNotification('🌐 回忆更新成功，已保存到云端数据库！', 'success');
        console.log('✅ 编辑内容已同步到云端: MongoDB数据库 + 服务器存储');
        
    } catch (error) {
        console.error('保存失败详细错误:', error);
        let errorMessage = '保存失败：';
        
        if (error.message.includes('404')) {
            errorMessage += '回忆不存在，可能已被删除';
        } else if (error.message.includes('500')) {
            errorMessage += '服务器内部错误，请稍后重试';
        } else if (error.message.includes('Network')) {
            errorMessage += '网络连接异常，请检查网络';
        } else {
            errorMessage += error.message;
        }
        
        showNotification(errorMessage, 'error');
    } finally {
        hideLoading();
    }
}

// 处理音频文件上传
document.addEventListener('DOMContentLoaded', function() {
    console.log('✅ 页面加载完成，QRCode库状态:', typeof QRCode !== 'undefined' ? '已加载' : '未加载');
    
    // 录音按钮事件
    document.getElementById('recordBtn').addEventListener('click', startRecording);
    document.getElementById('stopRecordBtn').addEventListener('click', stopRecording);
    document.getElementById('playRecordBtn').addEventListener('click', playRecording);
    
    // 音频文件上传处理
    document.getElementById('audioUpload').addEventListener('change', function(event) {
        const file = event.target.files[0];
        if (file) {
            const audioUrl = URL.createObjectURL(file);
            const previewAudio = document.getElementById('previewAudio');
            previewAudio.src = audioUrl;
            previewAudio.style.display = 'block';
            
            document.getElementById('recordingStatus').innerHTML = '<i class="fas fa-music"></i> 音频文件已选择: ' + file.name;
        }
    });
    
    // 🖼️ 新图片上传处理
    document.getElementById('newImageUpload').addEventListener('change', async function(event) {
        const files = event.target.files;
        if (files.length === 0) return;
        
        showLoading();
        
        try {
            // 验证文件类型
            const validFiles = Array.from(files).filter(file => {
                if (file.type.startsWith('image/')) {
                    return true;
                } else {
                    showNotification('只能添加图片文件: ' + file.name, 'error');
                    return false;
                }
            });
            
            if (validFiles.length === 0) return;
            
            // 上传新图片
            const uploadedMemories = await memoryAPI.uploadFiles(validFiles);
            const newImages = uploadedMemories.filter(m => m.type === 'image').map(img => ({
                id: img.id,
                name: img.originalName || img.name,
                url: memoryAPI.getFileURL(img.id),
                thumbnail: memoryAPI.getFileURL(img.id, true)
            }));
            
            // 添加到当前编辑的图片列表
            currentEditingImages.push(...newImages);
            renderCurrentImages(currentEditingImages);
            
            showNotification(`✅ 成功添加 ${newImages.length} 张图片（未保存，需要点击保存按钮确认）`, 'success');
            
        } catch (error) {
            console.error('添加图片失败:', error);
            showNotification('添加图片失败：' + error.message, 'error');
        } finally {
            hideLoading();
            // 清空文件输入
            event.target.value = '';
        }
    });
});

// QR 配置管理
let qrConfig = {
    mode: 'auto', // 'auto' 或 'custom'
    customBaseURL: 'http://192.168.1.46:3000'
};

// 加载QR配置
function loadQRConfig() {
    const saved = localStorage.getItem('qrConfig');
    if (saved) {
        qrConfig = {...qrConfig, ...JSON.parse(saved)};
    }
}

// 保存QR配置
function saveQRConfig() {
    localStorage.setItem('qrConfig', JSON.stringify(qrConfig));
}

// 获取二维码基础URL
function getQRBaseURL() {
    if (qrConfig.mode === 'custom' && qrConfig.customBaseURL) {
        return qrConfig.customBaseURL;
    }
    return window.location.origin + window.location.pathname.replace('index.html', '').replace('/index.html', '');
}

// 设置相关函数
function showSettings() {
    loadQRConfig();
    updateSettingsDisplay();
    document.getElementById('settingsModal').style.display = 'block';
}

function closeSettings() {
    document.getElementById('settingsModal').style.display = 'none';
}

function updateSettingsDisplay() {
    // 显示当前URL
    const currentURL = window.location.href;
    document.getElementById('currentURL').textContent = currentURL;
    
    // 显示当前QR配置状态
    const qrBaseURL = getQRBaseURL();
    console.log('📱 当前QR基础URL:', qrBaseURL);
    console.log('📋 QR配置详情:', qrConfig);
    
    // 检查手机访问状态
    const mobileStatusEl = document.getElementById('mobileStatus');
    const mobileStatusTextEl = document.getElementById('mobileStatusText');
    
    if (qrBaseURL.includes('localhost') || qrBaseURL.includes('127.0.0.1')) {
        mobileStatusEl.textContent = '❌';
        mobileStatusTextEl.innerHTML = `无法扫码访问（本地地址）<br><small>当前QR地址: ${qrBaseURL}</small>`;
        mobileStatusTextEl.style.color = '#f44336';
    } else {
        mobileStatusEl.textContent = '✅';
        mobileStatusTextEl.innerHTML = `可以正常扫码访问<br><small>当前QR地址: ${qrBaseURL}</small>`;
        mobileStatusTextEl.style.color = '#4CAF50';
    }
    
    // 设置单选按钮
    document.querySelector(`input[name="urlMode"][value="${qrConfig.mode}"]`).checked = true;
    document.getElementById('customBaseURL').value = qrConfig.customBaseURL;
    toggleCustomInput();
    
    // 添加事件监听
    document.querySelectorAll('input[name="urlMode"]').forEach(radio => {
        radio.addEventListener('change', toggleCustomInput);
    });
}

function toggleCustomInput() {
    const customMode = document.querySelector('input[name="urlMode"][value="custom"]').checked;
    const customInput = document.getElementById('customUrlInput');
    customInput.style.display = customMode ? 'block' : 'none';
}

function saveSettings() {
    const urlMode = document.querySelector('input[name="urlMode"]:checked').value;
    const customBaseURL = document.getElementById('customBaseURL').value.trim();
    
    // 验证自定义URL
    if (urlMode === 'custom') {
        if (!customBaseURL) {
            showNotification('请输入自定义地址', 'error');
            return;
        }
        
        try {
            new URL(customBaseURL);
        } catch (e) {
            showNotification('请输入有效的URL地址', 'error');
            return;
        }
    }
    
    qrConfig.mode = urlMode;
    qrConfig.customBaseURL = customBaseURL;
    saveQRConfig();
    
    showNotification('✅ 设置已保存！', 'success');
    closeSettings();
}

function testQRCode() {
    const baseUrl = getQRBaseURL();
    const testId = `test-${Date.now()}`;
    const testUrl = `${baseUrl}/view.html?id=${testId}`;
    
    console.log('🧪 测试QR配置:', qrConfig);
    console.log('🔗 测试URL:', testUrl);
    
    // 显示详细的测试信息
    const testInfo = `
🧪 测试二维码配置

当前配置模式: ${qrConfig.mode === 'custom' ? '自定义地址' : '自动模式'}
${qrConfig.mode === 'custom' ? `自定义地址: ${qrConfig.customBaseURL}` : ''}

生成的二维码链接：
${testUrl}

手机扫码预期：
${baseUrl.includes('localhost') || baseUrl.includes('127.0.0.1') 
    ? '❌ 当前使用本地地址，手机可能无法访问\n建议确认自定义地址设置正确'
    : '✅ 当前地址应该支持手机扫码访问'}

提示：此测试会生成真实的二维码，请用手机扫描验证。
    `;
    
    if (confirm(testInfo + '\n\n是否继续生成测试二维码？')) {
        // 创建临时测试记忆
        const testMemory = {
            id: testId,
            name: '测试二维码',
            displayName: '🧪 测试二维码',
            description: `这是一个测试二维码，用于验证扫码功能。\n配置模式: ${qrConfig.mode}\n生成时间: ${new Date().toLocaleString()}`,
            type: 'image', // 改为image类型以便显示
            isTest: true
        };
        
        // 临时添加到memories数组开头
        memories.unshift(testMemory);
        renderMemories(); // 重新渲染以显示测试项
        
        // 立即生成二维码
        generateQR(testMemory.id);
        
        // 5秒后移除测试数据
        setTimeout(() => {
            if (memories.length > 0 && memories[0].isTest) {
                memories.shift();
                renderMemories();
                showNotification('测试数据已清理', 'info');
            }
        }, 5000);
        
        closeSettings();
        showNotification('测试二维码生成中...', 'info');
    }
}

// 导出函数供全局使用
window.viewMemory = viewMemory;
window.generateQR = generateQR;
window.downloadQR = downloadQR;
window.getUrlParameter = getUrlParameter;
window.createCelebration = createCelebration;
window.showEnhancedNotification = showEnhancedNotification;
window.deleteMemory = deleteMemory;
window.editMemory = editMemory;
window.closeEditModal = closeEditModal;
window.saveMemoryEdit = saveMemoryEdit;
window.showSettings = showSettings;
window.closeSettings = closeSettings;
window.saveSettings = saveSettings;
window.testQRCode = testQRCode;
// 🖼️ 图片管理函数
window.removeImage = removeImage;
window.renderCurrentImages = renderCurrentImages;
