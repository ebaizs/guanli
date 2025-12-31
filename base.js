// ==================== 全局配置和常量定义 ====================
const CLOUD_CONFIG = {
    // 要更改的内容如下：------------------------------------------
    GIST_ID: '2769a9e28995f23cf9be60dd8f2891ca',
    RAW_DATA_URL: 'https://gist.githubusercontent.com/ebaizs/2769a9e28995f23cf9be60dd8f2891ca/raw/my-data.json',
    RAW_USER_URL: 'https://gist.githubusercontent.com/ebaizs/2769a9e28995f23cf9be60dd8f2891ca/raw/zhanghao.js',
    
    // 文件命名约定（不要修改）
    DATA_FILES: {
        CLOUD_JSON: 'my-data.json',      // 工地数据文件
        CLOUD_JS: 'zhanghao.js',         // 权限账户文件
        LOCAL_JS: 'shuju.js',
        LOCAL_LIGHT_JS: 'shuju_light.js',
        LOCAL_ZIP_IMAGES_FOLDER: 'shuju',
        LOCAL_ZIP_LOCATION_INFO: '文件位置信息.json'
    },
    
    // 大小限制（单位：字节）
    SIZE_LIMITS: {
        GIST_MAX: 10 * 1024 * 1024,  // 10MB
        GIST_SAFE: 8 * 1024 * 1024,   // 8MB（安全余量）
        IMAGE_MAX_WIDTH: 500,         // 图片最大宽度
        IMAGE_MAX_SIZE: 50 * 1024,    // 50KB
        FILE_MAX_SIZE: 10 * 1024 * 1024 // 10MB
    },
    
    // 数据版本
    DATA_VERSION: '2.3'
};

// 全局状态变量
let GIST_CONFIG = {
    GIST_ID: CLOUD_CONFIG.GIST_ID,
    GITHUB_TOKEN: '',
    configLoaded: false
};

// 确保全局变量存在
if (typeof window.currentUser === 'undefined') window.currentUser = null;
if (typeof window.sites === 'undefined') window.sites = [];
if (typeof window.changeLog === 'undefined') window.changeLog = [];
if (typeof window.isSyncing === 'undefined') window.isSyncing = false;
// 添加这一行，修复 currentSiteId 未定义的问题
if (typeof window.currentSiteId === 'undefined') window.currentSiteId = null;

// ==================== 图片处理函数 ====================
/**
 * 压缩图片到指定宽度（最大500像素）
 * @param {string|File} source - 图片源（base64 URL 或 File 对象）
 * @param {number} maxWidth - 最大宽度（默认500）
 * @returns {Promise<string>} 压缩后的base64 URL
 */
async function compressImageToSize(source, maxWidth = CLOUD_CONFIG.SIZE_LIMITS.IMAGE_MAX_WIDTH) {
    return new Promise((resolve, reject) => {
        // 如果已经是base64，直接处理
        if (typeof source === 'string' && source.startsWith('data:')) {
            processImage(source);
            return;
        }
        
        // 如果是File对象，先转为base64
        if (source instanceof File) {
            const reader = new FileReader();
            reader.onload = function(e) {
                processImage(e.target.result);
            };
            reader.onerror = reject;
            reader.readAsDataURL(source);
            return;
        }
        
        // 处理图片压缩
        function processImage(dataUrl) {
            const img = new Image();
            img.onload = function() {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                
                // 计算新尺寸
                let width = img.width;
                let height = img.height;
                
                if (width > maxWidth) {
                    height = Math.round((height * maxWidth) / width);
                    width = maxWidth;
                }
                
                canvas.width = width;
                canvas.height = height;
                
                // 绘制图片
                ctx.drawImage(img, 0, 0, width, height);
                
                // 根据MIME类型输出
                const mimeType = dataUrl.split(';')[0].split(':')[1] || 'image/jpeg';
                
                if (mimeType === 'image/jpeg' || mimeType === 'image/webp') {
                    resolve(canvas.toDataURL(mimeType, 0.6));
                } else if (mimeType === 'image/png') {
                    resolve(canvas.toDataURL('image/png'));
                } else {
                    resolve(canvas.toDataURL('image/jpeg', 0.6));
                }
            };
            img.onerror = reject;
            img.src = dataUrl;
        }
    });
}

/**
 * 压缩图片到50KB以下（兼容旧函数）
 */
async function compressImageTo50KB(dataUrl) {
    return compressImageToSize(dataUrl);
}

/**
 * 调整图片大小（兼容旧函数）
 */
function resizeImage(file, maxDimension, callback) {
    compressImageToSize(file, maxDimension)
        .then(callback)
        .catch(() => {
            // 如果压缩失败，尝试使用原始文件
            const reader = new FileReader();
            reader.onload = (e) => callback(e.target.result);
            reader.readAsDataURL(file);
        });
}

// ==================== 文件类型处理函数 ====================
function getMimeTypeFromFileName(fileName) {
    const ext = (fileName.split('.').pop() || '').toLowerCase();
    const mimeTypes = {
        'jpg': 'image/jpeg', 'jpeg': 'image/jpeg', 'png': 'image/png',
        'gif': 'image/gif', 'webp': 'image/webp', 'bmp': 'image/bmp',
        'pdf': 'application/pdf', 'xls': 'application/vnd.ms-excel',
        'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'doc': 'application/msword', 'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'csv': 'text/csv', 'txt': 'text/plain', 'json': 'application/json'
    };
    return mimeTypes[ext] || 'application/octet-stream';
}

function getExtensionFromMimeType(mimeType) {
    const mimeMap = {
        'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif',
        'image/webp': 'webp', 'image/bmp': 'bmp', 'application/pdf': 'pdf',
        'application/vnd.ms-excel': 'xls', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
        'application/msword': 'doc', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
        'text/csv': 'csv', 'text/plain': 'txt', 'application/json': 'json'
    };
    return mimeMap[mimeType] || 'bin';
}

function getExtensionFromFileName(fileName) {
    if (!fileName) return null;
    const parts = fileName.split('.');
    return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : null;
}

function getDrawingTypeText(type) {
    const types = { 'design': '设计图纸', 'quote': '报价表', 'other': '其他' };
    return types[type] || '未知';
}

function getFileIcon(fileType) {
    if (fileType.includes('pdf')) return '📕';
    if (fileType.includes('excel') || fileType.includes('sheet')) return '📊';
    if (fileType.includes('word')) return '📝';
    if (fileType.includes('csv')) return '📋';
    if (fileType.includes('image')) return '🖼️';
    return '📄';
}

// ==================== 数据检查函数 ====================
function checkDataSizeBeforeUpload() {
    try {
        const tempData = {
            sites: JSON.parse(JSON.stringify(window.sites || [])),
            changeLog: JSON.parse(JSON.stringify(window.changeLog || []))
        };
        
        const dataString = JSON.stringify(tempData);
        const byteSize = dataString.length;
        
        let estimatedImageSize = 0;
        let imageCount = 0;
        
        (window.sites || []).forEach(site => {
            // 统计维修图片
            if (site.repairs) {
                site.repairs.forEach(repair => {
                    if (repair.photo && repair.photo.startsWith('data:')) {
                        estimatedImageSize += repair.photo.length;
                        imageCount++;
                    }
                });
            }
            
            // 统计图纸文件
            if (site.drawings) {
                site.drawings.forEach(drawing => {
                    if (drawing.file && drawing.file.startsWith('data:')) {
                        estimatedImageSize += drawing.file.length;
                        imageCount++;
                    }
                });
            }
        });
        
        const totalSize = byteSize + estimatedImageSize;
        
        const formatSize = (bytes) => {
            if (bytes < 1024) return bytes + ' B';
            if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
            if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
            return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
        };
        
        return {
            canUpload: totalSize < CLOUD_CONFIG.SIZE_LIMITS.GIST_SAFE,
            totalSize: totalSize,
            humanSize: formatSize(totalSize),
            textSize: formatSize(byteSize),
            imageSize: formatSize(estimatedImageSize),
            imageCount: imageCount,
            warning: totalSize > 6 * 1024 * 1024 ? '数据较大，建议压缩图片' : '大小正常'
        };
        
    } catch (error) {
        console.error('检查数据大小失败:', error);
        return {
            canUpload: true,
            humanSize: '未知大小',
            warning: '无法计算数据大小'
        };
    }
}

// ==================== 数据转换函数 ====================
function formatDate(dateStr) {
    if (!dateStr) return '';
    if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
        return dateStr;
    }
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    return date.toISOString().split('T')[0];
}

function convertAllTimesToDate() {
    if (!window.sites) return;
    
    window.sites.forEach(site => {
        // 转换各种时间字段为YYYY-MM-DD格式
        const timeFields = [
            { field: 'todos', subfield: 'time' },
            { field: 'expenses', subfield: 'time' },
            { field: 'requirements', subfield: 'time' },
            { field: 'repairs', subfield: 'time' },
            { field: 'workers', subfield: ['time', 'startTime', 'endTime'] },
            { field: 'addRemoveItems', subfield: 'time' },
            { field: 'drawings', subfield: 'time' },
            { field: 'experiences', subfield: 'time' }
        ];
        
        timeFields.forEach(({ field, subfield }) => {
            if (site[field] && Array.isArray(site[field])) {
                site[field].forEach(item => {
                    if (Array.isArray(subfield)) {
                        subfield.forEach(f => {
                            if (item[f] && !item[f].match(/^\d{4}-\d{2}-\d{2}$/)) {
                                item[f] = formatDate(item[f]);
                            }
                        });
                    } else if (item[subfield] && !item[subfield].match(/^\d{4}-\d{2}-\d{2}$/)) {
                        item[subfield] = formatDate(item[subfield]);
                    }
                });
            }
        });
    });
}

// ==================== 云端数据加载函数 ====================
/**
 * 从云端加载用户数据（zhanghao.js）
 */
async function loadCloudUserData() {
    try {
        console.log('正在从云端加载用户数据:', CLOUD_CONFIG.RAW_USER_URL);
        
        const response = await fetch(CLOUD_CONFIG.RAW_USER_URL, { 
            cache: 'no-cache',
            mode: 'cors'
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const content = await response.text();
        console.log('云端用户数据加载成功，大小:', content.length);
        
        // 使用 Function 构造函数创建独立作用域
        try {
            const parseCloudData = new Function(content + '\nreturn { builtInUsers, PERMISSION_CONFIG };');
            const cloudData = parseCloudData();
            
            // 合并用户数据
            if (cloudData.builtInUsers && Array.isArray(cloudData.builtInUsers)) {
                const existingUsernames = new Set(window.builtInUsers.map(u => u.username));
                const newUsers = cloudData.builtInUsers.filter(user => 
                    user && user.username && !existingUsernames.has(user.username)
                );
                
                window.builtInUsers.push(...newUsers);
                console.log('添加了', newUsers.length, '个新用户');
                
                // 保存管理员引用
                const adminUser = newUsers.find(u => 
                    u.isAdmin === true || (window.ADMIN_USERS && window.ADMIN_USERS.includes(u.username))
                );
                if (adminUser) {
                    window.adminUser = adminUser;
                    if (!adminUser.isAdmin) adminUser.isAdmin = true;
                }
            }
            
            // 合并权限配置
            if (cloudData.PERMISSION_CONFIG && cloudData.PERMISSION_CONFIG.userPermissions) {
                for (const [username, config] of Object.entries(cloudData.PERMISSION_CONFIG.userPermissions)) {
                    if (!window.PERMISSION_CONFIG.userPermissions[username]) {
                        window.PERMISSION_CONFIG.userPermissions[username] = config;
                    }
                }
            }
            
            return true;
            
        } catch (parseError) {
            console.warn('解析云端用户数据失败:', parseError);
            showSimpleToast('云端用户数据格式不正确', 'warning');
            return false;
        }
        
    } catch (error) {
        console.warn('加载云端用户数据失败:', error);
        showSimpleToast('加载云端用户数据失败，使用本地账户', 'warning');
        return false;
    }
}

/**
 * 从云端加载工地数据（my-data.json）
 */
async function loadDataFromPublicUrl() {
    try {
        console.log('正在从公开URL加载数据:', CLOUD_CONFIG.RAW_DATA_URL);
        
        const response = await fetch(CLOUD_CONFIG.RAW_DATA_URL, { 
            cache: 'no-cache',
            mode: 'cors'
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const content = await response.text();
        console.log('云端数据加载成功，大小:', content.length);
        
        return JSON.parse(content);
        
    } catch (error) {
        console.warn('从公开URL加载数据失败:', error);
        return null;
    }
}

/**
 * 合并云端数据到本地（非覆盖）
 */
function mergeCloudData(cloudSites, cloudChangeLog) {
    let addedCount = 0;
    let updatedCount = 0;
    let imageCount = 0;
    
    // 合并工地
    cloudSites.forEach(cloudSite => {
        const existingIndex = window.sites.findIndex(s => s.id === cloudSite.id);
        
        if (existingIndex >= 0) {
            // 合并现有工地
            const existingSite = window.sites[existingIndex];
            
            // 基础信息更新
            existingSite.name = cloudSite.name || existingSite.name;
            existingSite.startDate = cloudSite.startDate || existingSite.startDate;
            existingSite.endDate = cloudSite.endDate || existingSite.endDate;
            existingSite.progress = cloudSite.progress !== undefined ? cloudSite.progress : existingSite.progress;
            
            // 合并数组数据
            ['todos', 'expenses', 'requirements', 'repairs', 'workers', 
             'addRemoveItems', 'drawings', 'experiences'].forEach(arrayField => {
                if (cloudSite[arrayField] && Array.isArray(cloudSite[arrayField])) {
                    if (!existingSite[arrayField]) {
                        existingSite[arrayField] = [];
                    }
                    
                    const existingIds = new Set(existingSite[arrayField].map(item => item.id));
                    
                    cloudSite[arrayField].forEach(cloudItem => {
                        const existingItem = existingSite[arrayField].find(item => item.id === cloudItem.id);
                        
                        if (!existingItem) {
                            // 新项目，直接添加
                            existingSite[arrayField].push(cloudItem);
                            
                            // 统计图片
                            if (arrayField === 'repairs' && cloudItem.photo && cloudItem.photo.startsWith('data:')) {
                                imageCount++;
                            }
                            if (arrayField === 'drawings' && cloudItem.file && cloudItem.file.startsWith('data:')) {
                                imageCount++;
                            }
                        } else {
                            // 已存在项目，优先使用云端的图片数据
                            if (arrayField === 'repairs' && cloudItem.photo && cloudItem.photo.startsWith('data:')) {
                                existingItem.photo = cloudItem.photo;
                                existingItem.photoName = cloudItem.photoName;
                                imageCount++;
                            }
                            if (arrayField === 'drawings' && cloudItem.file && cloudItem.file.startsWith('data:')) {
                                existingItem.file = cloudItem.file;
                                existingItem.fileName = cloudItem.fileName;
                                imageCount++;
                            }
                        }
                    });
                }
            });
            
            updatedCount++;
        } else {
            // 添加新工地
            window.sites.push(cloudSite);
            addedCount++;
            
            // 统计新工地中的图片数量
            if (cloudSite.repairs) {
                cloudSite.repairs.forEach(repair => {
                    if (repair.photo && repair.photo.startsWith('data:')) {
                        imageCount++;
                    }
                });
            }
            if (cloudSite.drawings) {
                cloudSite.drawings.forEach(drawing => {
                    if (drawing.file && drawing.file.startsWith('data:')) {
                        imageCount++;
                    }
                });
            }
        }
    });
    
    // 合并更改日志
    const existingLogKeys = new Set(window.changeLog.map(log => `${log.timestamp}-${log.user}-${log.action}`));
    cloudChangeLog.forEach(log => {
        const logKey = `${log.timestamp}-${log.user}-${log.action}`;
        if (!existingLogKeys.has(logKey)) {
            window.changeLog.unshift(log);
            existingLogKeys.add(logKey);
        }
    });
    
    // 限制日志数量
    if (window.changeLog.length > 1000) {
        window.changeLog = window.changeLog.slice(0, 1000);
    }
    
    console.log(`数据合并完成: 新增工地 ${addedCount}, 更新工地 ${updatedCount}, 包含图片 ${imageCount} 个`);
    return { addedCount, updatedCount, imageCount };
}

// ==================== 文件数据加载函数 ====================
/**
 * 从JS文件内容加载数据
 */
async function loadFromJsContent(content) {
    try {
        // 使用 Function 构造函数解析 JS 文件内容
        const func = new Function(content + '\nreturn savedData;');
        const data = func();
        
        if (!data) {
            throw new Error('JS 文件中没有找到 savedData 变量');
        }
        
        // 覆盖现有数据
        window.sites = data.sites || [];
        window.changeLog = data.changeLog || [];
        
        convertAllTimesToDate();
        return true;
        
    } catch (error) {
        console.error('解析 JS 文件失败:', error);
        throw new Error('解析 JS 文件失败: ' + error.message);
    }
}

/**
 * 从JSON文件内容加载数据
 */
async function loadFromJsonContent(content, fileName) {
    try {
        const data = JSON.parse(content);
        
        // 覆盖现有数据
        window.sites = data.sites || [];
        window.changeLog = data.changeLog || [];
        
        convertAllTimesToDate();
        return true;
        
    } catch (error) {
        console.error('解析 JSON 文件失败:', error);
        throw new Error('解析 JSON 文件失败: ' + error.message);
    }
}
// ==================== 图片文件恢复函数 ====================
/**
 * 从ZIP包恢复图片和文件
 */
async function restoreFilesFromZip(zip) {
    console.log('开始从ZIP恢复文件...');
    
    let restoredCount = 0;
    let failedCount = 0;
    
    // 首先尝试从位置信息文件恢复
    const locationInfoFile = zip.file('文件位置信息.json');
    if (locationInfoFile) {
        try {
            const locationInfo = JSON.parse(await locationInfoFile.async('text'));
            console.log('找到位置信息文件:', locationInfo);
            
            for (const siteInfo of locationInfo.sites) {
                const site = window.sites.find(s => {
                    if (s.id === siteInfo.id) return true;
                    const siteNameNormalized = (s.name || `site_${s.id}`).replace(/[\\/:*?"<>|]/g, '_');
                    return siteNameNormalized === siteInfo.folder;
                });
                
                if (site) {
                    // 恢复维修图片
                    for (const repairInfo of siteInfo.repairs) {
                        // 修复：添加 shuju/ 前缀
                        const filePath = `shuju/${repairInfo.path}`;
                        const file = zip.file(filePath);
                        
                        if (file) {
                            try {
                                const base64 = await file.async('base64');
                                const mimeType = getMimeTypeFromFileName(repairInfo.fileName);
                                
                                // 查找对应的维修项
                                const repair = site.repairs && site.repairs.find(r => {
                                    return r.id === repairInfo.repairId ||
                                        r.content === repairInfo.repairContent ||
                                        (r.photo && r.photo.includes(repairInfo.fileName));
                                });
                                
                                if (repair) {
                                    // 压缩图片（如果是图片）
                                    if (mimeType.startsWith('image/')) {
                                        const compressedDataUrl = await compressImageTo50KB(`data:${mimeType};base64,${base64}`);
                                        repair.photo = compressedDataUrl;
                                    } else {
                                        repair.photo = `data:${mimeType};base64,${base64}`;
                                    }
                                    
                                    repair.photoName = repairInfo.fileName;
                                    console.log(`恢复维修图片: ${filePath}`);
                                    restoredCount++;
                                } else {
                                    console.warn(`未找到对应的维修项: ${repairInfo.repairContent}`);
                                    failedCount++;
                                }
                            } catch (e) {
                                console.warn('恢复维修图片失败:', e);
                                failedCount++;
                            }
                        } else {
                            console.warn(`ZIP中未找到文件: ${filePath}`);
                            failedCount++;
                        }
                    }
                    
                    // 恢复图纸文件
                    for (const drawingInfo of siteInfo.drawings) {
                        // 修复：添加 shuju/ 前缀
                        const filePath = `shuju/${drawingInfo.path}`;
                        const file = zip.file(filePath);
                        
                        if (file) {
                            try {
                                const base64 = await file.async('base64');
                                const mimeType = getMimeTypeFromFileName(drawingInfo.fileName);
                                
                                // 查找对应的图纸
                                const drawing = site.drawings && site.drawings.find(d => {
                                    return d.id === drawingInfo.drawingId ||
                                        d.fileName === drawingInfo.originalName ||
                                        (d.file && d.file.includes(drawingInfo.fileName));
                                });
                                
                                if (drawing) {
                                    drawing.file = `data:${mimeType};base64,${base64}`;
                                    drawing.fileName = drawingInfo.originalName || drawingInfo.fileName;
                                    console.log(`恢复图纸文件: ${filePath}`);
                                    restoredCount++;
                                } else {
                                    console.warn(`未找到对应的图纸: ${drawingInfo.originalName}`);
                                    failedCount++;
                                }
                            } catch (e) {
                                console.warn('恢复图纸文件失败:', e);
                                failedCount++;
                            }
                        } else {
                            console.warn(`ZIP中未找到文件: ${filePath}`);
                            failedCount++;
                        }
                    }
                } else {
                    console.warn(`未找到对应的工地: ${siteInfo.folder}`);
                }
            }
        } catch (error) {
            console.warn('解析位置信息文件失败:', error);
        }
    }
    
    // 如果没有位置信息文件，尝试按文件夹结构恢复
    if (restoredCount === 0) {
        console.log('按文件夹结构恢复文件...');
        
        const filePromises = [];
        zip.forEach((relativePath, zipEntry) => {
            if (!zipEntry.dir) {
                filePromises.push(processZipFile(zipEntry, relativePath));
            }
        });
        
        const results = await Promise.allSettled(filePromises);
        results.forEach(result => {
            if (result.status === 'fulfilled' && result.value) {
                restoredCount++;
            } else if (result.status === 'rejected') {
                failedCount++;
            }
        });
    }
    
    // 保存数据
    if (restoredCount > 0) {
        saveData();
    }
    
    console.log(`文件恢复完成: 成功 ${restoredCount} 个, 失败 ${failedCount} 个`);
    
    // 移动端刷新显示
    if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
        setTimeout(() => {
            if (currentSiteId) {
                const site = sites.find(s => s.id === currentSiteId);
                if (site) {
                    loadSiteData(site);
                    fixMobileUI();
                }
            }
        }, 100);
    }
    
    return { restoredCount, failedCount };
}

/**
 * 处理ZIP中的单个文件（按文件夹结构）
 */
async function processZipFile(zipEntry, relativePath) {
    // 修复：检查路径是否以 shuju/ 开头
    if (!relativePath.startsWith('shuju/')) {
        console.warn(`文件不在shuju文件夹内: ${relativePath}`);
        return false;
    }
    
    // 移除 shuju/ 前缀
    const pathWithoutShuju = relativePath.substring(6); // 'shuju/'.length = 6
    const pathParts = pathWithoutShuju.split('/');
    
    if (pathParts.length < 3) {
        console.warn(`路径层级不足: ${relativePath}`);
        return false;
    }
    
    const siteFolder = pathParts[0];
    const type = pathParts[1];
    const fileName = pathParts.slice(2).join('/');
    
    const site = window.sites.find(s => {
        const siteNameNormalized = (s.name || `site_${s.id}`).replace(/[\\/:*?"<>|]/g, '_');
        return siteNameNormalized === siteFolder;
    });
    
    if (!site) {
        console.warn(`未找到对应工地: ${siteFolder}`);
        return false;
    }
    
    try {
        const base64 = await zipEntry.async('base64');
        const mimeType = getMimeTypeFromFileName(fileName);
        
        if (type === 'repairs') {
            const repairIndex = extractIndexFromFileName(fileName, 'repair');
            if (repairIndex !== null && site.repairs && site.repairs[repairIndex]) {
                // 压缩图片
                if (mimeType.startsWith('image/')) {
                    const compressedDataUrl = await compressImageTo50KB(`data:${mimeType};base64,${base64}`);
                    site.repairs[repairIndex].photo = compressedDataUrl;
                } else {
                    site.repairs[repairIndex].photo = `data:${mimeType};base64,${base64}`;
                }
                site.repairs[repairIndex].photoName = fileName;
                return true;
            }
            
            // 尝试通过文件名匹配
            if (site.repairs) {
                const repair = site.repairs.find(r => {
                    return r.photo && (r.photo.includes(fileName) || r.photo.includes(siteFolder));
                });
                if (repair) {
                    if (mimeType.startsWith('image/')) {
                        const compressedDataUrl = await compressImageTo50KB(`data:${mimeType};base64,${base64}`);
                        repair.photo = compressedDataUrl;
                    } else {
                        repair.photo = `data:${mimeType};base64,${base64}`;
                    }
                    repair.photoName = fileName;
                    return true;
                }
            }
        } else if (type === 'drawings') {
            const drawingIndex = extractIndexFromFileName(fileName, 'drawing');
            if (drawingIndex !== null && site.drawings && site.drawings[drawingIndex]) {
                site.drawings[drawingIndex].file = `data:${mimeType};base64,${base64}`;
                site.drawings[drawingIndex].fileName = fileName;
                return true;
            }
            
            // 尝试通过文件名匹配
            if (site.drawings) {
                const drawing = site.drawings.find(d => {
                    return d.file && (d.file.includes(fileName) || d.file.includes(siteFolder));
                });
                if (drawing) {
                    drawing.file = `data:${mimeType};base64,${base64}`;
                    drawing.fileName = fileName;
                    return true;
                }
            }
        }
        
        console.warn(`无法匹配文件: ${relativePath}`);
        return false;
    } catch (error) {
        console.warn(`处理文件失败: ${relativePath}`, error);
        return false;
    }
}
 
function extractIndexFromFileName(fileName, prefix) {
    const regex = new RegExp(`${prefix}_(\\d+)\\.`);
    const match = fileName.match(regex);
    return match ? parseInt(match[1], 10) - 1 : null;
}

// ==================== 数据导出函数 ====================
/**
 * 移除所有base64数据，替换为路径占位符
 */
function removeAllBase64Data(sitesArray) {
    if (!sitesArray) return;
    
    sitesArray.forEach(site => {
        const siteName = (site.name || `site_${site.id}`).replace(/[\\/:*?"<>|]/g, '_');
        
        if (site.repairs) {
            site.repairs.forEach((repair, index) => {
                if (repair.photo && repair.photo.startsWith('data:')) {
                    const extension = repair.photo.match(/^data:image\/(\w+);/)?.[1] || 'jpg';
                    repair.photo = `[PHOTO:${siteName}/repairs/repair_${index + 1}.${extension}]`;
                    repair.hasPhoto = true;
                    repair.photoMissing = false;
                }
            });
        }
        
        if (site.drawings) {
            site.drawings.forEach((drawing, index) => {
                if (drawing.file && drawing.file.startsWith('data:')) {
                    const match = drawing.file.match(/^data:([^;]+);/);
                    if (match) {
                        const mimeType = match[1];
                        const extension = getExtensionFromMimeType(mimeType) || 'bin';
                        let fileName = drawing.fileName || `drawing_${index + 1}.${extension}`;
                        fileName = fileName.replace(/[\\/:*?"<>|]/g, '_');
                        drawing.file = `[FILE:${siteName}/drawings/${fileName}]`;
                        drawing.hasFile = true;
                        drawing.fileMissing = false;
                    }
                }
            });
        }
    });
}

/**
 * 生成并下载完整数据ZIP包
 */
async function generateAndDownloadZip(textData) {
    try {
        if (typeof JSZip === 'undefined') {
            alert('JSZip 库未加载，无法生成 ZIP 文件');
            return;
        }
        
        const zip = new JSZip();
        
        // 创建轻量版数据（不包含base64）
        const lightData = {
            sites: JSON.parse(JSON.stringify(textData.sites)),
            changeLog: textData.changeLog,
            exportTime: new Date().toLocaleString('zh-CN'),
            exportedBy: window.currentUser.name,
            dataVersion: CLOUD_CONFIG.DATA_VERSION,
            note: '轻量版数据（不含图片base64）'
        };
        
        // 移除所有base64数据，替换为路径占位符
        removeAllBase64Data(lightData.sites);
        
        const jsContent = `// 工地装饰管理系统轻量版数据文件
// 生成时间：${new Date().toLocaleString('zh-CN')}
// 生成用户：${window.currentUser.name}
// 数据版本：${lightData.dataVersion}
// 说明：此文件只包含路径信息，需要配合shuju文件夹中的文件使用
const savedData = ${JSON.stringify(lightData, null, 2)};`;
        
        zip.file(CLOUD_CONFIG.DATA_FILES.LOCAL_LIGHT_JS, jsContent);
        
        // 创建文件和图片文件夹结构
        const shujuFolder = zip.folder(CLOUD_CONFIG.DATA_FILES.LOCAL_ZIP_IMAGES_FOLDER);
        const locationInfo = {
            info: '图片和文件位置信息',
            generated: new Date().toLocaleString('zh-CN'),
            user: window.currentUser.name,
            totalSites: window.sites.length,
            sites: []
        };
        
        // 遍历所有工地，提取图片并保存到ZIP
        for (let i = 0; i < window.sites.length; i++) {
            const originalSite = window.sites[i];
            const lightSite = lightData.sites[i];
            const siteName = (originalSite.name || `工地_${originalSite.id}`).replace(/[\\/:*?"<>|]/g, '_');
            const siteFolder = shujuFolder.folder(siteName);
            
            const siteInfo = {
                id: originalSite.id,
                name: originalSite.name,
                folder: siteName,
                repairs: [],
                drawings: []
            };
            
            // 处理维修图片
            if (originalSite.repairs && originalSite.repairs.length > 0) {
                const repairsFolder = siteFolder.folder('repairs');
                for (let j = 0; j < originalSite.repairs.length; j++) {
                    const repair = originalSite.repairs[j];
                    const lightRepair = lightSite.repairs ? lightSite.repairs[j] : null;
                    
                    if (repair.photo && repair.photo.startsWith('data:')) {
                        const match = repair.photo.match(/^data:([^;]+);base64,(.+)$/);
                        if (match) {
                            const mimeType = match[1];
                            const base64Data = match[2];
                            const extension = getExtensionFromMimeType(mimeType) || 'jpg';
                            const fileName = `repair_${j + 1}.${extension}`;
                            
                            repairsFolder.file(fileName, base64Data, { base64: true });
                            
                            siteInfo.repairs.push({
                                index: j,
                                repairId: repair.id,
                                repairContent: repair.content,
                                fileName: fileName,
                                path: `${siteName}/repairs/${fileName}`,
                                timestamp: new Date().toISOString()
                            });
                            
                            // 更新轻量版数据的路径
                            if (lightRepair) {
                                lightRepair.photo = `[PHOTO:${siteName}/repairs/${fileName}]`;
                                lightRepair.hasPhoto = true;
                            }
                        }
                    }
                }
            }
            
            // 处理图纸文件
            if (originalSite.drawings && originalSite.drawings.length > 0) {
                const drawingsFolder = siteFolder.folder('drawings');
                for (let j = 0; j < originalSite.drawings.length; j++) {
                    const drawing = originalSite.drawings[j];
                    const lightDrawing = lightSite.drawings ? lightSite.drawings[j] : null;
                    
                    if (drawing.file && drawing.file.startsWith('data:')) {
                        const match = drawing.file.match(/^data:([^;]+);base64,(.+)$/);
                        if (match) {
                            const mimeType = match[1];
                            const base64Data = match[2];
                            const extension = getExtensionFromMimeType(mimeType) ||
                                getExtensionFromFileName(drawing.fileName) ||
                                'bin';
                            let fileName = drawing.fileName ||
                                `drawing_${j + 1}.${extension}`;
                            fileName = fileName.replace(/[\\/:*?"<>|]/g, '_');
                            
                            drawingsFolder.file(fileName, base64Data, { base64: true });
                            
                            siteInfo.drawings.push({
                                index: j,
                                drawingId: drawing.id,
                                drawingType: drawing.type,
                                fileName: fileName,
                                originalName: drawing.fileName,
                                path: `${siteName}/drawings/${fileName}`,
                                timestamp: new Date().toISOString()
                            });
                            
                            // 更新轻量版数据的路径
                            if (lightDrawing) {
                                lightDrawing.file = `[FILE:${siteName}/drawings/${fileName}]`;
                                lightDrawing.hasFile = true;
                                lightDrawing.fileName = fileName;
                            }
                        }
                    }
                }
            }
            
            if (siteInfo.repairs.length > 0 || siteInfo.drawings.length > 0) {
                locationInfo.sites.push(siteInfo);
            }
        }
        
        // 保存位置信息文件
        zip.file(CLOUD_CONFIG.DATA_FILES.LOCAL_ZIP_LOCATION_INFO, JSON.stringify(locationInfo, null, 2));
        
        // 添加README文件
        const readmeContent = `工地装饰管理系统完整数据备份包

文件结构：
├── ${CLOUD_CONFIG.DATA_FILES.LOCAL_LIGHT_JS}      # 文本数据文件（不包含base64，只含路径信息）
├── ${CLOUD_CONFIG.DATA_FILES.LOCAL_ZIP_LOCATION_INFO} # 图片和文件位置信息
└── ${CLOUD_CONFIG.DATA_FILES.LOCAL_ZIP_IMAGES_FOLDER}/ # 文件和图片文件夹
    ├── 工地1/                # 第一个工地文件夹
    │   ├── repairs/         # 维修图片
    │   └── drawings/        # 图纸文件
    ├── 工地2/
    │   ├── repairs/
    │   └── drawings/
    └── ...

恢复说明：
1. 将此ZIP包解压到网站根目录
2. 系统会自动加载 ${CLOUD_CONFIG.DATA_FILES.LOCAL_LIGHT_JS} 和对应的图片文件
3. 如需手动加载，可使用"从文件加载数据"功能

注意：此备份包中的 ${CLOUD_CONFIG.DATA_FILES.LOCAL_LIGHT_JS} 不包含图片base64数据，图片以文件形式存放在${CLOUD_CONFIG.DATA_FILES.LOCAL_ZIP_IMAGES_FOLDER}文件夹中

生成时间：${new Date().toLocaleString('zh-CN')}
生成用户：${window.currentUser.name}
数据版本：${lightData.dataVersion}`;
        
        zip.file('README_恢复说明.txt', readmeContent);
        
        // 生成并下载ZIP包
        const zipBlob = await zip.generateAsync({
            type: 'blob',
            compression: 'DEFLATE',
            compressionOptions: { level: 6 }
        });
        
        const url = URL.createObjectURL(zipBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `工地完整数据备份_${new Date().toLocaleDateString('zh-CN').replace(/\//g, '-')}_${window.currentUser.name}.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        console.log('完整数据ZIP包已生成并下载');
        
    } catch (error) {
        console.error('生成ZIP包失败:', error);
        throw new Error('生成ZIP包失败：' + error.message);
    }
}

// ==================== 工具函数 ====================
function showSimpleToast(message, type = 'info') {
    console.log(`${type}: ${message}`);
    // 可以在这里实现toast提示，暂时使用alert
    if (type === 'error') {
        alert('❌ ' + message);
    } else if (type === 'warning') {
        alert('⚠️ ' + message);
    } else if (type === 'success') {
        alert('✅ ' + message);
    } else {
        alert(message);
    }
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
/**
 * 导出纯JSON数据（包含base64图片）
 */
async function exportJsonDataWithImages() {
    try {
        console.log('开始导出JSON数据...');
        
        // 创建完整数据对象
        const fullData = {
            sites: JSON.parse(JSON.stringify(window.sites || [])),
            changeLog: window.changeLog || [],
            exportTime: new Date().toLocaleString('zh-CN'),
            exportedBy: window.currentUser?.name || 'Unknown',
            dataVersion: CLOUD_CONFIG.DATA_VERSION,
            note: '完整数据备份（包含base64图片）'
        };
        
        // 转换为JSON字符串
        const jsonString = JSON.stringify(fullData, null, 2);
        const jsonSize = jsonString.length;
        
        console.log('JSON数据大小:', (jsonSize / 1024 / 1024).toFixed(2), 'MB');
        
        // 检查大小限制
        if (jsonSize > CLOUD_CONFIG.SIZE_LIMITS.GIST_MAX) {
            const confirmLarge = confirm(
                `警告：数据大小 ${(jsonSize / 1024 / 1024).toFixed(2)}MB 超过推荐大小。\n` +
                `继续下载可能会遇到浏览器内存问题。\n` +
                `建议使用"备份完整数据ZIP"功能。\n\n` +
                `是否继续下载？`
            );
            if (!confirmLarge) return;
        }
        
        // 创建并下载JSON文件
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `工地数据_${new Date().toLocaleDateString('zh-CN').replace(/\//g, '-')}_${window.currentUser?.name || 'backup'}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        console.log('JSON数据导出完成');
        showSimpleToast('JSON数据导出成功！', 'success');
        
        return true;
        
    } catch (error) {
        console.error('导出JSON数据失败:', error);
        showSimpleToast('导出失败：' + error.message, 'error');
        return false;
    }
}

/**
 * 从JSON文件加载数据（完全覆盖）
 */
async function importJsonData(jsonFile) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onload = async function(e) {
            try {
                console.log('开始解析JSON数据...');
                const jsonData = JSON.parse(e.target.result);
                
                // 验证数据结构
                if (!jsonData.sites || !Array.isArray(jsonData.sites)) {
                    throw new Error('无效的数据格式：缺少sites数组');
                }
                
                // 覆盖现有数据
                window.sites = jsonData.sites;
                window.changeLog = jsonData.changeLog || [];
                
                // 转换所有时间格式
                convertAllTimesToDate();
                
                // 保存到本地存储
                if (typeof saveData === 'function') {
                    saveData();
                }
                
                console.log('JSON数据加载成功，工地数量:', window.sites.length);
                showSimpleToast(`成功加载 ${window.sites.length} 个工地数据`, 'success');
                
                resolve({
                    success: true,
                    siteCount: window.sites.length,
                    logCount: window.changeLog.length
                });
                
            } catch (error) {
                console.error('解析JSON数据失败:', error);
                reject(new Error('解析JSON数据失败：' + error.message));
            }
        };
        
        reader.onerror = function() {
            reject(new Error('读取文件失败'));
        };
        
        reader.readAsText(jsonFile);
    });
}

/**
 * 生成包含图片的ZIP包（轻量版，不包含base64）
 */
async function generateLightweightZip() {
    try {
        if (typeof JSZip === 'undefined') {
            throw new Error('JSZip库未加载');
        }
        
        console.log('开始生成轻量版ZIP包...');
        
        const zip = new JSZip();
        
        // 1. 创建轻量版数据（不包含base64）
        const lightData = {
            sites: JSON.parse(JSON.stringify(window.sites || [])),
            changeLog: window.changeLog || [],
            exportTime: new Date().toLocaleString('zh-CN'),
            exportedBy: window.currentUser?.name || 'Unknown',
            dataVersion: CLOUD_CONFIG.DATA_VERSION,
            note: '轻量版数据（图片以文件形式保存）',
            fileStructure: '图片文件保存在shuju文件夹中'
        };
        
        // 移除所有base64数据
        removeAllBase64Data(lightData.sites);
        
        // 2. 添加轻量版数据文件
        const jsContent = `// 工地装饰管理系统轻量版数据文件
// 生成时间：${new Date().toLocaleString('zh-CN')}
// 生成用户：${window.currentUser?.name || 'Unknown'}
// 数据版本：${lightData.dataVersion}
// 说明：此文件只包含路径信息，需要配合shuju文件夹中的文件使用

const savedData = ${JSON.stringify(lightData, null, 2)};`;
        
        zip.file('shuju_light.js', jsContent);
        
        // 3. 创建图片和文件文件夹
        const shujuFolder = zip.folder('shuju');
        const locationInfo = {
            info: '图片和文件位置信息',
            generated: new Date().toLocaleString('zh-CN'),
            user: window.currentUser?.name || 'Unknown',
            totalSites: window.sites.length,
            sites: []
        };
        
        // 4. 提取所有图片和文件到ZIP
        for (let i = 0; i < window.sites.length; i++) {
            const site = window.sites[i];
            const siteName = (site.name || `工地_${site.id}`).replace(/[\\/:*?"<>|]/g, '_');
            const siteFolder = shujuFolder.folder(siteName);
            
            const siteInfo = {
                id: site.id,
                name: site.name,
                folder: siteName,
                repairs: [],
                drawings: []
            };
            
            // 处理维修图片
            if (site.repairs && site.repairs.length > 0) {
                const repairsFolder = siteFolder.folder('repairs');
                for (let j = 0; j < site.repairs.length; j++) {
                    const repair = site.repairs[j];
                    
                    if (repair.photo && repair.photo.startsWith('data:')) {
                        const match = repair.photo.match(/^data:([^;]+);base64,(.+)$/);
                        if (match) {
                            const mimeType = match[1];
                            const base64Data = match[2];
                            const extension = getExtensionFromMimeType(mimeType) || 'jpg';
                            const fileName = `repair_${j + 1}.${extension}`;
                            
                            repairsFolder.file(fileName, base64Data, { base64: true });
                            
                            siteInfo.repairs.push({
                                index: j,
                                repairId: repair.id,
                                fileName: fileName,
                                path: `shuju/${siteName}/repairs/${fileName}`
                            });
                        }
                    }
                }
            }
            
            // 处理图纸文件
            if (site.drawings && site.drawings.length > 0) {
                const drawingsFolder = siteFolder.folder('drawings');
                for (let j = 0; j < site.drawings.length; j++) {
                    const drawing = site.drawings[j];
                    
                    if (drawing.file && drawing.file.startsWith('data:')) {
                        const match = drawing.file.match(/^data:([^;]+);base64,(.+)$/);
                        if (match) {
                            const mimeType = match[1];
                            const base64Data = match[2];
                            const extension = getExtensionFromMimeType(mimeType) ||
                                getExtensionFromFileName(drawing.fileName) ||
                                'bin';
                            let fileName = drawing.fileName ||
                                `drawing_${j + 1}.${extension}`;
                            fileName = fileName.replace(/[\\/:*?"<>|]/g, '_');
                            
                            drawingsFolder.file(fileName, base64Data, { base64: true });
                            
                            siteInfo.drawings.push({
                                index: j,
                                drawingId: drawing.id,
                                fileName: fileName,
                                path: `shuju/${siteName}/drawings/${fileName}`
                            });
                        }
                    }
                }
            }
            
            if (siteInfo.repairs.length > 0 || siteInfo.drawings.length > 0) {
                locationInfo.sites.push(siteInfo);
            }
        }
        
        // 5. 添加位置信息文件
        zip.file('文件位置信息.json', JSON.stringify(locationInfo, null, 2));
        
        // 6. 添加说明文件
        const readmeContent = `工地装饰管理系统数据备份包

文件结构：
├── shuju_light.js        # 文本数据文件（不含base64，只含路径信息）
├── 文件位置信息.json      # 图片和文件位置信息
└── shuju/                # 图片和文件文件夹
    ├── 工地1/
    │   ├── repairs/      # 维修图片
    │   └── drawings/     # 图纸文件
    ├── 工地2/
    │   ├── repairs/
    │   └── drawings/
    └── ...

恢复方法：
1. 将此ZIP包解压到网站根目录
2. 系统会自动加载shuju_light.js和对应的图片文件
3. 也可使用"从文件加载数据"功能手动加载

生成时间：${new Date().toLocaleString('zh-CN')}
生成用户：${window.currentUser?.name || 'Unknown'}`;
        
        zip.file('README_恢复说明.txt', readmeContent);
        
        // 7. 生成并下载ZIP包
        const zipBlob = await zip.generateAsync({
            type: 'blob',
            compression: 'DEFLATE',
            compressionOptions: { level: 6 }
        });
        
        const url = URL.createObjectURL(zipBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `工地数据ZIP包_${new Date().toLocaleDateString('zh-CN').replace(/\//g, '-')}_${window.currentUser?.name || 'backup'}.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        console.log('轻量版ZIP包生成完成');
        showSimpleToast('ZIP数据包生成成功！', 'success');
        
        return true;
        
    } catch (error) {
        console.error('生成ZIP包失败:', error);
        showSimpleToast('生成失败：' + error.message, 'error');
        return false;
    }
}
// ==================== 移动端适配函数 ====================
function fixMobileUI() {
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    if (!isMobile) return;
    
    console.log('检测到移动端，修复界面交互...');
    
    // 修复模态框
    const modalContent = document.querySelector('.modal-content');
    if (modalContent) {
        modalContent.style.maxHeight = '80vh';
        modalContent.style.overflowY = 'auto';
        modalContent.style.WebkitOverflowScrolling = 'touch';
    }
    
    // 修复输入框
    const inputs = document.querySelectorAll('input, select, textarea');
    inputs.forEach(input => {
        input.style.fontSize = '16px';
        input.addEventListener('focus', function () {
            setTimeout(() => {
                this.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 300);
        });
    });
    
    // 修复按钮
    const buttons = document.querySelectorAll('.btn, .action-btn');
    buttons.forEach(btn => {
        btn.style.minHeight = '44px';
        btn.style.minWidth = '44px';
        btn.style.cursor = 'pointer';
        btn.setAttribute('role', 'button');
        btn.setAttribute('aria-label', btn.textContent || '按钮');
    });
    
    // 修复表格
    const tables = document.querySelectorAll('.data-table');
    tables.forEach(table => {
        table.style.WebkitOverflowScrolling = 'touch';
        table.style.overflowX = 'auto';
    });
}

function optimizeMobileTables() {
    const tables = document.querySelectorAll('.data-table');
    if (tables.length === 0) return;
    
    tables.forEach(table => {
        table.style.tableLayout = 'fixed';
        table.style.width = '100%';
        
        const ths = table.querySelectorAll('th');
        ths.forEach(th => {
            th.style.position = 'sticky';
            th.style.top = '0';
            th.style.zIndex = '1';
            th.style.backgroundColor = '#f8f9fa';
            th.style.padding = '8px 6px';
            th.style.fontSize = '12px';
        });
        
        const tds = table.querySelectorAll('td');
        tds.forEach(td => {
            td.style.padding = '8px 6px';
            td.style.fontSize = '12px';
            td.style.lineHeight = '1.3';
            td.style.wordBreak = 'break-word';
        });
    });
}

function setupBackGestureLock() {
    let backGestureCount = 0;
    let backGestureTimer = null;
    
    history.pushState(null, null, window.location.href);
    
    window.addEventListener('popstate', function(e) {
        e.preventDefault();
        
        backGestureCount++;
        
        if (backGestureCount === 1) {
            const lockDiv = document.getElementById('backGestureLock');
            if (lockDiv) {
                lockDiv.classList.add('show');
                
                setTimeout(() => {
                    lockDiv.classList.remove('show');
                }, 3000);
            }
            
            if (backGestureTimer) clearTimeout(backGestureTimer);
            backGestureTimer = setTimeout(() => {
                backGestureCount = 0;
            }, 1000);
        } else if (backGestureCount >= 2) {
            if (confirm('确定要退出系统吗？')) {
                if (typeof logout === 'function') {
                    logout();
                } else {
                    location.reload();
                }
            } else {
                backGestureCount = 0;
            }
        }
        
        history.pushState(null, null, window.location.href);
    });
}

// ==================== 暴露全局函数 ====================
// 云端相关
window.CLOUD_CONFIG = CLOUD_CONFIG;
window.GIST_CONFIG = GIST_CONFIG;
window.loadCloudUserData = loadCloudUserData;
window.loadDataFromPublicUrl = loadDataFromPublicUrl;
window.mergeCloudData = mergeCloudData;

// 图片处理
window.compressImageToSize = compressImageToSize;
window.compressImageTo50KB = compressImageTo50KB;
window.resizeImage = resizeImage;

// 文件处理
window.getMimeTypeFromFileName = getMimeTypeFromFileName;
window.getExtensionFromMimeType = getExtensionFromMimeType;
window.getExtensionFromFileName = getExtensionFromFileName;
window.getDrawingTypeText = getDrawingTypeText;
window.getFileIcon = getFileIcon;

// 数据检查和处理
window.checkDataSizeBeforeUpload = checkDataSizeBeforeUpload;
window.formatDate = formatDate;
window.convertAllTimesToDate = convertAllTimesToDate;
window.removeAllBase64Data = removeAllBase64Data;

// 数据加载
window.loadFromJsContent = loadFromJsContent;
window.loadFromJsonContent = loadFromJsonContent;
window.restoreFilesFromZip = restoreFilesFromZip;

// 数据导出
window.generateAndDownloadZip = generateAndDownloadZip;

// 工具函数
window.showSimpleToast = showSimpleToast;
window.formatFileSize = formatFileSize;
// 暴露新的数据导出导入函数
window.exportJsonDataWithImages = exportJsonDataWithImages;
window.importJsonData = importJsonData;
window.generateLightweightZip = generateLightweightZip;
// 移动端适配
window.fixMobileUI = fixMobileUI;
window.optimizeMobileTables = optimizeMobileTables;
window.setupBackGestureLock = setupBackGestureLock;