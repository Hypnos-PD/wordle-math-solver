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
  if (expr[0] === "=" || expr[expr.length - 1] === "=") return false;

  // 分割左右两侧
  const parts = expr.split("=");
  if (parts.length !== 2) return false;

  const [left, right] = parts;

  // 左右侧不能为空
  if (!left || !right) return false;

  // 右侧只能是纯数字或负数
  if (!/^-?\d+$/.test(right)) return false;

  // 左侧不能以 * / 开头
  if (left[0] === "*" || left[0] === "/") return false;

  // 尝试求值
  try {
    // 严格限制输入，防止注入
    if (!/^[0-9+\-*/]+$/.test(left)) return false;

    const leftValue = Function("return " + left)();
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
    return { valid: false, error: "颜色模式长度不匹配" };
  }

  // 检查每个位置
  for (let i = 0; i < guess.length; i++) {
    const ch = guess[i];
    const color = pattern[i];

    // 检查绿色位置冲突
    if (existingConstraints.greens[i]) {
      if (existingConstraints.greens[i] !== ch) {
        // 如果该位置已经固定为其他字符，当前猜测不应该在这个位置
        if (color === "g") {
          return {
            valid: false,
            error: `位置 ${i + 1} 已固定为 '${
              existingConstraints.greens[i]
            }'，但标记 '${ch}' 为绿色`,
          };
        }
      } else {
        // 如果该位置已经固定为该字符，必须是绿色
        if (color !== "g") {
          return {
            valid: false,
            error: `位置 ${i + 1} 已固定为 '${ch}'，应标记为绿色`,
          };
        }
      }
    }

    // 检查字符是否在排除列表中
    if (existingConstraints.excluded.has(ch)) {
      if (color === "g" || color === "y") {
        return {
          valid: false,
          error: `字符 '${ch}' 已被排除，不应标记为绿色或黄色`,
        };
      }
    }

    // 检查黄色禁止位置（该字符曾在此位置被标记为黄色，说明答案中该字符不在此位置）
    if (existingConstraints.yellowForbiddenPositions[ch]?.has(i)) {
      if (color === "g") {
        return {
          valid: false,
          error: `字符 '${ch}' 在位置 ${
            i + 1
          } 已被禁止（之前标记为黄色），不应标记为绿色`,
        };
      }
      // 黄色是允许的（再次确认该字符不在此位置）
    }
  }

  // 检查字符出现次数是否超过上限
  const charCounts = {};
  for (let i = 0; i < guess.length; i++) {
    const ch = guess[i];
    const color = pattern[i];

    if (color === "g" || color === "y") {
      charCounts[ch] = (charCounts[ch] || 0) + 1;
    }
  }

  for (const [ch, count] of Object.entries(charCounts)) {
    if (existingConstraints.maxCounts[ch] !== undefined) {
      if (count > existingConstraints.maxCounts[ch]) {
        return {
          valid: false,
          error: `字符 '${ch}' 标记为绿/黄的次数 (${count}) 超过已知上限 (${existingConstraints.maxCounts[ch]})`,
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
    yellowForbiddenPositions: {},
  };

  // 用于跟踪每个字符在不同猜测中的需求
  const charRequirements = {}; // ch -> [count1, count2, ...]
  const charMaxLimits = {}; // ch -> [max1, max2, ...] 当有灰色时的上限

  // 遍历所有猜测
  for (const { guess, patterns, solved } of guesses) {
    // 跳过已解决的猜测（全绿）
    if (solved) {
      console.log("  跳过已解决的猜测:", guess);
      continue;
    }

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
      if (pattern[i] === "g") charColors[ch].green++;
      else if (pattern[i] === "y") charColors[ch].yellow++;
      else if (pattern[i] === "x") charColors[ch].gray++;
    }

    // 记录本次猜测中每个字符的需求次数和上限
    for (const [ch, colors] of Object.entries(charColors)) {
      const required = colors.green + colors.yellow;
      if (required > 0) {
        if (!charRequirements[ch]) {
          charRequirements[ch] = [];
        }
        charRequirements[ch].push(required);
      }

      // 如果有灰色且有绿/黄，说明有上限
      if (colors.gray > 0 && required > 0) {
        if (!charMaxLimits[ch]) {
          charMaxLimits[ch] = [];
        }
        charMaxLimits[ch].push(required);
      }
    }

    // 处理每个字符
    for (let i = 0; i < guess.length; i++) {
      const ch = guess[i];
      const color = pattern[i];

      if (color === "g") {
        // 绿色：该位置固定
        constraints.greens[i] = ch;
      } else if (color === "y") {
        // 黄色：该位置禁止该字符
        if (!constraints.yellowForbiddenPositions[ch]) {
          constraints.yellowForbiddenPositions[ch] = new Set();
        }
        constraints.yellowForbiddenPositions[ch].add(i);
      } else if (color === "x") {
        // 灰色
        const hasGreenOrYellow =
          charColors[ch].green > 0 || charColors[ch].yellow > 0;

        if (!hasGreenOrYellow) {
          // 该字符完全不存在
          constraints.excluded.add(ch);
        }

        // 灰色位置也禁止该字符（如果该字符存在）
        if (hasGreenOrYellow) {
          if (!constraints.yellowForbiddenPositions[ch]) {
            constraints.yellowForbiddenPositions[ch] = new Set();
          }
          constraints.yellowForbiddenPositions[ch].add(i);
        }
      }
    }
  }

  // 计算最终的 requiredCounts：取所有猜测中的最大值
  for (const [ch, counts] of Object.entries(charRequirements)) {
    constraints.requiredCounts[ch] = Math.max(...counts);
  }

  // 计算最终的 maxCounts：如果有上限约束，取最小值（最严格的）
  for (const [ch, limits] of Object.entries(charMaxLimits)) {
    constraints.maxCounts[ch] = Math.min(...limits);
  }

  // 【关键修正】减去已被绿色位置占用的字符数
  // greens 中固定的字符已经满足了部分 requiredCounts，不应重复计算
  const greenCounts = {};
  for (const ch of constraints.greens) {
    if (ch) {
      greenCounts[ch] = (greenCounts[ch] || 0) + 1;
    }
  }

  for (const ch in greenCounts) {
    if (constraints.requiredCounts[ch] !== undefined) {
      // 减去绿色已占用的次数
      constraints.requiredCounts[ch] = Math.max(
        0,
        constraints.requiredCounts[ch] - greenCounts[ch]
      );
    }
  }

  // 【关键修正】移除被要求出现的字符（避免排除与需求冲突）
  // 如果字符在 requiredCounts 中（意味着某个猜测中有绿/黄），就不应该被排除
  for (const ch in constraints.requiredCounts) {
    if (constraints.requiredCounts[ch] > 0 || greenCounts[ch] > 0) {
      constraints.excluded.delete(ch);
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
  const uniqueChars = new Set(expr.split("")).size;
  const operatorCount = (expr.match(/[+\-*/]/g) || []).length;
  return uniqueChars * 1.5 - operatorCount;
}

/**
 * 估算搜索空间大小
 * @param {Object} constraints - 约束对象
 * @param {number} length - 等式长度
 * @returns {number} 估算的搜索空间大小
 */
function estimateSearchSpace(constraints, length) {
  const allowedChars = "0123456789+-*/="
    .split("")
    .filter((ch) => !constraints.excluded.has(ch));
  let space = 1;

  for (let i = 0; i < length; i++) {
    if (constraints.greens[i]) {
      // 固定位置，只有1种选择
      space *= 1;
    } else {
      // 估算该位置的可选字符数
      let choices = allowedChars.length;

      // 减去被禁止的字符
      for (const ch of allowedChars) {
        if (constraints.yellowForbiddenPositions[ch]?.has(i)) {
          choices--;
        }
      }

      space *= Math.max(choices, 1);
    }

    // 防止溢出，超过百万就返回
    if (space > 1000000) return 1000000;
  }

  return Math.floor(space);
}

/**
 * DFS 生成候选等式（异步分块版本）
 */
async function generateCandidatesAsync(constraints, options) {
  const {
    length,
    maxResults = 200,
    cancelledRef = { value: false },
    onProgress = null,
  } = options;

  const results = [];
  const startTime = Date.now();

  // 可用字符集
  const allowedChars = "0123456789+-*/="
    .split("")
    .filter((ch) => !constraints.excluded.has(ch));

  console.log("DFS 开始:");
  console.log("  长度:", length);
  console.log("  可用字符:", allowedChars.join(""));
  console.log("  绿色固定:", constraints.greens);
  console.log("  必需次数:", constraints.requiredCounts);
  console.log("  最大次数:", constraints.maxCounts);
  console.log("  排除字符:", Array.from(constraints.excluded).join(""));
  console.log(
    "  黄色禁止:",
    Object.fromEntries(
      Object.entries(constraints.yellowForbiddenPositions).map(([k, v]) => [
        k,
        Array.from(v),
      ])
    )
  );

  let dfsCallCount = 0;
  let reachedEnd = 0;
  let failedValidation = 0;
  let failedRequired = 0;
  let lastYieldTime = Date.now();

  /**
   * 动态排序字符 - 根据当前状态计算每个字符的优先级
   */
  function getSortedChars(pos, used, hasEqual) {
    const chars = [];

    for (const ch of allowedChars) {
      // 基本过滤
      if (ch === "=") {
        if (hasEqual || pos === 0 || pos === length - 1) continue;
      }
      // 【修正】等号后只禁止 *、/、+，允许负号 -
      if (hasEqual && "*/+".includes(ch)) continue;
      if (constraints.yellowForbiddenPositions[ch]?.has(pos)) continue;

      const currentUsed = used[ch] || 0;
      if (constraints.maxCounts[ch] && currentUsed >= constraints.maxCounts[ch])
        continue;

      // 计算优先级分数（越高越优先）
      let priority = 0;

      // 1. 必需字符优先（还没用够的）
      if (constraints.requiredCounts[ch]) {
        const needed = constraints.requiredCounts[ch] - currentUsed;
        if (needed > 0) {
          priority += needed * 1000; // 非常高的优先级
        }
      }

      // 2. 数字优先于运算符
      if (/\d/.test(ch)) {
        priority += 100;
      }

      // 3. 等号在合适位置（长度的40-60%位置）
      if (ch === "=") {
        const idealPos = length * 0.5;
        const distance = Math.abs(pos - idealPos);
        priority += Math.max(0, 50 - distance * 5); // 离理想位置越近越好
      }

      // 4. 避免运算符在开头
      if ("+-*/".includes(ch) && pos < 2) {
        priority -= 50;
      }

      // 5. 常用数字（0-9）略微提高优先级
      if ("0123456789".includes(ch)) {
        // 1, 2, 0 更常见
        if (ch === "1") priority += 5;
        else if (ch === "2") priority += 4;
        else if (ch === "0") priority += 3;
      }

      // 6. 常用运算符优先
      if (ch === "+" || ch === "-") priority += 10;
      if (ch === "*" || ch === "/") priority += 5;

      chars.push({ ch, priority });
    }

    // 按优先级降序排序
    chars.sort((a, b) => b.priority - a.priority);

    return chars.map((item) => item.ch);
  }

  // DFS 递归函数
  async function dfs(pos, current, used, hasEqual) {
    dfsCallCount++;

    // 每次都检查取消（最快响应）
    if (cancelledRef.value) {
      return;
    }

    // 每1000次调用让出控制权
    if (dfsCallCount % 1000 === 0) {
      // 每50ms让出控制权，提高取消响应速度
      if (Date.now() - lastYieldTime > 50) {
        await new Promise((resolve) => setTimeout(resolve, 0));
        lastYieldTime = Date.now();

        // 再次检查取消（让出控制权后立即检查）
        if (cancelledRef.value) {
          return;
        }

        // 报告进度
        if (onProgress) {
          onProgress({
            found: results.length,
            explored: dfsCallCount,
            current: current,
          });
        }
      }
    }

    // 达到最大结果数
    if (results.length >= maxResults) {
      return;
    }

    // 完成一个候选
    if (pos === length) {
      reachedEnd++;

      // 必须有等号
      if (!hasEqual) return;

      // 验证等式
      if (!isValidEquation(current)) {
        failedValidation++;
        return;
      }

      // 检查是否满足必需次数
      let valid = true;
      for (const [ch, minCount] of Object.entries(constraints.requiredCounts)) {
        if ((used[ch] || 0) < minCount) {
          valid = false;
          break;
        }
      }

      if (!valid) {
        failedRequired++;
        return;
      }

      results.push(current);
      console.log("  ✓ 找到候选:", current);

      // 流式回调 - 每找到一个就立即回调
      if (onProgress) {
        onProgress({
          found: results.length,
          explored: dfsCallCount,
          current: current,
          newResult: current,
        });
      }

      return;
    }

    // 如果该位置有绿色固定字符
    if (constraints.greens[pos]) {
      const ch = constraints.greens[pos];

      // 【关键剪枝】等号前不能是运算符
      if (ch === "=") {
        const lastChar = pos > 0 ? current[pos - 1] : null;
        if (lastChar && "+-*/".includes(lastChar)) {
          return; // 剪枝：等号前是运算符，这条路径无效
        }
      }

      const newUsed = { ...used };
      newUsed[ch] = (newUsed[ch] || 0) + 1;

      // 检查是否超过最大次数
      if (
        constraints.maxCounts[ch] &&
        newUsed[ch] > constraints.maxCounts[ch]
      ) {
        return;
      }

      await dfs(pos + 1, current + ch, newUsed, hasEqual || ch === "=");
      return;
    }

    // 动态获取排序后的字符列表（根据当前状态）
    const sortedChars = getSortedChars(pos, used, hasEqual);

    // 按优先级尝试每个字符
    for (const ch of sortedChars) {
      // 【关键剪枝】避免连续运算符（除了负号开头或运算符后的负号）
      const lastChar = pos > 0 ? current[pos - 1] : null;
      if ("+-*/".includes(ch) && lastChar) {
        // 如果上一个字符是运算符或等号
        if ("+-*/=".includes(lastChar)) {
          // 只允许负号（-）跟在 = 或其他运算符后
          if (ch !== "-") {
            continue; // 跳过 *、/、+ 在运算符后
          }
          // 如果上一个已经是负号，不能再跟负号（避免 --）
          if (lastChar === "-" && ch === "-") {
            continue;
          }
        }
      }

      // 等号特殊检查：右侧必须只能放数字
      if (ch === "=") {
        // 【关键剪枝】等号前不能是运算符（左侧表达式必须完整）
        if (lastChar && "+-*/".includes(lastChar)) {
          continue;
        }

        let needOperators = 0;
        for (const [reqCh, minCount] of Object.entries(
          constraints.requiredCounts
        )) {
          if ("+-*/".includes(reqCh)) {
            const currentCount = used[reqCh] || 0;
            if (currentCount < minCount) {
              needOperators += minCount - currentCount;
            }
          }
        }

        if (needOperators > 0) {
          continue;
        }
      }

      // 【关键剪枝】等号后不能是运算符（除了负号）
      if (hasEqual && "*/+".includes(ch)) {
        continue;
      }

      // 检查次数限制
      const newUsed = { ...used };
      newUsed[ch] = (newUsed[ch] || 0) + 1;

      if (
        constraints.maxCounts[ch] &&
        newUsed[ch] > constraints.maxCounts[ch]
      ) {
        continue;
      }

      // 剪枝：检查剩余位置是否足够满足必需次数
      const remaining = length - pos - 1;
      let needMore = 0;
      for (const [reqCh, minCount] of Object.entries(
        constraints.requiredCounts
      )) {
        const currentCount = newUsed[reqCh] || 0;
        if (currentCount < minCount) {
          needMore += minCount - currentCount;
        }
      }
      if (needMore > remaining) {
        continue;
      }

      // 递归
      await dfs(pos + 1, current + ch, newUsed, hasEqual || ch === "=");
    }
  }

  // 开始 DFS
  await dfs(0, "", {}, false);

  console.log("DFS 完成:");
  console.log("  调用次数:", dfsCallCount);
  console.log("  到达终点:", reachedEnd);
  console.log("  验证失败:", failedValidation);
  console.log("  必需次数不满足:", failedRequired);
  console.log("  找到结果:", results.length);
  console.log("  耗时:", Date.now() - startTime, "ms");

  // 排序
  results.sort((a, b) => scoreCandidate(b) - scoreCandidate(a));

  return results;
}

/**
 * DFS 生成候选等式（同步版本，保留用于兼容）
 */
function generateCandidates(constraints, options) {
  const {
    length,
    maxResults = 200,
    timeoutMs = 0, // 0 表示无超时
    cancelledRef = { value: false },
    onProgress = null, // 流式回调
  } = options;

  const results = [];
  const startTime = Date.now();

  // 可用字符集
  const allowedChars = "0123456789+-*/="
    .split("")
    .filter((ch) => !constraints.excluded.has(ch));

  console.log("DFS 开始:");
  console.log("  长度:", length);
  console.log("  可用字符:", allowedChars.join(""));
  console.log("  绿色固定:", constraints.greens);
  console.log("  必需次数:", constraints.requiredCounts);
  console.log("  最大次数:", constraints.maxCounts);
  console.log("  排除字符:", Array.from(constraints.excluded).join(""));
  console.log("  黄色禁止:", constraints.yellowForbiddenPositions);

  let dfsCallCount = 0;
  let reachedEnd = 0;
  let failedValidation = 0;
  let failedRequired = 0;

  // DFS 递归函数
  function dfs(pos, current, used, hasEqual) {
    dfsCallCount++;

    // 检查取消
    if (cancelledRef.value) {
      return;
    }

    // 检查超时（如果设置了）
    if (timeoutMs > 0 && Date.now() - startTime > timeoutMs) {
      return;
    }

    // 达到最大结果数
    if (results.length >= maxResults) {
      return;
    }

    // 完成一个候选
    if (pos === length) {
      reachedEnd++;

      // 必须有等号
      if (!hasEqual) return;

      // 验证等式
      if (!isValidEquation(current)) {
        failedValidation++;
        if (reachedEnd <= 10) {
          console.log("  验证失败:", current);
        }
        return;
      }

      // 检查是否满足必需次数
      let valid = true;
      for (const [ch, minCount] of Object.entries(constraints.requiredCounts)) {
        if ((used[ch] || 0) < minCount) {
          valid = false;
          break;
        }
      }

      if (!valid) {
        failedRequired++;
        if (reachedEnd <= 10) {
          console.log("  未满足必需次数:", current, used);
        }
        return;
      }

      results.push(current);
      if (results.length <= 5) {
        console.log("  ✓ 找到候选:", current);
      }

      // 流式回调
      if (onProgress && results.length % 10 === 0) {
        onProgress(results.slice());
      }

      return;
    }

    // 如果该位置有绿色固定字符
    if (constraints.greens[pos]) {
      const ch = constraints.greens[pos];

      // 【关键剪枝】等号前不能是运算符
      if (ch === "=") {
        const lastChar = pos > 0 ? current[pos - 1] : null;
        if (lastChar && "+-*/".includes(lastChar)) {
          return; // 剪枝：等号前是运算符，这条路径无效
        }
      }

      const newUsed = { ...used };
      newUsed[ch] = (newUsed[ch] || 0) + 1;

      // 检查是否超过最大次数
      if (
        constraints.maxCounts[ch] &&
        newUsed[ch] > constraints.maxCounts[ch]
      ) {
        return;
      }

      dfs(pos + 1, current + ch, newUsed, hasEqual || ch === "=");
      return;
    }

    // 尝试每个可用字符
    for (const ch of allowedChars) {
      // 【关键剪枝】避免连续运算符（除了负号）
      const lastChar = pos > 0 ? current[pos - 1] : null;
      if ("+-*/".includes(ch) && lastChar) {
        if ("+-*/=".includes(lastChar)) {
          if (ch !== "-") {
            continue;
          }
          if (lastChar === "-" && ch === "-") {
            continue;
          }
        }
      }

      // 等号限制：只能有一个，不在首末
      if (ch === "=") {
        // 【关键剪枝】等号前不能是运算符
        if (lastChar && "+-*/".includes(lastChar)) {
          continue;
        }

        if (hasEqual || pos === 0 || pos === length - 1) continue;

        // 额外检查：等号右侧必须只能放数字
        // 检查剩余位置是否只能放数字（没有运算符需求）
        const rightLength = length - pos - 1;
        let needOperators = 0;
        for (const [reqCh, minCount] of Object.entries(
          constraints.requiredCounts
        )) {
          if ("+-*/".includes(reqCh)) {
            const currentCount = used[reqCh] || 0;
            if (currentCount < minCount) {
              needOperators += minCount - currentCount;
            }
          }
        }

        // 如果还需要运算符，但等号之后没有足够空间，跳过
        if (needOperators > 0) {
          continue;
        }
      }

      // 【修正】等号后只禁止 *、/、+，允许负号 -
      if (hasEqual && "*/+".includes(ch)) {
        continue;
      }

      // 检查位置禁止
      if (constraints.yellowForbiddenPositions[ch]?.has(pos)) {
        continue;
      }

      // 检查次数限制
      const newUsed = { ...used };
      newUsed[ch] = (newUsed[ch] || 0) + 1;

      if (
        constraints.maxCounts[ch] &&
        newUsed[ch] > constraints.maxCounts[ch]
      ) {
        continue;
      }

      // 剪枝：检查剩余位置是否足够满足必需次数
      const remaining = length - pos - 1;
      let needMore = 0;
      for (const [reqCh, minCount] of Object.entries(
        constraints.requiredCounts
      )) {
        const currentCount = newUsed[reqCh] || 0;
        if (currentCount < minCount) {
          needMore += minCount - currentCount;
        }
      }
      if (needMore > remaining) {
        continue;
      }

      // 递归
      dfs(pos + 1, current + ch, newUsed, hasEqual || ch === "=");
    }
  }

  // 开始 DFS
  dfs(0, "", {}, false);

  console.log("DFS 完成:");
  console.log("  调用次数:", dfsCallCount);
  console.log("  到达终点:", reachedEnd);
  console.log("  验证失败:", failedValidation);
  console.log("  必需次数不满足:", failedRequired);
  console.log("  找到结果:", results.length);
  console.log("  耗时:", Date.now() - startTime, "ms");

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

  console.log("=== 4式模式生成 ===");
  console.log("总猜测数:", guesses.length);

  for (let targetIdx = 0; targetIdx < 4; targetIdx++) {
    console.log(`\n--- 目标 ${targetIdx + 1} ---`);

    // 为每个目标构建独立约束
    const targetGuesses = guesses.map(({ guess, patterns }) => {
      const pattern = Array.isArray(patterns) ? patterns[targetIdx] : patterns;
      console.log(`  猜测: ${guess}, 模式: ${pattern}`);
      return {
        guess,
        patterns: pattern,
      };
    });

    const constraints = buildConstraintsFromGuesses(
      targetGuesses,
      options.length
    );
    console.log("  约束:", constraints);

    const candidates = generateCandidates(constraints, options);
    console.log(`  找到 ${candidates.length} 个候选`);

    results.push(candidates);
  }

  return results;
}
