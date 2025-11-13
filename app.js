// app.js - 主应用逻辑与 UI 交互

// 全局状态
const state = {
    length: 12,
    maxResults: 200,
    mode4: false,
    currentInput: [],           // 字符数组
    currentStates: [],          // 单式模式：颜色状态数组（默认 'x'）
    colorGrids: [[], [], [], []], // 4式模式：4组颜色状态（默认 'x'）
    guesses: [],                // 历史记录
    focusedIndex: 0,
    cancelledRef: { value: false }
};

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    initializeControls();
    initializeInputGrid();
    initializeEventListeners();
});

// 初始化控制区
function initializeControls() {
    document.getElementById('length').value = state.length;
    document.getElementById('maxResults').value = state.maxResults;
    document.getElementById('mode4').checked = state.mode4;
    
    // 监听控制变化
    document.getElementById('length').addEventListener('change', (e) => {
        const newLength = parseInt(e.target.value, 10);
        if (newLength >= 5 && newLength <= 20) {
            state.length = newLength;
            initializeInputGrid();
        }
    });
    
    document.getElementById('maxResults').addEventListener('change', (e) => {
        state.maxResults = parseInt(e.target.value, 10);
    });
    
    document.getElementById('mode4').addEventListener('change', (e) => {
        state.mode4 = e.target.checked;
        toggleMode4Display();
    });
}

// 初始化输入网格
function initializeInputGrid() {
    const container = document.getElementById('mainInputContainer');
    container.innerHTML = '';
    
    state.currentInput = Array(state.length).fill('');
    state.currentStates = Array(state.length).fill('x');
    state.colorGrids = [
        Array(state.length).fill('x'),
        Array(state.length).fill('x'),
        Array(state.length).fill('x'),
        Array(state.length).fill('x')
    ];
    state.focusedIndex = 0;
    
    for (let i = 0; i < state.length; i++) {
        const cell = createInputCell(i);
        container.appendChild(cell);
    }
    
    // 初始化 4 式模式的颜色网格
    initialize4ModeGrids();
    
    // 聚焦第一个
    updateFocus();
}

// 创建输入格子
function createInputCell(index) {
    const cell = document.createElement('div');
    cell.className = 'input-cell';
    cell.dataset.index = index;
    cell.textContent = '';
    
    // 左键点击：循环颜色（仅单式模式）或聚焦输入
    cell.addEventListener('click', (e) => {
        state.focusedIndex = index;
        updateFocus();
        
        if (!state.mode4) {
            cycleColor(index, false);
        }
    });
    
    // 右键点击：逆序循环颜色（仅单式模式）
    cell.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        state.focusedIndex = index;
        updateFocus();
        
        if (!state.mode4) {
            cycleColor(index, true);
        }
    });
    
    return cell;
}

// 初始化 4 式模式颜色网格
function initialize4ModeGrids() {
    const container = document.getElementById('colorGridsContainer');
    
    for (let gridIdx = 0; gridIdx < 4; gridIdx++) {
        const gridDiv = container.querySelector(`[data-grid="${gridIdx}"] .grid-cells`);
        gridDiv.innerHTML = '';
        
        for (let i = 0; i < state.length; i++) {
            const cell = createColorGridCell(gridIdx, i);
            gridDiv.appendChild(cell);
        }
    }
}

// 创建 4 式模式的颜色格子
function createColorGridCell(gridIdx, index) {
    const cell = document.createElement('div');
    cell.className = 'input-cell';
    cell.dataset.grid = gridIdx;
    cell.dataset.index = index;
    cell.textContent = state.currentInput[index] || '';
    
    // 左键循环
    cell.addEventListener('click', () => {
        cycle4ModeColor(gridIdx, index, false);
    });
    
    // 右键逆序循环
    cell.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        cycle4ModeColor(gridIdx, index, true);
    });
    
    return cell;
}

// 切换 4 式模式显示
function toggleMode4Display() {
    const colorGridsContainer = document.getElementById('colorGridsContainer');
    const singleModeActions = document.getElementById('singleModeActions');
    
    if (state.mode4) {
        colorGridsContainer.style.display = 'block';
        singleModeActions.style.display = 'none';
        // 清除主输入的颜色状态
        state.currentStates = Array(state.length).fill('x');
        renderInputGrid();
    } else {
        colorGridsContainer.style.display = 'none';
        singleModeActions.style.display = 'flex';
    }
}

// 颜色循环（单式模式）
function cycleColor(index, reverse = false) {
    const states = ['x', 'y', 'g'];
    const currentState = state.currentStates[index] || 'x';
    let currentIdx = states.indexOf(currentState);
    
    if (reverse) {
        currentIdx = (currentIdx - 1 + states.length) % states.length;
    } else {
        currentIdx = (currentIdx + 1) % states.length;
    }
    
    state.currentStates[index] = states[currentIdx];
    renderInputGrid();
}

// 4 式模式颜色循环
function cycle4ModeColor(gridIdx, index, reverse = false) {
    const states = ['x', 'y', 'g'];
    const currentState = state.colorGrids[gridIdx][index] || 'x';
    let currentIdx = states.indexOf(currentState);
    
    if (reverse) {
        currentIdx = (currentIdx - 1 + states.length) % states.length;
    } else {
        currentIdx = (currentIdx + 1) % states.length;
    }
    
    state.colorGrids[gridIdx][index] = states[currentIdx];
    render4ModeGrids();
}

// 渲染主输入网格
function renderInputGrid() {
    const container = document.getElementById('mainInputContainer');
    const cells = container.querySelectorAll('.input-cell');
    
    cells.forEach((cell, i) => {
        cell.textContent = state.currentInput[i] || '';
        
        // 应用颜色状态（仅单式模式）
        cell.className = 'input-cell';
        if (!state.mode4) {
            const colorState = state.currentStates[i] || 'x';
            cell.classList.add(`state-${colorState}`);
        }
        
        if (i === state.focusedIndex) {
            cell.classList.add('focused');
        }
    });
}

// 渲染 4 式模式颜色网格
function render4ModeGrids() {
    for (let gridIdx = 0; gridIdx < 4; gridIdx++) {
        const cells = document.querySelectorAll(`[data-grid="${gridIdx}"] .input-cell`);
        
        cells.forEach((cell, i) => {
            cell.textContent = state.currentInput[i] || '';
            cell.className = 'input-cell';
            
            const colorState = state.colorGrids[gridIdx][i] || 'x';
            cell.classList.add(`state-${colorState}`);
        });
    }
}

// 更新焦点
function updateFocus() {
    renderInputGrid();
}

// 键盘输入处理
// 检查是否需要自动应用已解决的模式
function checkAndAutoApplySolved() {
    const currentGuess = state.currentInput.join('');
    if (currentGuess.length !== state.length) return;
    
    // 查找历史中已解决的猜测
    const solvedGuesses = state.guesses.filter(g => g.solved);
    
    for (const solved of solvedGuesses) {
        if (solved.guess === currentGuess) {
            if (state.mode4 && solved.is4Mode) {
                // 4式模式：自动应用全绿的目标
                const patterns = solved.patterns;
                patterns.forEach((p, idx) => {
                    if (typeof p === 'string' && p.split('').every(c => c === 'g')) {
                        state.colorGrids[idx] = Array(state.length).fill('g');
                    }
                });
                render4ModeGrids();
                showStatus('✓ 已自动应用已解决的颜色', 'info');
            } else if (!state.mode4 && !solved.is4Mode) {
                // 单式模式
                if (typeof solved.patterns === 'string' && solved.patterns.split('').every(c => c === 'g')) {
                    state.currentStates = Array(state.length).fill('g');
                    renderInputGrid();
                    showStatus('✓ 已自动应用已解决的颜色', 'info');
                }
            }
            break;
        }
    }
}

document.addEventListener('keydown', (e) => {
    // 如果焦点在输入框上，跳过
    if (e.target.tagName === 'INPUT') return;
    
    const key = e.key;
    
    // 允许的字符
    if (/^[0-9+\-*/=]$/.test(key)) {
        state.currentInput[state.focusedIndex] = key;
        renderInputGrid();
        
        // 同步到 4 式模式
        if (state.mode4) {
            render4ModeGrids();
        }
        
        // 自动前进
        if (state.focusedIndex < state.length - 1) {
            state.focusedIndex++;
            updateFocus();
        } else {
            // 输入完成，检查是否需要自动应用
            checkAndAutoApplySolved();
        }
    }
    
    // 退格
    else if (key === 'Backspace') {
        e.preventDefault();
        if (state.currentInput[state.focusedIndex]) {
            state.currentInput[state.focusedIndex] = '';
            renderInputGrid();
            if (state.mode4) render4ModeGrids();
        } else if (state.focusedIndex > 0) {
            state.focusedIndex--;
            state.currentInput[state.focusedIndex] = '';
            updateFocus();
            if (state.mode4) render4ModeGrids();
        }
    }
    
    // 左右箭头
    else if (key === 'ArrowLeft') {
        e.preventDefault();
        if (state.focusedIndex > 0) {
            state.focusedIndex--;
            updateFocus();
        }
    }
    else if (key === 'ArrowRight') {
        e.preventDefault();
        if (state.focusedIndex < state.length - 1) {
            state.focusedIndex++;
            updateFocus();
        }
    }
});

// 粘贴处理
document.addEventListener('paste', (e) => {
    if (e.target.tagName === 'INPUT') return;
    
    e.preventDefault();
    const text = e.clipboardData.getData('text');
    const validChars = text.split('').filter(ch => /^[0-9+\-*/=]$/.test(ch));
    
    let idx = state.focusedIndex;
    for (const ch of validChars) {
        if (idx >= state.length) break;
        state.currentInput[idx] = ch;
        idx++;
    }
    
    state.focusedIndex = Math.min(idx, state.length - 1);
    renderInputGrid();
    if (state.mode4) render4ModeGrids();
    
    // 检查是否需要自动应用
    checkAndAutoApplySolved();
});

// 事件监听器
function initializeEventListeners() {
    // 添加猜测
    document.getElementById('addGuess').addEventListener('click', addCurrentGuess);
    
    // 单式模式：全绿按钮
    document.getElementById('setAllGreen').addEventListener('click', () => {
        if (state.currentInput.join('').length === state.length) {
            state.currentStates = Array(state.length).fill('g');
            renderInputGrid();
            showStatus('已设置为全绿', 'success');
        } else {
            showStatus('请先输入完整的等式', 'warning');
        }
    });
    
    // 4式模式：全绿按钮
    document.querySelectorAll('.set-all-green-4').forEach(btn => {
        btn.addEventListener('click', () => {
            const targetIdx = parseInt(btn.dataset.target);
            if (state.currentInput.join('').length === state.length) {
                state.colorGrids[targetIdx] = Array(state.length).fill('g');
                render4ModeGrids();
                showStatus(`目标 ${targetIdx + 1} 已设置为全绿`, 'success');
            } else {
                showStatus('请先输入完整的等式', 'warning');
            }
        });
    });
    
    // 清空当前输入
    document.getElementById('clearCurrent').addEventListener('click', () => {
        state.currentInput = Array(state.length).fill('');
        state.currentStates = Array(state.length).fill('x');
        state.colorGrids = [
            Array(state.length).fill('x'),
            Array(state.length).fill('x'),
            Array(state.length).fill('x'),
            Array(state.length).fill('x')
        ];
        state.focusedIndex = 0;
        renderInputGrid();
        if (state.mode4) render4ModeGrids();
    });
    
    // 清空历史
    document.getElementById('clearHistory').addEventListener('click', () => {
        state.guesses = [];
        renderHistory();
    });
    
    // 删除最新猜测
    document.getElementById('deleteLastGuess').addEventListener('click', () => {
        if (state.guesses.length > 0) {
            state.guesses.pop();
            renderHistory();
            showStatus('已删除最新猜测', 'success');
        } else {
            showStatus('没有可删除的猜测', 'warning');
        }
    });
    
    // 搜索
    document.getElementById('startSearch').addEventListener('click', startSearch);
    document.getElementById('cancelSearch').addEventListener('click', cancelSearch);
    
    // 导入导出
    document.getElementById('exportState').addEventListener('click', exportState);
    document.getElementById('importState').addEventListener('click', importState);
}

// 添加当前猜测到历史
function addCurrentGuess() {
    const guess = state.currentInput.join('');
    
    if (!guess || guess.length !== state.length) {
        showStatus('请输入完整的等式', 'error');
        return;
    }
    
    // 检查是否所有字符都有效
    if (!/^[0-9+\-*/=]+$/.test(guess)) {
        showStatus('包含非法字符', 'error');
        return;
    }
    
    let patterns;
    
    if (state.mode4) {
        // 4 式模式：收集 4 组颜色
        patterns = state.colorGrids.map(grid => 
            grid.map(s => s || 'x').join('')
        );
    } else {
        // 单式模式
        patterns = state.currentStates.map(s => s || 'x').join('');
    }
    
    // 检测是否有全绿的模式（已解决）
    const hasAllGreen = state.mode4 
        ? patterns.some(p => p.split('').every(c => c === 'g'))
        : patterns.split('').every(c => c === 'g');
    
    if (hasAllGreen) {
        // 如果有全绿，直接添加并标记为已解决
        state.guesses.push({
            guess,
            patterns,
            is4Mode: state.mode4,
            solved: true
        });
        renderHistory();
        showStatus('✓ 已添加已解决的猜测（全绿）', 'success');
        return;
    }
    
    // 检查颜色反馈是否与已有约束矛盾
    if (state.guesses.length > 0) {
        // 构建已有约束
        const existingConstraints = buildConstraintsFromGuesses(state.guesses, state.length);
        
        // 检查一致性
        const checkResult = checkPatternConsistency(guess, patterns, existingConstraints);
        
        if (!checkResult.valid) {
            showStatus('约束冲突: ' + checkResult.error, 'error');
            return;
        }
    }
    
    state.guesses.push({
        guess,
        patterns,
        is4Mode: state.mode4
    });
    
    renderHistory();
    showStatus('已添加猜测', 'success');
}

// 自动应用已解决的模式（全绿）
// 渲染历史记录
function renderHistory() {
    const container = document.getElementById('historyList');
    
    if (state.guesses.length === 0) {
        container.innerHTML = '<p class="empty-hint">暂无猜测记录</p>';
        return;
    }
    
    container.innerHTML = '';
    
    state.guesses.forEach((item, idx) => {
        const div = document.createElement('div');
        div.className = 'history-item';
        
        const guessText = document.createElement('span');
        guessText.className = 'guess-text';
        guessText.textContent = item.guess;
        
        // 如果是已解决的，添加标记
        if (item.solved) {
            const solvedBadge = document.createElement('span');
            solvedBadge.className = 'solved-badge';
            solvedBadge.textContent = '✓ 已解决';
            solvedBadge.style.marginLeft = '8px';
            solvedBadge.style.color = 'var(--color-green)';
            solvedBadge.style.fontWeight = 'bold';
            solvedBadge.style.fontSize = '0.9em';
            guessText.appendChild(solvedBadge);
        }
        
        div.appendChild(guessText);
        
        if (item.is4Mode) {
            // 4 式模式：显示 4 组颜色，分两行
            const patterns4Mode = document.createElement('div');
            patterns4Mode.className = 'patterns-4mode';
            
            // 第一行：目标1 和 目标2
            const row1 = document.createElement('div');
            row1.className = 'patterns-row';
            
            const label1 = document.createElement('span');
            label1.className = 'pattern-label';
            label1.textContent = '目标1:';
            row1.appendChild(label1);
            row1.appendChild(createPatternDisplay(item.patterns[0], item.guess));
            
            const label2 = document.createElement('span');
            label2.className = 'pattern-label';
            label2.textContent = '目标2:';
            label2.style.marginLeft = '10px';
            row1.appendChild(label2);
            row1.appendChild(createPatternDisplay(item.patterns[1], item.guess));
            
            patterns4Mode.appendChild(row1);
            
            // 第二行：目标3 和 目标4
            const row2 = document.createElement('div');
            row2.className = 'patterns-row';
            
            const label3 = document.createElement('span');
            label3.className = 'pattern-label';
            label3.textContent = '目标3:';
            row2.appendChild(label3);
            row2.appendChild(createPatternDisplay(item.patterns[2], item.guess));
            
            const label4 = document.createElement('span');
            label4.className = 'pattern-label';
            label4.textContent = '目标4:';
            label4.style.marginLeft = '10px';
            row2.appendChild(label4);
            row2.appendChild(createPatternDisplay(item.patterns[3], item.guess));
            
            patterns4Mode.appendChild(row2);
            
            div.appendChild(patterns4Mode);
        } else {
            // 单式模式
            const patternDiv = createPatternDisplay(item.patterns, item.guess);
            div.appendChild(patternDiv);
        }
        
        container.appendChild(div);
    });
}

// 创建颜色模式显示
function createPatternDisplay(pattern, guess) {
    const div = document.createElement('div');
    div.className = 'pattern';
    
    for (let i = 0; i < pattern.length; i++) {
        const cell = document.createElement('div');
        cell.className = 'pattern-cell';
        cell.textContent = guess[i] || '';
        const color = pattern[i];
        if (color === 'g') cell.style.background = 'var(--color-green)';
        else if (color === 'y') cell.style.background = 'var(--color-yellow)';
        else cell.style.background = 'var(--color-gray)';
        cell.style.color = 'white';
        cell.style.fontWeight = 'bold';
        cell.style.fontSize = '12px';
        cell.style.display = 'flex';
        cell.style.alignItems = 'center';
        cell.style.justifyContent = 'center';
        div.appendChild(cell);
    }
    
    return div;
}

// 开始搜索
async function startSearch() {
    if (state.guesses.length === 0) {
        showStatus('请先添加至少一个猜测', 'warning');
        return;
    }
    
    // 重置取消标志
    state.cancelledRef.value = false;
    
    // UI 更新
    document.getElementById('startSearch').style.display = 'none';
    document.getElementById('cancelSearch').style.display = 'inline-block';
    showStatus('正在搜索候选...', 'info');
    
    // 清空结果容器
    const resultsContainer = document.getElementById('resultsContainer');
    resultsContainer.innerHTML = '<p class="empty-hint">搜索中，请稍候...</p>';
    
    const startTime = Date.now();
    
    try {
        if (state.mode4) {
            // 4 式模式
            console.log('=== 4式模式调试 ===');
            console.log('猜测历史:', state.guesses);
            
            await search4ModeAsync(startTime);
        } else {
            // 单式模式
            await searchSingleModeAsync(startTime);
        }
    } catch (error) {
        showStatus('搜索出错: ' + error.message, 'error');
        console.error(error);
    } finally {
        document.getElementById('startSearch').style.display = 'inline-block';
        document.getElementById('cancelSearch').style.display = 'none';
    }
}

// 单式模式异步搜索
async function searchSingleModeAsync(startTime) {
    const constraints = buildConstraintsFromGuesses(state.guesses, state.length);
    console.log('=== 单式模式调试 ===');
    console.log('约束:', constraints);
    
    // 估算搜索空间
    const estimatedSpace = estimateSearchSpace(constraints, state.length);
    console.log('估算搜索空间:', estimatedSpace);
    
    // 显示进度条
    const progressDiv = document.getElementById('searchProgress');
    const progressBar = document.getElementById('progressBar');
    const progressText = document.getElementById('progressText');
    progressDiv.style.display = 'block';
    progressBar.style.width = '0%';
    progressText.textContent = `估算搜索空间: ${estimatedSpace.toLocaleString()}`;
    
    // 初始化结果容器
    const resultsContainer = document.getElementById('resultsContainer');
    resultsContainer.innerHTML = '';
    
    const group = document.createElement('div');
    group.className = 'results-group';
    group.id = 'single-mode-results';
    
    const title = document.createElement('h3');
    title.textContent = '搜索中...';
    group.appendChild(title);
    
    const list = document.createElement('div');
    list.className = 'results-list';
    group.appendChild(list);
    
    resultsContainer.appendChild(group);
    
    // 使用异步版本
    const results = await generateCandidatesAsync(constraints, {
        length: state.length,
        maxResults: state.maxResults,
        cancelledRef: state.cancelledRef,
        estimatedSpace: estimatedSpace, // 传入估算空间
        onProgress: (progress) => {
            // 更新进度条 - 根据估算空间计算真实百分比
            const percent = Math.min(100, (progress.explored / Math.max(estimatedSpace, 1)) * 100);
            progressBar.style.width = percent.toFixed(1) + '%';
            progressText.textContent = `进度: ${percent.toFixed(1)}% | 已探索: ${progress.explored.toLocaleString()} | 已找到: ${progress.found} 个`;
            
            // 流式输出：每找到一个新结果就立即显示
            if (progress.newResult) {
                title.textContent = `已找到 ${progress.found} 个候选（搜索中...）`;
                
                const item = document.createElement('div');
                item.className = 'result-item';
                item.textContent = progress.newResult;
                item.title = '点击复制';
                item.addEventListener('click', () => copyResultToClipboard(item));
                list.appendChild(item);
            }
        }
    });
    
    console.log('搜索结果:', results);
    
    // 搜索完成，强制进度条到100%
    progressBar.style.width = '100%';
    progressText.textContent = `完成 | 已探索完毕 | 找到: ${results.length} 个`;
    
    // 短暂延迟后隐藏进度条
    setTimeout(() => {
        progressDiv.style.display = 'none';
    }, 1000);
    
    // 更新最终标题
    title.textContent = `找到 ${results.length} 个候选`;
    
    const meta = document.createElement('div');
    meta.className = 'result-meta';
    meta.textContent = `用时: ${Date.now() - startTime}ms`;
    group.appendChild(meta);
    
    if (state.cancelledRef.value) {
        showStatus('搜索已取消，找到 ' + results.length + ' 个候选', 'warning');
    } else {
        showStatus(`搜索完成，找到 ${results.length} 个候选，用时 ${Date.now() - startTime}ms`, 'success');
    }
}

// 4式模式异步搜索
async function search4ModeAsync(startTime) {
    const resultsContainer = document.getElementById('resultsContainer');
    resultsContainer.innerHTML = '';
    
    // 显示4式进度条
    const progressDiv4 = document.getElementById('searchProgress4');
    progressDiv4.style.display = 'grid';
    
    // 初始化所有进度条
    for (let i = 0; i < 4; i++) {
        const progressItem = progressDiv4.querySelector(`[data-target="${i}"]`);
        const progressBar = progressItem.querySelector('.progress-bar');
        const progressText = progressItem.querySelector('.progress-text');
        progressBar.style.width = '0%';
        progressText.textContent = '准备搜索...';
    }
    
    // 创建4个目标的占位容器
    const targetGroups = [];
    const targetLists = [];
    
    for (let i = 0; i < 4; i++) {
        const group = document.createElement('div');
        group.className = 'results-group';
        group.id = `target-${i}`;
        
        const title = document.createElement('h3');
        title.textContent = `目标 ${i + 1}：准备搜索...`;
        group.appendChild(title);
        
        const list = document.createElement('div');
        list.className = 'results-list';
        group.appendChild(list);
        
        resultsContainer.appendChild(group);
        targetGroups.push(group);
        targetLists.push(list);
    }
    
    // 同时搜索4个目标
    const promises = [];
    const completedCounts = [0, 0, 0, 0];
    
    for (let targetIdx = 0; targetIdx < 4; targetIdx++) {
        const promise = searchSingleTargetAsync(targetIdx, state.guesses, {
            length: state.length,
            maxResults: state.maxResults,
            cancelledRef: state.cancelledRef,
            onTargetProgress: (progress) => {
                // 更新该目标的进度条
                const progressItem = progressDiv4.querySelector(`[data-target="${targetIdx}"]`);
                const progressBar = progressItem.querySelector('.progress-bar');
                const progressText = progressItem.querySelector('.progress-text');
                
                // 如果搜索完成，强制设为100%
                if (progress.completed) {
                    progressBar.style.width = '100%';
                    progressText.textContent = `100% | 找到: ${progress.found}`;
                } else {
                    // 根据估算空间计算真实百分比
                    const percent = Math.min(100, (progress.explored / Math.max(progress.estimatedSpace || 1, 1)) * 100);
                    progressBar.style.width = percent.toFixed(1) + '%';
                    progressText.textContent = `${percent.toFixed(1)}% | 找到: ${progress.found}`;
                }
                
                // 实时更新该目标的显示
                const title = targetGroups[targetIdx].querySelector('h3');
                if (progress.completed) {
                    title.textContent = `目标 ${targetIdx + 1}：找到 ${progress.found} 个候选`;
                } else {
                    title.textContent = `目标 ${targetIdx + 1}：已找到 ${progress.found} 个（探索: ${progress.explored.toLocaleString()}）`;
                }
                
                // 流式输出：每找到一个新结果就立即显示
                if (progress.newResult) {
                    const item = document.createElement('div');
                    item.className = 'result-item';
                    item.textContent = progress.newResult;
                    item.title = '点击复制';
                    item.addEventListener('click', () => copyResultToClipboard(item));
                    targetLists[targetIdx].appendChild(item);
                    completedCounts[targetIdx] = progress.found;
                }
            }
        });
        
        promises.push(promise);
    }
    
    const results = await Promise.all(promises);
    
    // 短暂延迟后隐藏进度条，让用户看到100%完成
    setTimeout(() => {
        progressDiv4.style.display = 'none';
    }, 1000);
    
    // 更新最终标题和元数据
    results.forEach((candidates, idx) => {
        const title = targetGroups[idx].querySelector('h3');
        title.textContent = `目标 ${idx + 1}：找到 ${candidates.length} 个候选`;
        
        // 如果没有结果，显示提示
        if (candidates.length === 0) {
            const empty = document.createElement('p');
            empty.className = 'empty-hint';
            empty.textContent = '未找到符合条件的候选';
            targetLists[idx].innerHTML = '';
            targetLists[idx].appendChild(empty);
        }
    });
    
    // 元数据显示在结果容器外部
    const metaContainer = document.createElement('div');
    metaContainer.className = 'result-meta';
    metaContainer.textContent = `总用时: ${Date.now() - startTime}ms`;
    metaContainer.style.marginTop = '20px';
    resultsContainer.parentElement.insertBefore(metaContainer, resultsContainer.nextSibling);
    
    if (state.cancelledRef.value) {
        showStatus('搜索已取消', 'warning');
    } else {
        const totalFound = results.reduce((sum, r) => sum + r.length, 0);
        showStatus(`搜索完成，共找到 ${totalFound} 个候选，用时 ${Date.now() - startTime}ms`, 'success');
    }
}

// 搜索单个目标（异步版本）
async function searchSingleTargetAsync(targetIdx, guesses, options) {
    console.log(`\n--- 目标 ${targetIdx + 1} ---`);
    
    const targetGuesses = guesses.map(({guess, patterns}) => {
        const pattern = Array.isArray(patterns) ? patterns[targetIdx] : patterns;
        console.log(`  猜测: ${guess}, 模式: ${pattern}`);
        return {
            guess,
            patterns: pattern
        };
    });
    
    const constraints = buildConstraintsFromGuesses(targetGuesses, options.length);
    console.log('  约束:', constraints);
    
    // 估算搜索空间
    const estimatedSpace = estimateSearchSpace(constraints, options.length);
    console.log('  估算搜索空间:', estimatedSpace);
    
    const candidates = await generateCandidatesAsync(constraints, {
        ...options,
        estimatedSpace: estimatedSpace, // 传入估算空间
        onProgress: (progress) => {
            // 传递给外部的进度回调，添加估算空间信息
            if (options.onTargetProgress) {
                options.onTargetProgress({
                    ...progress,
                    estimatedSpace: estimatedSpace,
                    targetIdx: targetIdx
                });
            }
        }
    });
    
    console.log(`  找到 ${candidates.length} 个候选`);
    
    // 搜索完成后，通知进度条设为100%
    if (options.onTargetProgress) {
        options.onTargetProgress({
            found: candidates.length,
            explored: estimatedSpace,
            estimatedSpace: estimatedSpace,
            targetIdx: targetIdx,
            completed: true
        });
    }
    
    return candidates;
}

// 更新单个目标的显示
function updateTargetDisplay(targetIdx, results) {
    const group = document.getElementById(`target-${targetIdx}`);
    if (!group) return;
    
    const title = group.querySelector('h3');
    title.textContent = `目标 ${targetIdx + 1}：找到 ${results.length} 个候选`;
    
    const list = group.querySelector('.results-list');
    list.innerHTML = '';
    
    if (results.length === 0) {
        const empty = document.createElement('p');
        empty.className = 'empty-hint';
        empty.textContent = '搜索中...';
        list.appendChild(empty);
    } else {
        results.forEach(expr => {
            const item = document.createElement('div');
            item.className = 'result-item';
            item.textContent = expr;
            list.appendChild(item);
        });
    }
}

// 取消搜索
function cancelSearch() {
    state.cancelledRef.value = true;
    showStatus('正在取消...', 'warning');
}

// 复制结果到剪贴板
function copyResultToClipboard(itemElement) {
    const text = itemElement.textContent;
    
    navigator.clipboard.writeText(text).then(() => {
        // 视觉反馈
        const originalClass = itemElement.className;
        itemElement.classList.add('copied');
        
        setTimeout(() => {
            itemElement.className = originalClass;
        }, 500);
        
        // 不显示状态栏，避免干扰
    }).catch(err => {
        console.error('复制失败:', err);
        showStatus('复制失败', 'error');
    });
}

// 显示单式模式结果
function displayResultsSingleMode(results, elapsed, isPartial = false, foundCount = 0) {
    const container = document.getElementById('resultsContainer');
    container.innerHTML = '';
    
    const actualCount = results.length || foundCount;
    
    if (actualCount === 0 && !isPartial) {
        container.innerHTML = '<p class="empty-hint">未找到符合条件的候选</p>';
        return;
    }
    
    const group = document.createElement('div');
    group.className = 'results-group';
    
    const title = document.createElement('h3');
    title.textContent = isPartial ? `已找到 ${actualCount} 个候选（搜索中...）` : `找到 ${actualCount} 个候选`;
    group.appendChild(title);
    
    const list = document.createElement('div');
    list.className = 'results-list';
    
    results.forEach(expr => {
        const item = document.createElement('div');
        item.className = 'result-item';
        item.textContent = expr;
        list.appendChild(item);
    });
    
    group.appendChild(list);
    
    if (!isPartial) {
        const meta = document.createElement('div');
        meta.className = 'result-meta';
        meta.textContent = `用时: ${elapsed}ms`;
        group.appendChild(meta);
    }
    
    container.appendChild(group);
}

// 显示 4 式模式结果
function displayResults4Mode(resultsArray, elapsed) {
    const container = document.getElementById('resultsContainer');
    container.innerHTML = '';
    
    resultsArray.forEach((results, idx) => {
        const group = document.createElement('div');
        group.className = 'results-group';
        
        const title = document.createElement('h3');
        title.textContent = `目标 ${idx + 1}：找到 ${results.length} 个候选`;
        group.appendChild(title);
        
        if (results.length === 0) {
            const empty = document.createElement('p');
            empty.className = 'empty-hint';
            empty.textContent = '未找到符合条件的候选';
            group.appendChild(empty);
        } else {
            const list = document.createElement('div');
            list.className = 'results-list';
            
            results.forEach(expr => {
                const item = document.createElement('div');
                item.className = 'result-item';
                item.textContent = expr;
                list.appendChild(item);
            });
            
            group.appendChild(list);
        }
        
        container.appendChild(group);
    });
    
    const meta = document.createElement('div');
    meta.className = 'result-meta';
    meta.textContent = `总用时: ${elapsed}ms`;
    container.appendChild(meta);
}

// 显示状态信息
function showStatus(message, type = 'info') {
    const bar = document.getElementById('statusBar');
    bar.textContent = message;
    bar.className = `status-bar show ${type}`;
    
    setTimeout(() => {
        bar.classList.remove('show');
    }, 3000);
}

// 导出状态
function exportState() {
    const exportData = {
        version: 1,
        length: state.length,
        mode4: state.mode4,
        currentInput: state.currentInput.join(''),
        currentStates: state.mode4 ? null : state.currentStates.join(''),
        colorGrids: state.mode4 ? state.colorGrids.map(g => g.join('')) : null,
        guesses: state.guesses
    };
    
    const json = JSON.stringify(exportData, null, 2);
    
    // 复制到剪贴板
    navigator.clipboard.writeText(json).then(() => {
        showStatus('已复制到剪贴板', 'success');
    }).catch(() => {
        showStatus('复制失败', 'error');
    });
    
    // 下载文件
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    a.download = `wordle-math-state-${timestamp}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

// 导入状态
function importState() {
    const json = prompt('请粘贴导出的 JSON 数据：');
    
    if (!json) return;
    
    try {
        const data = JSON.parse(json);
        
        if (!data.version || data.version !== 1) {
            showStatus('不支持的版本', 'error');
            return;
        }
        
        // 恢复状态
        state.length = data.length || 12;
        state.mode4 = data.mode4 || false;
        state.guesses = data.guesses || [];
        
        // 恢复控制
        document.getElementById('length').value = state.length;
        document.getElementById('mode4').checked = state.mode4;
        
        // 重新初始化网格
        initializeInputGrid();
        
        // 恢复当前输入
        if (data.currentInput) {
            const chars = data.currentInput.split('');
            for (let i = 0; i < Math.min(chars.length, state.length); i++) {
                state.currentInput[i] = chars[i];
            }
        }
        
        // 恢复颜色状态
        if (!state.mode4 && data.currentStates) {
            const states = data.currentStates.split('');
            for (let i = 0; i < Math.min(states.length, state.length); i++) {
                state.currentStates[i] = states[i];
            }
        }
        
        // 恢复 4 式颜色
        if (state.mode4 && data.colorGrids) {
            for (let g = 0; g < 4; g++) {
                if (data.colorGrids[g]) {
                    const states = data.colorGrids[g].split('');
                    for (let i = 0; i < Math.min(states.length, state.length); i++) {
                        state.colorGrids[g][i] = states[i];
                    }
                }
            }
        }
        
        toggleMode4Display();
        renderInputGrid();
        if (state.mode4) render4ModeGrids();
        renderHistory();
        
        showStatus('导入成功', 'success');
    } catch (error) {
        showStatus('导入失败: ' + error.message, 'error');
        console.error(error);
    }
}
