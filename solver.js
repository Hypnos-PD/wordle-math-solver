// solver.js - 核心求解逻辑
// 纯函数实现，不依赖 DOM

/**
 * 验证等式是否合法
 * @param {string} expr - 等式字符串
 * @returns {boolean}
 */
function isValidEquation(expr) {
    // 基本长度和字符检查
    if (!expr || expr.length < 5) return false;
    
    // 只允许数字和运算符
    if (!/^[0-9+\-*/=]+$/.test(expr)) return false;
    
    // 必须恰好有一个等号，且不在首末
    const equalCount = (expr.match(/=/g) || []).length;
    if (equalCount !== 1) return false;
    if (expr[0] === '=' || expr[expr.length - 1] === '=') return false;
    
    // 分割左右两侧
    const parts = expr.split('=');
    if (parts.length !== 2) return false;
    
    const [left, right] = parts;
    
    // 左右侧不能为空
    if (!left || !right) return false;
    
    // 右侧只能是纯数字或负数
    if (!/^-?\d+$/.test(right)) return false;
    
    // 左侧不能以 * / 开头
    if (left[0] === '*' || left[0] === '/') return false;
    
    // 尝试求值
    try {
        // 严格限制输入，防止注入
        if (!/^[0-9+\-*/]+$/.test(left)) return false;
        
        const leftValue = Function('return ' + left)();
        const rightValue = parseInt(right, 10);
        
        // 检查是否为有效数字
        if (!Number.isFinite(leftValue) || !Number.isFinite(rightValue)) {
            return false;
        }
        
        // 验证等式成立
        return leftValue === rightValue;
    } catch (e) {
        return false;
    }
}

/**
 * 检查新的颜色反馈是否与已有约束矛盾
 * @param {string} guess - 猜测字符串
 * @param {string|Array} patterns - 颜色模式（单式为字符串，4式为数组）
 * @param {Object} existingConstraints - 已有约束
 * @returns {Object} {valid: boolean, error: string}
 */
function checkPatternConsistency(guess, patterns, existingConstraints) {
    // 如果是数组（4式模式），只检查第一个（或可以全检查）
    const pattern = Array.isArray(patterns) ? patterns[0] : patterns;
    
    if (!pattern || pattern.length !== guess.length) {
        return { valid: false, error: '颜色模式长度不匹配' };
    }
    
    // 检查每个位置
    for (let i = 0; i < guess.length; i++) {
        const ch = guess[i];
        const color = pattern[i];
        
        // 检查绿色位置冲突
        if (existingConstraints.greens[i]) {
            if (existingConstraints.greens[i] !== ch) {
                // 如果该位置已经固定为其他字符，当前猜测不应该在这个位置
                if (color === 'g') {
                    return { 
                        valid: false, 
                        error: `位置 ${i+1} 已固定为 '${existingConstraints.greens[i]}'，但标记 '${ch}' 为绿色` 
                    };
                }
            } else {
                // 如果该位置已经固定为该字符，必须是绿色
                if (color !== 'g') {
                    return { 
                        valid: false, 
                        error: `位置 ${i+1} 已固定为 '${ch}'，应标记为绿色` 
                    };
                }
            }
        }
        
        // 检查字符是否在排除列表中
        if (existingConstraints.excluded.has(ch)) {
            if (color === 'g' || color === 'y') {
                return { 
                    valid: false, 
                    error: `字符 '${ch}' 已被排除，不应标记为绿色或黄色` 
                };
            }
        }
        
        // 检查黄色禁止位置
        if (existingConstraints.yellowForbiddenPositions[ch]?.has(i)) {
            if (color === 'y' || color === 'g') {
                return { 
                    valid: false, 
                    error: `字符 '${ch}' 在位置 ${i+1} 已被禁止，不应标记为黄色或绿色` 
                };
            }
        }
    }
    
    // 检查字符出现次数是否超过上限
    const charCounts = {};
    for (let i = 0; i < guess.length; i++) {
        const ch = guess[i];
        const color = pattern[i];
        
        if (color === 'g' || color === 'y') {
            charCounts[ch] = (charCounts[ch] || 0) + 1;
        }
    }
    
    for (const [ch, count] of Object.entries(charCounts)) {
        if (existingConstraints.maxCounts[ch] !== undefined) {
            if (count > existingConstraints.maxCounts[ch]) {
                return { 
                    valid: false, 
                    error: `字符 '${ch}' 标记为绿/黄的次数 (${count}) 超过已知上限 (${existingConstraints.maxCounts[ch]})` 
                };
            }
        }
    }
    
    return { valid: true };
}

/**
 * 从猜测历史构建约束对象
 * @param {Array} guesses - 猜测历史 [{guess, patterns}]
 * @param {number} length - 等式长度
 * @returns {Object} 约束对象
 */
function buildConstraintsFromGuesses(guesses, length) {
    const constraints = {
        greens: Array(length).fill(null),
        requiredCounts: {},
        maxCounts: {},
        excluded: new Set(),
        yellowForbiddenPositions: {}
    };
    
    // 遍历所有猜测
    for (const {guess, patterns} of guesses) {
        // 对于单式模式，patterns 是字符串；4式模式是数组
        const pattern = Array.isArray(patterns) ? patterns[0] : patterns;
        
        if (!pattern || pattern.length !== guess.length) continue;
        
        // 先统计该猜测中每个字符的颜色
        const charColors = {};
        for (let i = 0; i < guess.length; i++) {
            const ch = guess[i];
            if (!charColors[ch]) {
                charColors[ch] = { green: 0, yellow: 0, gray: 0 };
            }
            if (pattern[i] === 'g') charColors[ch].green++;
            else if (pattern[i] === 'y') charColors[ch].yellow++;
            else if (pattern[i] === 'x') charColors[ch].gray++;
        }
        
        // 处理每个字符
        for (let i = 0; i < guess.length; i++) {
            const ch = guess[i];
            const color = pattern[i];
            
            if (color === 'g') {
                // 绿色：该位置固定
                constraints.greens[i] = ch;
                // 增加必需次数
                constraints.requiredCounts[ch] = (constraints.requiredCounts[ch] || 0) + 1;
            } else if (color === 'y') {
                // 黄色：字符存在但不在此位置
                constraints.requiredCounts[ch] = (constraints.requiredCounts[ch] || 0) + 1;
                // 该位置禁止该字符
                if (!constraints.yellowForbiddenPositions[ch]) {
                    constraints.yellowForbiddenPositions[ch] = new Set();
                }
                constraints.yellowForbiddenPositions[ch].add(i);
            } else if (color === 'x') {
                // 灰色
                const hasGreenOrYellow = charColors[ch].green > 0 || charColors[ch].yellow > 0;
                
                if (!hasGreenOrYellow) {
                    // 该字符完全不存在
                    constraints.excluded.add(ch);
                } else {
                    // 该字符存在但次数有上限
                    const totalRequired = charColors[ch].green + charColors[ch].yellow;
                    constraints.maxCounts[ch] = totalRequired;
                }
                
                // 灰色位置也禁止该字符
                if (hasGreenOrYellow) {
                    if (!constraints.yellowForbiddenPositions[ch]) {
                        constraints.yellowForbiddenPositions[ch] = new Set();
                    }
                    constraints.yellowForbiddenPositions[ch].add(i);
                }
            }
        }
    }
    
    return constraints;
}

/**
 * 计算候选等式的评分
 * @param {string} expr - 等式
 * @returns {number} 分数
 */
function scoreCandidate(expr) {
    const uniqueChars = new Set(expr.split('')).size;
    const operatorCount = (expr.match(/[+\-*/]/g) || []).length;
    return uniqueChars * 1.5 - operatorCount;
}

/**
 * DFS 生成候选等式
 * @param {Object} constraints - 约束对象
 * @param {Object} options - 配置 {length, maxResults, timeoutMs, cancelledRef}
 * @returns {Array} 候选等式列表
 */
function generateCandidates(constraints, options) {
    const {
        length,
        maxResults = 200,
        timeoutMs = 2000,
        cancelledRef = { value: false }
    } = options;
    
    const results = [];
    const startTime = Date.now();
    
    // 可用字符集
    const allowedChars = '0123456789+-*/='.split('').filter(ch => !constraints.excluded.has(ch));
    
    // DFS 递归函数
    function dfs(pos, current, used, hasEqual) {
        // 检查超时和取消
        if (cancelledRef.value || Date.now() - startTime > timeoutMs) {
            return;
        }
        
        // 达到最大结果数
        if (results.length >= maxResults) {
            return;
        }
        
        // 完成一个候选
        if (pos === length) {
            // 必须有等号
            if (!hasEqual) return;
            
            // 验证等式
            if (isValidEquation(current)) {
                // 检查是否满足必需次数
                let valid = true;
                for (const [ch, minCount] of Object.entries(constraints.requiredCounts)) {
                    if ((used[ch] || 0) < minCount) {
                        valid = false;
                        break;
                    }
                }
                
                if (valid) {
                    results.push(current);
                }
            }
            return;
        }
        
        // 如果该位置有绿色固定字符
        if (constraints.greens[pos]) {
            const ch = constraints.greens[pos];
            const newUsed = { ...used };
            newUsed[ch] = (newUsed[ch] || 0) + 1;
            
            // 检查是否超过最大次数
            if (constraints.maxCounts[ch] && newUsed[ch] > constraints.maxCounts[ch]) {
                return;
            }
            
            dfs(pos + 1, current + ch, newUsed, hasEqual || ch === '=');
            return;
        }
        
        // 尝试每个可用字符
        for (const ch of allowedChars) {
            // 等号限制：只能有一个，不在首末
            if (ch === '=') {
                if (hasEqual || pos === 0 || pos === length - 1) continue;
            }
            
            // 检查位置禁止
            if (constraints.yellowForbiddenPositions[ch]?.has(pos)) {
                continue;
            }
            
            // 检查次数限制
            const newUsed = { ...used };
            newUsed[ch] = (newUsed[ch] || 0) + 1;
            
            if (constraints.maxCounts[ch] && newUsed[ch] > constraints.maxCounts[ch]) {
                continue;
            }
            
            // 剪枝：检查剩余位置是否足够满足必需次数
            const remaining = length - pos - 1;
            let needMore = 0;
            for (const [reqCh, minCount] of Object.entries(constraints.requiredCounts)) {
                const currentCount = newUsed[reqCh] || 0;
                if (currentCount < minCount) {
                    needMore += minCount - currentCount;
                }
            }
            if (needMore > remaining) {
                continue;
            }
            
            // 递归
            dfs(pos + 1, current + ch, newUsed, hasEqual || ch === '=');
        }
    }
    
    // 开始 DFS
    dfs(0, '', {}, false);
    
    // 排序
    results.sort((a, b) => scoreCandidate(b) - scoreCandidate(a));
    
    return results;
}

/**
 * 为 4 式模式生成候选（分别对每个目标求解）
 * @param {Array} guesses - 猜测历史
 * @param {Object} options - 配置
 * @returns {Array} 4 个结果数组
 */
function generateCandidatesFor4Mode(guesses, options) {
    const results = [];
    
    for (let targetIdx = 0; targetIdx < 4; targetIdx++) {
        // 为每个目标构建独立约束
        const targetGuesses = guesses.map(({guess, patterns}) => ({
            guess,
            patterns: patterns[targetIdx]
        }));
        
        const constraints = buildConstraintsFromGuesses(targetGuesses, options.length);
        const candidates = generateCandidates(constraints, options);
        
        results.push(candidates);
    }
    
    return results;
}
