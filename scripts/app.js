// ======================
// 全局状态管理
// ======================
const state = {
    isDrawing: false,
    backupImage: null,
    lastScore: null,
    initialScore: null,
    ctx: null,
    sampleCtx: null,
    sampleData: null,
    imageScale: 1,
    startPoint: null,
    startMode: 'random',
    activeColorFit: false,
    thumbnails: {}, // 存储缩略图
    lastSimilarityPercentage: 0,
    hasProgressImage: false,
    thumbnailStates: {} // 记录每个缩略图区间是否已更新
};

function initThumbnails() {
    const grid = document.getElementById('thumbnailGrid');
    grid.innerHTML = '';
    
    const ranges = [
        { min: 10, max: 20 }, { min: 20, max: 30 }, { min: 30, max: 40 },
        { min: 40, max: 50 }, { min: 50, max: 60 }, { min: 60, max: 70 },
        { min: 70, max: 80 }, { min: 80, max: 90 }, { min: 90, max: 100 }
    ];
    
    ranges.forEach(range => {
        const item = document.createElement('div');
        item.className = 'thumbnail-item';
        item.dataset.range = `${range.min}-${range.max}`;
        
        const label = document.createElement('div');
        label.className = 'thumbnail-label';
        label.textContent = `${range.min}%-${range.max}%`;
        
        const canvas = document.createElement('canvas');
        canvas.className = 'thumbnail-canvas';
        
        item.appendChild(canvas);
        item.appendChild(label);
        
        // 点击刷新缩略图 - 只有当当前进度在该区间内才允许刷新
        item.addEventListener('click', function() {
            const currentPercentage = parseFloat(getSimilarityPercentage());
            if (currentPercentage >= range.min && currentPercentage < range.max) {
                refreshThumbnail(range.min, range.max);
            } else {
                updateStatus(`当前进度${currentPercentage}%不在${range.min}-${range.max}%范围内，无法刷新`);
            }
        });
        
        grid.appendChild(item);
        
        // 初始化缩略图状态为未更新
        state.thumbnailStates[`${range.min}-${range.max}`] = false;
    });
}



function initOriginalThumbnail() {
    const originalCanvas = document.getElementById('originalThumbnailCanvas');
    const originalContainer = document.getElementById('originalThumbnail');
    
    if (state.sampleCtx && state.sampleCtx.canvas) {
        // 使用容器尺寸
        const containerWidth = originalContainer.clientWidth;
        const containerHeight = originalContainer.clientHeight;
        
        // 设置canvas尺寸匹配容器
        originalCanvas.width = containerWidth;
        originalCanvas.height = containerHeight;
        
        const thumbCtx = originalCanvas.getContext('2d');
        thumbCtx.clearRect(0, 0, containerWidth, containerHeight);
        
        // 居中绘制原图，保持比例
        const imgWidth = state.sampleCtx.canvas.width;
        const imgHeight = state.sampleCtx.canvas.height;
        const scale = Math.min(containerWidth / imgWidth, containerHeight / imgHeight);
        const drawWidth = imgWidth * scale;
        const drawHeight = imgHeight * scale;
        const offsetX = (containerWidth - drawWidth) / 2;
        const offsetY = (containerHeight - drawHeight) / 2;
        
        thumbCtx.drawImage(state.sampleCtx.canvas, offsetX, offsetY, drawWidth, drawHeight);
    }
}

function refreshThumbnail(minRange, maxRange) {
    if (!state.ctx) return;
    
    const canvas = document.querySelector(`.thumbnail-item[data-range="${minRange}-${maxRange}"] .thumbnail-canvas`);
    if (canvas) {
        const container = canvas.parentElement;
        const containerWidth = container.clientWidth;
        const containerHeight = container.clientHeight;
        
        // 设置canvas尺寸匹配容器
        canvas.width = containerWidth;
        canvas.height = containerHeight;
        
        const thumbCtx = canvas.getContext('2d');
        thumbCtx.clearRect(0, 0, containerWidth, containerHeight);
        
        // 居中绘制图片，保持比例
        const imgWidth = state.ctx.canvas.width;
        const imgHeight = state.ctx.canvas.height;
        const scale = Math.min(containerWidth / imgWidth, containerHeight / imgHeight);
        const drawWidth = imgWidth * scale;
        const drawHeight = imgHeight * scale;
        const offsetX = (containerWidth - drawWidth) / 2;
        const offsetY = (containerHeight - drawHeight) / 2;
        
        thumbCtx.drawImage(state.ctx.canvas, offsetX, offsetY, drawWidth, drawHeight);
        
        // 标记该缩略图已更新
        state.thumbnailStates[`${minRange}-${maxRange}`] = true;
        
        // 存储缩略图数据
        state.thumbnails[`${minRange}-${maxRange}`] = canvas.toDataURL();
        
        updateStatus(`已更新${minRange}-${maxRange}%缩略图`);
    }
}

function checkAndUpdateThumbnails() {
    if (!state.ctx) {
        console.log("checkAndUpdateThumbnails: state.ctx 不存在");
        return false;
    }
    
    const currentPercentage = parseFloat(getSimilarityPercentage());
    
    // 检查每个区间，如果当前相似度在区间内且该区间还没有更新过缩略图，则自动更新
    const ranges = [
        { min: 10, max: 20 }, { min: 20, max: 30 }, { min: 30, max: 40 },
        { min: 40, max: 50 }, { min: 50, max: 60 }, { min: 60, max: 70 },
        { min: 70, max: 80 }, { min: 80, max: 90 }, { min: 90, max: 100 }
    ];
    
    let updated = false;
    
    ranges.forEach(range => {
        const rangeKey = `${range.min}-${range.max}`;
        
        // 修复条件判断：当前相似度 >= 区间最小值 且 当前相似度 < 区间最大值
        const isInRange = currentPercentage >= range.min && currentPercentage < range.max;
        const notUpdated = !state.thumbnailStates[rangeKey];
        
        // 如果当前相似度在这个区间内，且该区间的缩略图还没有更新过
        if (isInRange && notUpdated) {
            refreshThumbnail(range.min, range.max);
            updated = true;
        }
    });
    
    state.lastSimilarityPercentage = currentPercentage;
    return updated;
}

function updateProgressThumbnails() {
    if (!state.hasProgressImage) return;
    
    const currentPercentage = parseFloat(getSimilarityPercentage());
    const ranges = [10, 20, 30, 40, 50, 60, 70, 80, 90];
    
    ranges.forEach(minRange => {
        const rangeKey = `${minRange}-${minRange+10}`;
        const canvas = document.querySelector(`.thumbnail-item[data-range="${rangeKey}"] .thumbnail-canvas`);
        if (canvas) {
            // 只在需要更新时处理
            if (currentPercentage >= minRange && currentPercentage <= minRange + 10 && 
                !state.thumbnailStates[rangeKey]) {
                
                const container = canvas.parentElement;
                const containerWidth = container.clientWidth;
                const containerHeight = container.clientHeight;
                
                // 只在尺寸变化时重新设置canvas尺寸
                if (canvas.width !== containerWidth || canvas.height !== containerHeight) {
                    canvas.width = containerWidth;
                    canvas.height = containerHeight;
                }
                
                const thumbCtx = canvas.getContext('2d');
                
                // 居中绘制图片，保持比例
                const imgWidth = state.ctx.canvas.width;
                const imgHeight = state.ctx.canvas.height;
                const scale = Math.min(containerWidth / imgWidth, containerHeight / imgHeight);
                const drawWidth = imgWidth * scale;
                const drawHeight = imgHeight * scale;
                const offsetX = (containerWidth - drawWidth) / 2;
                const offsetY = (containerHeight - drawHeight) / 2;
                
                thumbCtx.drawImage(state.ctx.canvas, offsetX, offsetY, drawWidth, drawHeight);
                
                // 标记该缩略图已更新
                state.thumbnailStates[rangeKey] = true;
            }
            // 如果当前相似度不在这个范围内，但缩略图已经更新过，保持原样
        }
    });
}


// ======================
// 拖拽上传功能
// ======================
function initDragAndDrop() {
    const sampleCanvas = document.getElementById('sampleImg');
    const myCanvas = document.getElementById('myCanvas');

    // 检查元素是否存在
    if (!sampleCanvas || !myCanvas) {
        console.error("初始化拖放失败：未找到画布元素");
        return;
    }

    [sampleCanvas, myCanvas].forEach((canvas, index) => {
        // 确保移除可能存在的旧监听器，避免重复绑定
        canvas.removeEventListener('dragover', handleDragOver);
        canvas.removeEventListener('dragleave', handleDragLeave);
        canvas.removeEventListener('drop', handleDrop);

        canvas.addEventListener('dragover', handleDragOver);
        canvas.addEventListener('dragleave', handleDragLeave);
        canvas.addEventListener('drop', handleDrop);

        function handleDragOver(e) {
            e.preventDefault(); // 必须调用，才能触发drop:cite[8]
            e.dataTransfer.dropEffect = 'copy'; // 显示为复制光标
            this.classList.add('drag-over');
        }

        function handleDragLeave(e) {
            e.preventDefault();
            // 避免因拖拽到子元素而误触发
            if (!this.contains(e.relatedTarget)) {
                this.classList.remove('drag-over');
            }
        }

        function handleDrop(e) {
            e.preventDefault();
            this.classList.remove('drag-over');
            const files = e.dataTransfer.files;

            if (files.length > 0 && files[0].type.startsWith('image/')) {
                const type = index === 0 ? 'original' : 'progress';
                handleImageUpload(files[0], type);
            } else {
                updateStatus("请拖拽一个有效的图片文件");
            }
        }
    });
}

function handleImageUpload(file, type) {
    
    const reader = new FileReader();
    reader.onload = function(event) {
        const img = new Image();
        
        img.onload = function() {
            
            if (type === 'original') {
                // 处理原图上传
                const maxSize = 800;
                let width = img.naturalWidth;
                let height = img.naturalHeight;

                if (width > maxSize || height > maxSize) {
                    const scale = maxSize / Math.max(width, height);
                    width = Math.floor(width * scale);
                    height = Math.floor(height * scale);
                    state.imageScale = scale;
                }

                // 初始化画布
                initCanvases(width, height);
                
                // 绘制到sampleCtx
                state.sampleCtx.drawImage(img, 0, 0, width, height);
                
                // 获取样本数据
                state.sampleData = state.sampleCtx.getImageData(0, 0, width, height).data;
                
                // 初始化myCanvas为白色
                state.ctx.fillStyle = 'white';
                state.ctx.fillRect(0, 0, width, height);
                
                // 计算初始分数
                calculateInitialScore();
                updateStatus("原图已加载，可上传进度或开始绘制");
                
                // 重置所有缩略图状态
                const ranges = [10, 20, 30, 40, 50, 60, 70, 80, 90];
                ranges.forEach(minRange => {
                    state.thumbnailStates[`${minRange}-${minRange+10}`] = false;
                });
                
                // 初始化缩略图
                initThumbnails();
                
                // 延迟初始化确保容器尺寸已计算
                setTimeout(() => {
                    initOriginalThumbnail();
                }, 50);
                
                state.lastSimilarityPercentage = 0;
                state.hasProgressImage = false;
                
                
            } else if (type === 'progress') {
                // 处理进度上传
                if (!state.sampleCtx) {
                    alert('请先上传原图！');
                    return;
                }
                
                
                if (img.width !== state.sampleCtx.canvas.width || 
                    img.height !== state.sampleCtx.canvas.height) {
                    alert('进度图片尺寸不匹配原图！');
                    return;
                }

                state.ctx.drawImage(img, 0, 0);
                state.lastScore = calculateSimilarity();
                const currentPercentage = parseFloat(getSimilarityPercentage());
                updateStatus(`进度已加载，当前相似度：${currentPercentage}%`);
                
                // 标记已上传进度图片
                state.hasProgressImage = true;
                
                // 根据当前进度设置已更新的缩略图状态
                const ranges = [10, 20, 30, 40, 50, 60, 70, 80, 90];
                ranges.forEach(minRange => {
                    if (currentPercentage >= minRange + 10) {
                        // 如果当前进度已经超过这个区间，标记为已更新
                        state.thumbnailStates[`${minRange}-${minRange+10}`] = true;
                    }
                });
                
                // 更新缩略图显示
                setTimeout(() => {
                    updateProgressThumbnails();
                }, 50);
            }
        };
        
        img.onerror = function() {
            alert(`图片加载失败，请重试`);
        };
        
        img.src = event.target.result;
    };
    
    reader.onerror = function() {
        alert(`文件读取失败，请重试`);
    };
    
    reader.readAsDataURL(file);
}

// ======================
// 修改绘制循环，添加缩略图检查
// ======================
function drawingStep() {
    if (!state.isDrawing) {
        return;
    }
    
    const startTime = performance.now();
    let steps = 0;
    
    while (performance.now() - startTime < 16 && steps < 5) {
        const backup = state.ctx.getImageData(0, 0, state.ctx.canvas.width, state.ctx.canvas.height);
        const pathParams = drawRandomCurve();
        const newScore = calculateSimilarity();

        if (newScore < state.lastScore) {
            state.lastScore = newScore;
            state.backupImage = backup;

            // 随机性触发逻辑
            if (document.getElementById('colorFit').checked && Math.random() < 0.001) {
                let newColor;
                do {
                    newColor = generateRandomColor();
                } while(newColor === getInverseColor(pathParams.color));

                const newWidth = Math.min(pathParams.width * 30, 75);

                const specialBackup = state.ctx.getImageData(0, 0, state.ctx.canvas.width, state.ctx.canvas.height);
                drawRandomCurve({
                    lineWidth: newWidth,
                    strokeStyle: newColor,
                    fillStyle: newColor
                });
                
                const specialScore = calculateSimilarity();
                if (specialScore < state.lastScore) {
                    state.lastScore = specialScore;
                    state.backupImage = specialBackup;
                } else {
                    state.ctx.putImageData(specialBackup, 0, 0);
                }
            }
        } else {
            state.ctx.putImageData(backup, 0, 0);
        }
        steps++;
    }
    
    const currentSimilarity = getSimilarityPercentage();
    updateStatus(`相似度：${currentSimilarity}% (每秒${steps * 60}笔)`);
    
    // 检查并更新缩略图
    if (!state.hasProgressImage) {
        // 无进度图模式 - 使用自动更新逻辑
        checkAndUpdateThumbnails();
    } else {
        // 有进度图模式 - 减少更新频率，只在相似度变化时更新
        const currentPercentage = parseFloat(currentSimilarity);
        
        // 只有当相似度变化超过0.1%时才更新缩略图
        if (Math.abs(currentPercentage - state.lastSimilarityPercentage) >= 0.1) {
            updateProgressThumbnails();
            state.lastSimilarityPercentage = currentPercentage;
        }
    }
    
    requestAnimationFrame(drawingStep);
}

function resetThumbnailStates() {
    const ranges = [10, 20, 30, 40, 50, 60, 70, 80, 90];
    ranges.forEach(minRange => {
        const rangeKey = `${minRange}-${minRange+10}`;
        state.thumbnailStates[rangeKey] = false;
        
        // 清空对应的canvas
        const canvas = document.querySelector(`.thumbnail-item[data-range="${rangeKey}"] .thumbnail-canvas`);
        if (canvas) {
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
    });
}

// ======================
// 线条样式配置
// ======================
const LINE_STYLES = {
    solid: [],
    dashed: [10, 5],
    dotted: [2, 4],
    dashDot: [10, 2, 2, 2],
    random: function() {
        const patterns = [
            [10, 5],
            [2, 4],
            [5, 5],
            [10, 2, 2, 2],
            [8, 8]
        ];
        return patterns[Math.floor(Math.random() * patterns.length)];
    }
};

// ======================
// 初始化函数
// ======================
function initCanvases(width, height) {
    const sampleCanvas = document.getElementById('sampleImg');
    const myCanvas = document.getElementById('myCanvas');
    
    [sampleCanvas, myCanvas].forEach(canvas => {
        canvas.width = width;
        canvas.height = height;
        canvas.style.width = width + 'px';
        canvas.style.height = height + 'px';
    });

    state.ctx = myCanvas.getContext('2d');
    state.sampleCtx = sampleCanvas.getContext('2d');
    state.ctx.lineCap = 'round';
}

// ======================
// 图片上传处理
// ======================
document.getElementById('upload').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (!file) return;

    document.getElementById('uploadBtn').disabled = true;
    updateStatus("正在加载原图...");

    const reader = new FileReader();
    reader.onload = function(event) {
        const img = new Image();
        img.onload = function() {
            const maxSize = 800;
            let width = img.naturalWidth;
            let height = img.naturalHeight;

            if (width > maxSize || height > maxSize) {
                const scale = maxSize / Math.max(width, height);
                width = Math.floor(width * scale);
                height = Math.floor(height * scale);
                state.imageScale = scale;
            }

            initCanvases(width, height);
            
            state.sampleCtx.drawImage(img, 0, 0, width, height);
            state.sampleData = state.sampleCtx.getImageData(0, 0, width, height).data;
            
            state.ctx.fillStyle = 'white';
            state.ctx.fillRect(0, 0, width, height);
            
            calculateInitialScore();
            updateStatus("原图已加载，可上传进度或开始绘制");
            document.getElementById('uploadBtn').disabled = false;
        };
        img.src = event.target.result;
    };
    reader.readAsDataURL(file);
});

// ======================
// 进度图片上传
// ======================
document.getElementById('uploadProgress').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (!file) return;

    document.getElementById('uploadProgressBtn').disabled = true;
    updateStatus("正在加载进度...");

    const reader = new FileReader();
    reader.onload = function(event) {
        const img = new Image();
        img.onload = function() {
            if (img.width !== state.sampleCtx.canvas.width || 
                img.height !== state.sampleCtx.canvas.height) {
                alert('进度图片尺寸不匹配原图！');
                document.getElementById('uploadProgressBtn').disabled = false;
                return;
            }

            state.ctx.drawImage(img, 0, 0);
            state.lastScore = calculateSimilarity();
            updateStatus(`进度已加载，当前相似度：${getSimilarityPercentage()}%`);
            document.getElementById('uploadProgressBtn').disabled = false;
        };
        img.src = event.target.result;
    };
    reader.readAsDataURL(file);
});

// ======================
// 圆点绘制函数
// ======================
function drawSingleCircle(ctx, center) {
    ctx.beginPath();
    ctx.arc(center.x, center.y, ctx.lineWidth/2, 0, Math.PI*2);
    ctx.fill();
}

// ======================
// 核心绘制函数
// ======================
function drawRandomCurve(overrideParams = null) {
    const canvas = document.getElementById('myCanvas');
    const ctx = state.ctx;
    const lineStyle = document.getElementById('lineStyle').value;
    
    ctx.save();

    // 参数覆盖逻辑
    if (overrideParams) {
        ctx.lineWidth = overrideParams.lineWidth;
        ctx.strokeStyle = overrideParams.strokeStyle;
        ctx.fillStyle = overrideParams.fillStyle;
    } else {
        // 正常参数设置
        const minWidth = parseInt(document.getElementById('minWidth').value);
        const maxWidth = parseInt(document.getElementById('maxWidth').value);
        ctx.lineWidth = Math.random() * (maxWidth - minWidth) + minWidth;

        const start = generateStartPoint();
        if (document.getElementById('colorFit').checked) {
            ctx.fillStyle = getSampleColor(start.x, start.y);
            ctx.strokeStyle = ctx.fillStyle;
        } else {
            const randomColor = `hsl(${Math.random()*360}, 70%, 50%)`;
            ctx.fillStyle = randomColor;
            ctx.strokeStyle = randomColor;
        }
    }

    // 圆点模式处理
    if (lineStyle === 'circleDot') {
        drawSingleCircle(ctx, generateStartPoint());
        ctx.restore();
        return { 
            color: ctx.strokeStyle, 
            width: ctx.lineWidth 
        };
    }

    // 常规线条设置
    if (lineStyle === 'random') {
        ctx.setLineDash(LINE_STYLES.random());
    } else {
        ctx.setLineDash(LINE_STYLES[lineStyle]);
    }
    ctx.lineDashOffset = Math.random() * 10;

    // 路径生成
    const end = { 
        x: Math.random() * canvas.width, 
        y: Math.random() * canvas.height 
    };
    const start = generateStartPoint();

    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    
    const lineMode = document.getElementById('lineMode').value;
    if (lineMode === 'straight') {
        ctx.lineTo(end.x, end.y);
    } else {
        const quadProb = parseInt(document.getElementById('quadProb').value);
        if (Math.random() * 100 < quadProb) {
            const cp = { 
                x: start.x + (end.x - start.x) * Math.random(),
                y: start.y + (end.y - start.y) * Math.random()
            };
            ctx.quadraticCurveTo(cp.x, cp.y, end.x, end.y);
        } else {
            const cp1 = { 
                x: start.x + (end.x - start.x) * Math.random(),
                y: start.y + (end.y - start.y) * Math.random()
            };
            const cp2 = { 
                x: start.x + (end.x - start.x) * Math.random(),
                y: start.y + (end.y - start.y) * Math.random()
            };
            ctx.bezierCurveTo(cp1.x, cp1.y, cp2.x, cp2.y, end.x, end.y);
        }
    }
    
    ctx.stroke();
    ctx.restore();

    return { 
        color: ctx.strokeStyle, 
        width: ctx.lineWidth 
    };
}

// ======================
// 颜色处理函数
// ======================
function getInverseColor(originalColor) {
    const match = originalColor.match(/\d+/g);
    const r = 255 - parseInt(match[0]);
    const g = 255 - parseInt(match[1]);
    const b = 255 - parseInt(match[2]);
    return `rgb(${r},${g},${b})`;
}

function generateRandomColor() {
    return `hsl(${Math.random()*360}, 70%, 50%)`;
}

// ======================
// 绘制循环
// ======================
function drawingStep() {
    if (!state.isDrawing) {
        return;
    }
    
    const startTime = performance.now();
    let steps = 0;
    
    while (performance.now() - startTime < 16 && steps < 5) {
        const backup = state.ctx.getImageData(0, 0, state.ctx.canvas.width, state.ctx.canvas.height);
        const pathParams = drawRandomCurve();
        const newScore = calculateSimilarity();

        if (newScore < state.lastScore) {
            state.lastScore = newScore;
            state.backupImage = backup;

            // 随机性触发逻辑
            if (document.getElementById('colorFit').checked && Math.random() < 0.001) {
                let newColor;
                do {
                    newColor = generateRandomColor();
                } while(newColor === getInverseColor(pathParams.color));

                const newWidth = Math.min(pathParams.width * 30, 75);

                const specialBackup = state.ctx.getImageData(0, 0, state.ctx.canvas.width, state.ctx.canvas.height);
                drawRandomCurve({
                    lineWidth: newWidth,
                    strokeStyle: newColor,
                    fillStyle: newColor
                });
                
                const specialScore = calculateSimilarity();
                if (specialScore < state.lastScore) {
                    state.lastScore = specialScore;
                    state.backupImage = specialBackup;
                } else {
                    state.ctx.putImageData(specialBackup, 0, 0);
                }
            }
        } else {
            state.ctx.putImageData(backup, 0, 0);
        }
        steps++;
    }
    
    const currentSimilarity = getSimilarityPercentage();
    updateStatus(`相似度：${currentSimilarity}% (每秒${steps * 60}笔)`);
    
    // 检查并更新缩略图 - 每次绘制循环都检查
    if (!state.hasProgressImage) {
        const updated = checkAndUpdateThumbnails();
        if (updated) {
            console.log("=== 检测到相似度变化，自动更新了缩略图 ===");
        } else {
            console.log("=== 没有需要更新的缩略图 ===");
        }
    } else {
        console.log("=== 已上传进度图，使用进度图模式 ===");
        updateProgressThumbnails();
    }
    
    // 确保循环继续
    if (state.isDrawing) {
        requestAnimationFrame(drawingStep);
    }
}

// ======================
// 辅助函数
// ======================
function convertCoordinates(canvas, clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
        x: (clientX - rect.left) * scaleX,
        y: (clientY - rect.top) * scaleY
    };
}

function generateStartPoint() {
    const canvas = document.getElementById('sampleImg');
    const mode = document.getElementById('startPointMode').value;
    
    switch(mode) {
        case 'user':  return state.startPoint || { x: canvas.width/2, y: canvas.height/2 };
        case 'center': return { x: canvas.width/2, y: canvas.height/2 };
        case 'border': return generateBorderPoint(canvas);
        default: return { x: Math.random() * canvas.width, y: Math.random() * canvas.height };
    }
}

function generateBorderPoint(canvas) {
    const side = Math.floor(Math.random() * 4);
    const pos = Math.random();
    return {
        x: side === 0 ? 0 : side === 1 ? canvas.width : pos * canvas.width,
        y: side === 2 ? 0 : side === 3 ? canvas.height : pos * canvas.height
    };
}

function getSampleColor(x, y) {
    const data = state.sampleData;
    const width = state.sampleCtx.canvas.width;
    x = Math.max(0, Math.min(width-1, x));
    y = Math.max(0, Math.min(width-1, y));
    const index = (Math.floor(y) * width + Math.floor(x)) * 4;
    return `rgb(${data[index]}, ${data[index+1]}, ${data[index+2]})`;
}

function calculateInitialScore() {
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = state.sampleCtx.canvas.width;
    tempCanvas.height = state.sampleCtx.canvas.height;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.fillStyle = 'white';
    tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
    state.initialScore = calculateSimilarityRaw(tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height).data);
    state.lastScore = state.initialScore;
}

function calculateSimilarityRaw(currentData) {
    let totalDiff = 0;
    for (let i = 0; i < state.sampleData.length; i += 16) {
        totalDiff += Math.abs(state.sampleData[i] - currentData[i]) + 
                    Math.abs(state.sampleData[i+1] - currentData[i+1]) + 
                    Math.abs(state.sampleData[i+2] - currentData[i+2]);
    }
    return totalDiff / 3;
}

function calculateSimilarity() {
    return calculateSimilarityRaw(state.ctx.getImageData(0, 0, state.ctx.canvas.width, state.ctx.canvas.height).data);
}

function getSimilarityPercentage() {
    return state.initialScore ? Math.max(0, Math.min(100, (1 - state.lastScore / state.initialScore) * 100)).toFixed(1) : 0;
}

// ======================
// 控制函数
// ======================
function toggleDrawing() {
    state.isDrawing = !state.isDrawing;
    const drawBtn = document.getElementById('drawBtn');
    drawBtn.textContent = state.isDrawing ? '停止绘制' : '开始绘制';
    drawBtn.classList.toggle('stop', state.isDrawing);
    
    
    if (state.isDrawing) {
        console.log("开始绘制循环");
        // 确保绘制循环开始
        requestAnimationFrame(drawingStep);
    } else {
        console.log("停止绘制循环");
    }
}

function forceCheckThumbnails() {
    if (!state.hasProgressImage) {
        checkAndUpdateThumbnails();
    } else {
        updateProgressThumbnails();
    }
}

function updateStatus(text) {
    document.getElementById('status').textContent = text;
}

// ======================
// 事件监听
// ======================
document.getElementById('sampleImg').addEventListener('click', function(e) {
    if (document.getElementById('startPointMode').value === 'user') {
        const pos = convertCoordinates(this, e.clientX, e.clientY);
        state.startPoint = pos;
        updateStatus(`起点已设置：${pos.x.toFixed(0)}, ${pos.y.toFixed(0)}`);
    }
});

document.getElementById('lineMode').addEventListener('change', function() {
    document.getElementById('curveControls').style.display = this.value === 'curve' ? 'inline' : 'none';
});

// ======================
// 初始化
// ======================
window.onload = function() {
    initCanvases(400, 400);
    initThumbnails();
    initDragAndDrop();
    updateStatus("请先上传原图");

    // 修复事件绑定 - 确保在DOM完全加载后绑定
    document.getElementById('uploadBtn').addEventListener('click', function() {
        document.getElementById('upload').click();
    });

    document.getElementById('uploadProgressBtn').addEventListener('click', function() {
        document.getElementById('uploadProgress').click();
    });

    // 修复绘制按钮事件绑定
    const drawBtn = document.getElementById('drawBtn');
    if (drawBtn) {
        drawBtn.addEventListener('click', toggleDrawing);
        console.log("绘制按钮事件监听器已绑定");
    } else {
        console.error("绘制按钮未找到!");
    }
    
    // 文件输入事件保持不变
    document.getElementById('upload').addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (file) handleImageUpload(file, 'original');
    });

    document.getElementById('uploadProgress').addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (file) handleImageUpload(file, 'progress');
    });
    
};
