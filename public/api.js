// API交互模块
class MemoryAPI {
    constructor() {
        this.baseURL = window.location.origin;
        this.apiURL = `${this.baseURL}/api`;
    }

    // 获取所有回忆
    async getMemories() {
        try {
            const response = await fetch(`${this.apiURL}/memories`);
            const data = await response.json();
            
            if (!data.success) {
                throw new Error(data.message || '获取回忆失败');
            }
            
            return data.data;
        } catch (error) {
            console.error('获取回忆失败:', error);
            throw error;
        }
    }

    // 根据ID获取单个回忆
    async getMemory(id) {
        try {
            const response = await fetch(`${this.apiURL}/memories/${id}`);
            const data = await response.json();
            
            if (!data.success) {
                throw new Error(data.message || '获取回忆失败');
            }
            
            return data.data;
        } catch (error) {
            console.error('获取回忆失败:', error);
            throw error;
        }
    }

    // 上传文件
    async uploadFiles(files) {
        try {
            const formData = new FormData();
            
            for (let i = 0; i < files.length; i++) {
                formData.append('files', files[i]);
            }

            const response = await fetch(`${this.apiURL}/upload`, {
                method: 'POST',
                body: formData
            });

            const data = await response.json();
            
            if (!data.success) {
                throw new Error(data.message || '上传失败');
            }
            
            return data.data;
        } catch (error) {
            console.error('上传失败:', error);
            throw error;
        }
    }

    // 更新回忆信息
    async updateMemory(id, updates) {
        try {
            console.log('发送更新请求:', `${this.apiURL}/memories/${id}`, updates);
            
            const response = await fetch(`${this.apiURL}/memories/${id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(updates)
            });

            console.log('更新响应状态:', response.status, response.statusText);

            if (!response.ok) {
                if (response.status === 404) {
                    throw new Error('请求的资源不存在');
                } else if (response.status === 500) {
                    throw new Error('服务器内部错误');
                } else {
                    throw new Error(`HTTP错误 ${response.status}: ${response.statusText}`);
                }
            }

            const data = await response.json();
            console.log('更新响应数据:', data);
            
            if (!data.success) {
                throw new Error(data.message || '更新失败');
            }
            
            return data.data;
        } catch (error) {
            console.error('🔴 updateMemory API调用失败:', error);
            console.error('🔴 请求URL:', `${this.apiURL}/memories/${id}`);
            console.error('🔴 请求数据:', updates);
            console.error('🔴 基础URL:', this.baseURL);
            throw error;
        }
    }

    // 上传音频笔记
    async uploadAudioNote(memoryId, audioFile) {
        try {
            const formData = new FormData();
            formData.append('audioNote', audioFile);

            const response = await fetch(`${this.apiURL}/memories/${memoryId}/audio-note`, {
                method: 'POST',
                body: formData
            });

            const data = await response.json();
            
            if (!data.success) {
                throw new Error(data.message || '音频上传失败');
            }
            
            return data.data;
        } catch (error) {
            console.error('音频上传失败:', error);
            throw error;
        }
    }

    // 删除音频笔记
    async deleteAudioNote(memoryId) {
        try {
            const response = await fetch(`${this.apiURL}/memories/${memoryId}/audio-note`, {
                method: 'DELETE'
            });

            const data = await response.json();
            
            if (!data.success) {
                throw new Error(data.message || '音频删除失败');
            }
            
            return data.data;
        } catch (error) {
            console.error('音频删除失败:', error);
            throw error;
        }
    }

    // 删除回忆
    async deleteMemory(id) {
        try {
            const response = await fetch(`${this.apiURL}/memories/${id}`, {
                method: 'DELETE'
            });

            const data = await response.json();
            
            if (!data.success) {
                throw new Error(data.message || '删除失败');
            }
            
            return true;
        } catch (error) {
            console.error('删除失败:', error);
            throw error;
        }
    }

    // 获取音频笔记URL
    getAudioNoteURL(memoryId) {
        return `${this.apiURL}/file/${memoryId}?type=audioNote`;
    }

    // 获取文件URL
    getFileURL(id, thumbnail = false) {
        const params = thumbnail ? '?thumb=true' : '';
        return `${this.apiURL}/file/${id}${params}`;
    }

    // 🖼️ 创建图片组合
    async createImageGallery(galleryData) {
        try {
            console.log('创建图片组合请求:', galleryData);
            
            const response = await fetch(`${this.apiURL}/gallery`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(galleryData)
            });

            console.log('图片组合响应状态:', response.status, response.statusText);

            if (!response.ok) {
                if (response.status === 404) {
                    throw new Error('请求的API不存在');
                } else if (response.status === 500) {
                    throw new Error('服务器内部错误');
                } else {
                    throw new Error(`HTTP错误 ${response.status}: ${response.statusText}`);
                }
            }

            const data = await response.json();
            console.log('图片组合响应数据:', data);
            
            if (!data.success) {
                throw new Error(data.message || '创建图片组合失败');
            }
            
            return data.data;
        } catch (error) {
            console.error('创建图片组合失败详细:', error);
            throw error;
        }
    }

    // 🖼️ 更新图片组合
    async updateGallery(galleryId, galleryData) {
        try {
            console.log('更新图片组合请求:', galleryId, galleryData);
            
            const response = await fetch(`${this.apiURL}/gallery/${galleryId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(galleryData)
            });

            console.log('图片组合更新响应状态:', response.status, response.statusText);

            if (!response.ok) {
                if (response.status === 404) {
                    throw new Error('图片组合不存在');
                } else if (response.status === 500) {
                    throw new Error('服务器内部错误');
                } else {
                    throw new Error(`HTTP错误 ${response.status}: ${response.statusText}`);
                }
            }

            const data = await response.json();
            console.log('图片组合更新响应数据:', data);
            
            if (!data.success) {
                throw new Error(data.message || '更新图片组合失败');
            }
            
            return data.data;
        } catch (error) {
            console.error('🔴 updateGallery API调用失败:', error);
            console.error('🔴 请求URL:', `${this.apiURL}/gallery/${galleryId}`);
            console.error('🔴 请求数据:', galleryData);
            console.error('🔴 基础URL:', this.baseURL);
            throw error;
        }
    }

    // 检查服务器健康状态
    async checkHealth() {
        try {
            const response = await fetch(`${this.apiURL}/health`);
            const data = await response.json();
            return data.success;
        } catch (error) {
            console.error('健康检查失败:', error);
            return false;
        }
    }
}

// 创建全局API实例
window.memoryAPI = new MemoryAPI();
