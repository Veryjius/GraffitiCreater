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
    activeColorFit: false
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
    if (!state.isDrawing) return;
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
    
    updateStatus(`相似度：${getSimilarityPercentage()}% (每秒${steps * 60}笔)`);
    requestAnimationFrame(drawingStep);
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
    if (state.isDrawing) requestAnimationFrame(drawingStep);
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
    updateStatus("请先上传原图");

    document.getElementById('uploadBtn').addEventListener('click', function() {
        document.getElementById('upload').click();
    });

    document.getElementById('uploadProgressBtn').addEventListener('click', function() {
        document.getElementById('uploadProgress').click();
    });

    document.getElementById('drawBtn').addEventListener('click', toggleDrawing);
};
