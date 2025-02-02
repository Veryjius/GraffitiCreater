// ======================
// 全局状态管理
// ======================
const state = {
    isDrawing: false,        // 是否正在绘制
    backupImage: null,       // 画布备份数据
    lastScore: null,         // 当前差异值
    initialScore: null,      // 初始差异值（白纸状态）
    ctx: null,               // 绘制画布上下文
    sampleCtx: null,         // 样本画布上下文
    sampleData: null,        // 样本像素数据
    imageScale: 1,           // 图片缩放比例
    startPoint: null,        // 用户指定的起始点
    startMode: 'random',     // 当前起始点模式
    activeColorFit: false    // 是否启用颜色拟合
};

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
            [10, 5],      // 虚线
            [2, 4],       // 点线
            [5, 5],       // 短虚线
            [10, 2, 2, 2],// 点划线
            [8, 8]        // 长虚线
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
    
    // 设置画布尺寸（保持显示尺寸与逻辑尺寸一致）
    [sampleCanvas, myCanvas].forEach(canvas => {
        canvas.width = width;
        canvas.height = height;
        canvas.style.width = width + 'px';
        canvas.style.height = height + 'px';
    });

    // 初始化绘图上下文
    state.ctx = myCanvas.getContext('2d');
    state.sampleCtx = sampleCanvas.getContext('2d');
    state.ctx.lineCap = 'round';  // 设置圆形线帽
}

// ======================
// 图片上传处理
// ======================
document.getElementById('upload').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (!file) return;

    // 禁用按钮防止重复上传
    document.getElementById('uploadBtn').disabled = true;
    updateStatus("正在加载原图...");

    const reader = new FileReader();
    reader.onload = function(event) {
        const img = new Image();
        img.onload = function() {
            // 限制最大尺寸为800px
            const maxSize = 800;
            let width = img.naturalWidth;
            let height = img.naturalHeight;

            // 计算缩放比例
            if (width > maxSize || height > maxSize) {
                const scale = maxSize / Math.max(width, height);
                width = Math.floor(width * scale);
                height = Math.floor(height * scale);
                state.imageScale = scale;
            }

            // 初始化画布
            initCanvases(width, height);
            
            // 绘制样本图片
            state.sampleCtx.drawImage(img, 0, 0, width, height);
            state.sampleData = state.sampleCtx.getImageData(0, 0, width, height).data;
            
            // 初始化绘制画布（白色背景）
            state.ctx.fillStyle = 'white';
            state.ctx.fillRect(0, 0, width, height);
            
            // 计算初始差异值
            calculateInitialScore();
            updateStatus("原图已加载，可上传进度或开始绘制");
            document.getElementById('uploadBtn').disabled = false;
        };
        img.src = event.target.result;
    };
    reader.readAsDataURL(file);
});

// ======================
// 进度图片上传处理
// ======================
document.getElementById('uploadProgress').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (!file) return;

    // 禁用按钮防止重复上传
    document.getElementById('uploadProgressBtn').disabled = true;
    updateStatus("正在加载进度...");

    const reader = new FileReader();
    reader.onload = function(event) {
        const img = new Image();
        img.onload = function() {
            // 检查尺寸匹配
            if (img.width !== state.sampleCtx.canvas.width || 
                img.height !== state.sampleCtx.canvas.height) {
                alert('进度图片尺寸不匹配原图！');
                document.getElementById('uploadProgressBtn').disabled = false;
                return;
            }

            // 绘制到绘制画布
            state.ctx.drawImage(img, 0, 0);
            
            // 更新初始分数
            state.lastScore = calculateSimilarity();
            updateStatus(`进度已加载，当前相似度：${getSimilarityPercentage()}%`);
            document.getElementById('uploadProgressBtn').disabled = false;
        };
        img.src = event.target.result;
    };
    reader.readAsDataURL(file);
});

// ======================
// 新增线条样式设置函数
// ======================
function setLineStyle(ctx) {
    const style = document.getElementById('lineStyle').value;
    
    if (style === 'random') {
        ctx.setLineDash(LINE_STYLES.random());
    } else {
        ctx.setLineDash(LINE_STYLES[style]);
    }
    
    // 设置虚线偏移量产生动态效果
    ctx.lineDashOffset = Math.random() * 10;
}

// ======================
// 绘制函数（增加线条样式）
// ======================
function drawRandomCurve() {
    const canvas = document.getElementById('myCanvas');
    const ctx = state.ctx;
    
    // 保存当前画布状态
    ctx.save();
    
    // ===== 设置线条样式 =====
    // 设置虚线样式
    setLineStyle(ctx);
    
    // 设置线条颜色
    const start = generateStartPoint();
    if (document.getElementById('colorFit').checked) {
        ctx.strokeStyle = getSampleColor(start.x, start.y);
    } else {
        ctx.strokeStyle = `hsl(${Math.random()*360}, 70%, 50%)`;
    }
    
    // 设置线条粗细
    const minWidth = parseInt(document.getElementById('minWidth').value);
    const maxWidth = parseInt(document.getElementById('maxWidth').value);
    ctx.lineWidth = Math.random() * (maxWidth - minWidth) + minWidth;

    // ===== 生成控制点 =====
    const end = { 
        x: Math.random() * canvas.width, 
        y: Math.random() * canvas.height 
    };

    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    
    // ===== 选择线段类型 =====
    const lineMode = document.getElementById('lineMode').value;
    if (lineMode === 'straight') {
        ctx.lineTo(end.x, end.y);
    } else {
        const quadProb = parseInt(document.getElementById('quadProb').value);
        if (Math.random() * 100 < quadProb) {
            // 二次贝塞尔曲线
            const cp = { 
                x: start.x + (end.x - start.x) * Math.random(),
                y: start.y + (end.y - start.y) * Math.random()
            };
            ctx.quadraticCurveTo(cp.x, cp.y, end.x, end.y);
        } else {
            // 三次贝塞尔曲线
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
    ctx.restore(); // 恢复画布状态
}

// 坐标转换函数
function convertCoordinates(canvas, clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
        x: (clientX - rect.left) * scaleX,
        y: (clientY - rect.top) * scaleY
    };
}

// 起始点生成函数
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

// 生成边界点辅助函数
function generateBorderPoint(canvas) {
    const side = Math.floor(Math.random() * 4);
    const pos = Math.random();
    return {
        x: side === 0 ? 0 : side === 1 ? canvas.width : pos * canvas.width,
        y: side === 2 ? 0 : side === 3 ? canvas.height : pos * canvas.height
    };
}

// 颜色获取函数
function getSampleColor(x, y) {
    const data = state.sampleData;
    const width = state.sampleCtx.canvas.width;
    x = Math.max(0, Math.min(width-1, x));
    y = Math.max(0, Math.min(width-1, y));
    const index = (Math.floor(y) * width + Math.floor(x)) * 4;
    return `rgb(${data[index]}, ${data[index+1]}, ${data[index+2]})`;
}

// 计算初始分数
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

// 相似度计算
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

// 相似度百分比
function getSimilarityPercentage() {
    return state.initialScore ? Math.max(0, Math.min(100, (1 - state.lastScore / state.initialScore) * 100)).toFixed(1) : 0;
}

// 绘制循环
function drawingStep() {
    if (!state.isDrawing) return;
    const startTime = performance.now();
    let steps = 0;
    while (performance.now() - startTime < 16 && steps < 5) {
        const backup = state.ctx.getImageData(0, 0, state.ctx.canvas.width, state.ctx.canvas.height);
        drawRandomCurve();
        const newScore = calculateSimilarity();
        if (newScore < state.lastScore) {
            state.lastScore = newScore;
            state.backupImage = backup;
        } else {
            state.ctx.putImageData(backup, 0, 0);
        }
        steps++;
    }
    updateStatus(`相似度：${getSimilarityPercentage()}% (每秒${steps * 60}笔)`);
    requestAnimationFrame(drawingStep);
}

// 切换绘制状态
function toggleDrawing() {
    state.isDrawing = !state.isDrawing;
    const drawBtn = document.getElementById('drawBtn');
    drawBtn.textContent = state.isDrawing ? '停止绘制' : '开始绘制';
    drawBtn.classList.toggle('stop', state.isDrawing);
    if (state.isDrawing) requestAnimationFrame(drawingStep);
}

// 事件监听器
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

// 工具函数
function updateStatus(text) {
    document.getElementById('status').textContent = text;
}

// 初始化
window.onload = function() {
    initCanvases(400, 400);
    updateStatus("请先上传原图");

    // 绑定按钮点击事件
    document.getElementById('uploadBtn').addEventListener('click', function() {
        document.getElementById('upload').click();
    });

    document.getElementById('uploadProgressBtn').addEventListener('click', function() {
        document.getElementById('uploadProgress').click();
    });

    document.getElementById('drawBtn').addEventListener('click', toggleDrawing);
};
