/**
 * 图片识别模块 - 从 Wordle 截图中提取猜测历史
 * 
 * 图片格式：2x2 布局，每个区域 12 列 x 最多 9 行
 * 颜色识别：
 * - 绿色方块：RGB ~(83, 141, 78) -> 'g'
 * - 黄色方块：RGB ~(181, 159, 59) -> 'y'  
 * - 灰色方块：RGB ~(58, 58, 60) -> 'x'
 * - 白色/空：未使用的格子
 */

// 颜色阈值定义 - 根据实际截图调整
const COLOR_THRESHOLDS = {
    green: { r: [60, 140], g: [120, 210], b: [50, 130] },      // 绿色范围扩大（覆盖 106,170,100 和 110,173,111）
    yellow: { r: [170, 240], g: [150, 220], b: [60, 130] },    // 黄色（201,180,88）
    gray: { r: [90, 230], g: [95, 235], b: [100, 240] },       // 灰色范围大幅扩大（120,124,126 到 215,218,222）
    white: { r: [245, 255], g: [245, 255], b: [245, 255] }     // 白色阈值提高（避免误判浅色）
};

/**
 * 判断颜色类型 - 使用特征判断而非简单阈值
 */
function detectColor(r, g, b) {
    // 白色优先判断（避免误判）
    if (r >= COLOR_THRESHOLDS.white.r[0] && 
        g >= COLOR_THRESHOLDS.white.g[0] && 
        b >= COLOR_THRESHOLDS.white.b[0]) {
        return null;
    }
    
    // 绿色特征：G 通道最高，且 G > R + 20
    if (g >= COLOR_THRESHOLDS.green.g[0] && g <= COLOR_THRESHOLDS.green.g[1] &&
        r >= COLOR_THRESHOLDS.green.r[0] && r <= COLOR_THRESHOLDS.green.r[1] &&
        b >= COLOR_THRESHOLDS.green.b[0] && b <= COLOR_THRESHOLDS.green.b[1] &&
        g > r + 10 && g > b + 10) {
        return 'g';
    }
    
    // 黄色特征：R 和 G 都高，B 低
    if (r >= COLOR_THRESHOLDS.yellow.r[0] && r <= COLOR_THRESHOLDS.yellow.r[1] &&
        g >= COLOR_THRESHOLDS.yellow.g[0] && g <= COLOR_THRESHOLDS.yellow.g[1] &&
        b >= COLOR_THRESHOLDS.yellow.b[0] && b <= COLOR_THRESHOLDS.yellow.b[1] &&
        r > b + 80 && g > b + 60) {
        return 'y';
    }
    
    // 灰色特征：RGB 接近（差异 < 30）
    const maxDiff = Math.max(Math.abs(r - g), Math.abs(g - b), Math.abs(r - b));
    if (maxDiff < 30 && r >= COLOR_THRESHOLDS.gray.r[0] && r <= COLOR_THRESHOLDS.gray.r[1]) {
        return 'x';
    }
    
    // 其他未识别颜色
    return null;
}

/**
 * 从图片中提取颜色网格
 */
async function extractColorGridFromImage(imageFile) {
    console.log('🖼️ 开始处理图片...');
    
    return new Promise((resolve, reject) => {
        const img = new Image();
        const reader = new FileReader();
        
        reader.onload = (e) => {
            img.src = e.target.result;
        };
        
        img.onload = () => {
            console.log(`📐 图片尺寸: ${img.width}x${img.height}`);
            
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d', { willReadFrequently: true }); // 优化多次读取
            ctx.drawImage(img, 0, 0);
            
            try {
                const result = analyzeGridLayout(canvas, ctx);
                console.log('✅ 颜色网格提取完成');
                resolve(result);
            } catch (error) {
                console.error('❌ 分析失败:', error);
                reject(error);
            }
        };
        
        img.onerror = () => reject(new Error('图片加载失败'));
        reader.onerror = () => reject(new Error('文件读取失败'));
        
        reader.readAsDataURL(imageFile);
    });
}

/**
 * 分析 2x2 网格布局
 */
function analyzeGridLayout(canvas, ctx) {
    const width = canvas.width;
    const height = canvas.height;
    
    // 假设 2x2 均分
    const halfWidth = Math.floor(width / 2);
    const halfHeight = Math.floor(height / 2);
    
    console.log(`🔍 分析区域: ${halfWidth}x${halfHeight} 每个`);
    
    const regions = [
        { x: 0, y: 0, w: halfWidth, h: halfHeight, name: '左上(目标1)' },
        { x: halfWidth, y: 0, w: halfWidth, h: halfHeight, name: '右上(目标2)' },
        { x: 0, y: halfHeight, w: halfWidth, h: halfHeight, name: '左下(目标3)' },
        { x: halfWidth, y: halfHeight, w: halfWidth, h: halfHeight, name: '右下(目标4)' }
    ];
    
    const allPatterns = [];
    
    regions.forEach((region, idx) => {
        console.log(`\n📍 处理${region.name}...`);
        const patterns = analyzeRegion(ctx, region);
        console.log(`  找到 ${patterns.length} 行猜测`);
        allPatterns.push(patterns);
    });
    
    return { patterns: allPatterns };
}

/**
 * 分析单个区域（12列 x 最多9行）
 */
function analyzeRegion(ctx, region) {
    const { x, y, w, h } = region;
    
    // 估算单元格尺寸，考虑边距
    const marginX = 8; // 左右边距各约 8px
    const marginY = 10; // 上下边距各约 10px
    const contentWidth = w - marginX * 2;
    const contentHeight = h - marginY * 2;
    const cellWidth = contentWidth / 12;
    
    // 扫描更多行以覆盖不同布局（最多扫描12行，但实际可能只有5行有效）
    const maxScanRows = 12;
    const cellHeight = contentHeight / maxScanRows;
    
    console.log(`  单元格尺寸: ${cellWidth.toFixed(1)}x${cellHeight.toFixed(1)}`);
    
    const rows = [];
    
    // 扫描每一行（扫描12行以提高覆盖率）
    for (let row = 0; row < maxScanRows; row++) {
        const rowColors = [];
        const rowDebug = []; // 每行的详细RGB信息
        const voteCounts = []; // 记录每格的票数
        
        for (let col = 0; col < 12; col++) {
            // 多点采样：在单元格中心区域取 3x3 网格，投票决定颜色
            const centerX = x + marginX + col * cellWidth + cellWidth / 2;
            const centerY = y + marginY + row * cellHeight + cellHeight / 2;
            
            const samples = [];
            const rgbSamples = [];
            const offsets = [-3, 0, 3]; // 采样偏移（像素）
            
            for (const dx of offsets) {
                for (const dy of offsets) {
                    const sampleX = Math.floor(centerX + dx);
                    const sampleY = Math.floor(centerY + dy);
                    const pixel = ctx.getImageData(sampleX, sampleY, 1, 1).data;
                    const r = pixel[0], g = pixel[1], b = pixel[2];
                    const detectedColor = detectColor(r, g, b);
                    
                    if (dx === 0 && dy === 0) {
                        rgbSamples.push({ r, g, b }); // 记录中心点RGB
                    }
                    
                    if (detectedColor !== null) {
                        samples.push(detectedColor);
                    }
                }
            }
            
            // 投票：取出现最多的颜色
            let color = null;
            if (samples.length >= 3) { // 至少3票才有效
                const counts = {};
                samples.forEach(c => counts[c] = (counts[c] || 0) + 1);
                color = Object.keys(counts).reduce((a, b) => counts[a] > counts[b] ? a : b);
            } else {
                color = null; // 票数太少，标记为未知
            }
            
            rowColors.push(color || 'x'); // 未知当作灰色
            voteCounts.push(samples.length);
            
            // 记录调试信息（前3列）
            const centerPixel = rgbSamples[0];
            if (col < 3 && centerPixel) {
                const { r, g, b } = centerPixel;
                rowDebug.push(`[${col}:${r},${g},${b}→${color || '?'}(${samples.length}票)]`);
            }
        }
        
        // 判断是否是有效行
        const validCells = voteCounts.filter(v => v >= 3).length;
        const hasColoredCells = rowColors.some(c => c === 'g' || c === 'y'); // 有绿色或黄色
        const avgVotes = voteCounts.reduce((a, b) => a + b, 0) / 12;
        
        // 有效行条件（放宽阈值）：
        // 1. (至少3个格子有>=3票 OR 平均票数>=4.0) AND (有彩色格子 OR 平均票数>=6.0)
        const hasEnoughVotes = validCells >= 3 || avgVotes >= 4.0;
        const isNotBlank = hasColoredCells || avgVotes >= 6.0;
        const hasContent = hasEnoughVotes && isNotBlank;
        
        if (hasContent) {
            const rowPattern = rowColors.join('');
            rows.push(rowPattern);
            
            // 输出详细调试（前2行或票数异常的行）
            if (row < 2 || avgVotes < 5) {
                console.log(`  行${row + 1}: ${rowPattern} | ${rowDebug.slice(0, 3).join(' ')} | 平均${avgVotes.toFixed(1)}票 | 彩色:${hasColoredCells}`);
            } else {
                console.log(`  行${row + 1}: ${rowPattern}`);
            }
        } else if (avgVotes > 2.0) {
            // 显示被过滤的行（但有一定内容的）
            const rowPattern = rowColors.join('');
            console.log(`  [跳过]行${row + 1}: ${rowPattern} | 有效格:${validCells}/12 | 平均${avgVotes.toFixed(1)}票 | 彩色:${hasColoredCells}`);
        }
    }
    
    return rows;
}

/**
 * 预处理图像以提高 OCR 准确率
 * 策略：灰度化 → 反转（白底黑字） → 对比度增强 → 简单阈值
 */
function preprocessImageForOCR(canvas, ctx, debug = false) {
    console.log('🔧 预处理图像...');
    
    const width = canvas.width;
    const height = canvas.height;
    
    // 创建新 canvas 用于处理
    const processCanvas = document.createElement('canvas');
    processCanvas.width = width;
    processCanvas.height = height;
    const processCtx = processCanvas.getContext('2d', { willReadFrequently: true });
    
    // 1. 复制原始图像
    processCtx.drawImage(canvas, 0, 0);
    const imageData = processCtx.getImageData(0, 0, width, height);
    const data = imageData.data;
    
    // 2. 灰度化
    for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        
        // 灰度值（加权平均）
        const gray = 0.299 * r + 0.587 * g + 0.114 * b;
        
        data[i] = data[i + 1] = data[i + 2] = gray;
    }
    
    // 3. 计算全局阈值（Otsu方法的简化版）
    const histogram = new Array(256).fill(0);
    for (let i = 0; i < data.length; i += 4) {
        histogram[Math.floor(data[i])]++;
    }
    
    // 找到直方图的两个峰值之间的谷值作为阈值
    let total = 0, sum = 0;
    for (let i = 0; i < 256; i++) {
        total += histogram[i];
        sum += i * histogram[i];
    }
    
    let sumB = 0, wB = 0, wF = 0;
    let maxVariance = 0, threshold = 128;
    
    for (let t = 0; t < 256; t++) {
        wB += histogram[t];
        if (wB === 0) continue;
        
        wF = total - wB;
        if (wF === 0) break;
        
        sumB += t * histogram[t];
        const mB = sumB / wB;
        const mF = (sum - sumB) / wF;
        
        const variance = wB * wF * (mB - mF) * (mB - mF);
        
        if (variance > maxVariance) {
            maxVariance = variance;
            threshold = t;
        }
    }
    
    console.log(`  二值化阈值 (Otsu): ${threshold}`);
    
    // 4. Wordle 特殊处理：白底 + 彩色格子 + 白字
    // 目标：格子内的白字 → 黑字，格子外的白底 → 白底
    // 策略：
    //  - 彩色格子区域 (< threshold)：内部是白字，反转后变黑字，格子变白底
    //  - 白色背景区域 (≥ threshold)：保持白色
    
    // 先记录哪些是彩色格子区域
    const isColoredCell = new Uint8Array(data.length / 4);
    for (let i = 0, j = 0; i < data.length; i += 4, j++) {
        isColoredCell[j] = data[i] < threshold ? 1 : 0;
    }
    
    // 膨胀操作：扩展彩色格子区域（包含边缘的白色文字）
    // 增大膨胀半径以确保文字完全被包含
    const dilated = new Uint8Array(isColoredCell);
    const dilateSize = 3; // 从 2 增加到 3
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const idx = y * width + x;
            if (isColoredCell[idx]) {
                // 周围区域也标记为格子区域
                for (let dy = -dilateSize; dy <= dilateSize; dy++) {
                    for (let dx = -dilateSize; dx <= dilateSize; dx++) {
                        const nx = x + dx, ny = y + dy;
                        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                            dilated[ny * width + nx] = 1;
                        }
                    }
                }
            }
        }
    }
    
    // 应用处理：在格子区域内进行二值化
    const textThreshold = 200; // 白色文字（>200）应该变黑
    for (let i = 0, j = 0; i < data.length; i += 4, j++) {
        if (dilated[j]) {
            // 彩色格子区域：白色文字(>200)→黑色，彩色背景(<200)→白色
            const gray = data[i];
            const binaryValue = gray > textThreshold ? 0 : 255;
            data[i] = data[i + 1] = data[i + 2] = binaryValue;
        } else {
            // 白色背景区域：保持白色
            data[i] = data[i + 1] = data[i + 2] = 255;
        }
    }
    
    console.log(`  处理策略: 格子区域二值化(白字→黑, 彩色→白), 背景保持白色`);
    
    processCtx.putImageData(imageData, 0, 0);
    
    // 调试：显示处理后的图像
    if (debug) {
        const debugUrl = processCanvas.toDataURL();
        console.log('🖼️ 预处理后图像（复制到浏览器查看）:');
        console.log(debugUrl.substring(0, 100) + '...');
        
        // 统计黑白像素比例
        let blackPixels = 0, whitePixels = 0;
        for (let i = 0; i < data.length; i += 4) {
            if (data[i] === 0) blackPixels++;
            else if (data[i] === 255) whitePixels++;
        }
        const total = data.length / 4;
        console.log(`  黑色: ${(blackPixels/total*100).toFixed(1)}%, 白色: ${(whitePixels/total*100).toFixed(1)}%`);
    }
    
    console.log('✅ 预处理完成');
    return processCanvas;
}

/**
 * 使用 Tesseract OCR 识别文本
 */
async function recognizeTextFromImage(imageFile, onProgress) {
    console.log('🔤 启动 OCR 识别...');
    
    return new Promise((resolve, reject) => {
        const img = new Image();
        const reader = new FileReader();
        
        reader.onload = (e) => {
            img.src = e.target.result;
        };
        
        img.onload = async () => {
            try {
                // 1. 加载到 canvas
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d', { willReadFrequently: true });
                ctx.drawImage(img, 0, 0);
                
                // 2. 预处理图像（启用调试模式）
                const processedCanvas = preprocessImageForOCR(canvas, ctx, true);
                
                // 3. 转换为 Blob
                processedCanvas.toBlob(async (blob) => {
                    // 4. 使用 Tesseract 识别
                    if (onProgress) onProgress('创建 Worker...', 0.3);
                    const worker = await Tesseract.createWorker('eng');
                    
                    if (onProgress) onProgress('设置参数...', 0.5);
                    await worker.setParameters({
                        tessedit_char_whitelist: '0123456789+-*/=\n',
                        tessedit_pageseg_mode: Tesseract.PSM.SINGLE_BLOCK, // 单一文本块模式
                        preserve_interword_spaces: '0',
                    });
                    
                    if (onProgress) onProgress('识别文字...', 0.6);
                    const { data } = await worker.recognize(blob);
                    
                    console.log('📊 OCR 置信度:', data.confidence.toFixed(1) + '%');
                    console.log('📝 原始识别文本:');
                    console.log(data.text);
                    
                    if (onProgress) onProgress('清理资源...', 0.9);
                    await worker.terminate();
                    
                    resolve(data.text);
                }, 'image/png');
                
            } catch (error) {
                reject(error);
            }
        };
        
        img.onerror = reject;
        reader.readAsDataURL(imageFile);
    });
}

/**
 * 从图片中完整提取游戏状态
 */
async function extractGameStateFromImage(imageFile, onProgress) {
    console.log('\n🎯 ===== 开始图片识别 =====\n');
    
    try {
        // 1. 提取颜色网格
        if (onProgress) onProgress('分析颜色网格...', 0.1);
        const { patterns } = await extractColorGridFromImage(imageFile);
        
        // 2. OCR 识别文本
        if (onProgress) onProgress('OCR 识别文字...', 0.3);
        const text = await recognizeTextFromImage(imageFile, (status, progress) => {
            if (onProgress) onProgress(`OCR: ${status}`, 0.3 + progress * 0.6);
        });
        
        // 3. 解析文本提取猜测
        if (onProgress) onProgress('解析猜测...', 0.9);
        const guesses = parseGuessesFromText(text, patterns);
        
        console.log('\n✅ ===== 识别完成 =====');
        console.log(`📊 总计: ${guesses.length} 个猜测`);
        
        if (onProgress) onProgress('完成！', 1.0);
        
        return {
            length: 12,
            mode4: true,
            guesses: guesses
        };
        
    } catch (error) {
        console.error('\n❌ ===== 识别失败 =====');
        console.error(error);
        throw error;
    }
}

/**
 * 从 OCR 文本中解析猜测
 */
function parseGuessesFromText(text, patterns) {
    // 清理文本：只保留有效字符
    const cleaned = text.replace(/[^0-9+\-*/=]/g, '');
    
    console.log(`\n📋 OCR原始文本长度: ${text.length}`);
    console.log(`   清理后文本长度: ${cleaned.length}`);
    console.log(`   清理后文本: ${cleaned.substring(0, 100)}${cleaned.length > 100 ? '...' : ''}`);
    
    // 使用滑动窗口提取所有可能的12位等式
    const candidates = [];
    const seen = new Set();
    
    for (let i = 0; i <= cleaned.length - 12; i++) {
        const substr = cleaned.substring(i, i + 12);
        
        // 基本验证：必须包含等号且只有一个等号
        const equalCount = (substr.match(/=/g) || []).length;
        if (equalCount !== 1) continue;
        
        // 分割等号两侧
        const [left, right] = substr.split('=');
        
        // 右侧必须是纯数字或负数
        if (!right || !/^-?\d+$/.test(right)) continue;
        
        // 左侧不能以运算符开头（除了负号）
        if (!left || /^[*/=]/.test(left)) continue;
        
        // 尝试计算验证
        try {
            const leftValue = Function('return ' + left)();
            const rightValue = parseInt(right);
            
            // 等式必须成立
            if (leftValue !== rightValue) continue;
            
            // 去重
            if (seen.has(substr)) continue;
            seen.add(substr);
            
            candidates.push(substr);
            console.log(`  ✓ 提取: ${substr} (${left} = ${right})`);
            
        } catch (e) {
            // 无效的表达式，跳过
            continue;
        }
    }
    
    console.log(`\n🔍 有效候选等式 ${candidates.length} 个`);
    
    // 匹配猜测与颜色
    const guesses = [];
    const maxRows = Math.max(...patterns.map(p => p.length));
    
    console.log(`\n🔗 匹配 ${candidates.length} 个候选与 ${maxRows} 行颜色...`);
    
    for (let i = 0; i < maxRows; i++) {
        let guess = null;
        
        // 尝试找到对应的文本
        if (i < candidates.length) {
            guess = candidates[i];
        } else {
            // 没有更多文本了，使用占位符
            console.log(`  ⚠ 第 ${i + 1} 行缺少文本，使用占位符`);
            guess = '????????????';
        }
        
        const fourPatterns = patterns.map(p => p[i] || 'xxxxxxxxxxxx');
        
        guesses.push({
            guess: guess,
            patterns: fourPatterns,
            is4Mode: true
        });
        
        console.log(`  ✓ 行${i + 1}: ${guess} | [${fourPatterns.map((p, idx) => {
            const allGreen = p.split('').every(c => c === 'g');
            return allGreen ? `T${idx+1}:全绿` : `T${idx+1}:混合`;
        }).join(', ')}]`);
    }
    
    console.log(`\n✓ 解析出 ${guesses.length} 个有效猜测`);
    return guesses;
}

/**
 * 从剪贴板读取图片
 */
async function getImageFromClipboard() {
    try {
        const items = await navigator.clipboard.read();
        
        for (const item of items) {
            for (const type of item.types) {
                if (type.startsWith('image/')) {
                    const blob = await item.getType(type);
                    console.log(`📋 从剪贴板获取图片: ${type}, ${(blob.size / 1024).toFixed(1)}KB`);
                    return blob;
                }
            }
        }
        
        throw new Error('剪贴板中没有图片');
    } catch (error) {
        console.error('❌ 剪贴板读取失败:', error);
        throw new Error('无法读取剪贴板图片。请确保已复制图片并授予权限。');
    }
}
