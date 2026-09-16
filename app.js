(() => {
  const STORAGE_KEY = "rental-decision-helper-v1";
  const WEIGHT_META = {
    cost: { label: "经济成本", icon: "💰", color: "#4b8fb8", soft: "#e8f6fd" },
    commute: { label: "通勤效率", icon: "🚇", color: "#8375b9", soft: "#f0edfb" },
    living: { label: "居住体验", icon: "🏠", color: "#5b9e87", soft: "#eaf7f1" },
    risk: { label: "租住安全", icon: "🛡️", color: "#e18a4f", soft: "#fff0e5" }
  };

  const SCORE_MODES = {
    balanced: { label:"均衡考虑", icon:"⚖️", hint:"预算、通勤、居住和安全都兼顾。", weights:{ cost:30, commute:25, living:25, risk:20 } },
    budget: { label:"预算优先", icon:"💰", hint:"优先控制真实月成本和首月付款压力。", weights:{ cost:55, commute:15, living:15, risk:15 } },
    commute: { label:"少点通勤", icon:"🚇", hint:"更看重每天节省下来的上下班时间。", weights:{ cost:20, commute:50, living:15, risk:15 } },
    comfort: { label:"住得舒服", icon:"🛋️", hint:"更看重面积、采光、安静程度和房屋状态。", weights:{ cost:20, commute:15, living:50, risk:15 } },
    custom: { label:"自定义", icon:"✏️", hint:"按你的实际偏好自由调整，四项总和保持 100%。", weights:null }
  };

  const defaultSafety = {
    subleaseAuth: "na", depositTerms: "pending", utilityTerms: "pending",
    exitTerms: "pending", repairTerms: "pending"
  };

  const demoListings = [
    {
      id: "demo-a", name: "A｜远郊阳光房", rent: 2850, area: 43, commute: 70,
      paymentMonths: 3, depositMonths: 1, agencyFee: 0, managementFee: 0, propertyFee: 120,
      utilities: 220, otherFee: 300, floor: 9, elevator: true,
      lighting: 5, condition: 4, noise: 2, landlordType: "owner",
      safety: { subleaseAuth:"na", depositTerms:"confirmed", utilityTerms:"confirmed", exitTerms:"pending", repairTerms:"confirmed" },
      notes: "采光好、面积够用，但每天通勤时间很长。"
    },
    {
      id: "demo-b", name: "B｜公司旁小户型", rent: 4500, area: 27, commute: 15,
      paymentMonths: 1, depositMonths: 1, agencyFee: 0, managementFee: 260, propertyFee: 180,
      utilities: 190, otherFee: 0, floor: 11, elevator: true,
      lighting: 3, condition: 4, noise: 3, landlordType: "owner",
      safety: { subleaseAuth:"na", depositTerms:"confirmed", utilityTerms:"confirmed", exitTerms:"confirmed", repairTerms:"confirmed" },
      notes: "离公司最近，下班更自由，但租金高、空间偏小。"
    },
    {
      id: "demo-c", name: "C｜老小区两居", rent: 3600, area: 58, commute: 38,
      paymentMonths: 3, depositMonths: 1, agencyFee: 3600, managementFee: 150, propertyFee: 80,
      utilities: 240, otherFee: 200, floor: 6, elevator: false,
      lighting: 4, condition: 3, noise: 2, landlordType: "sublessor",
      safety: { subleaseAuth:"pending", depositTerms:"confirmed", utilityTerms:"confirmed", exitTerms:"pending", repairTerms:"pending" },
      notes: "空间最大、价格适中，但六楼无电梯，还有一笔中介费。"
    }
  ];

  const defaultState = {
    listings: demoListings,
    weights: cloneModeWeights("balanced"),
    scoreMode: "balanced",
    view: "cards"
  };

  let state = loadState();
  let toastTimer;
  let resultFrame;

  const els = {
    banner: document.querySelector("#decisionBanner"),
    weights: document.querySelector("#weightControls"),
    modes: document.querySelector("#modeControls"),
    modeHint: document.querySelector("#modeHint"),
    weightTotal: document.querySelector("#weightTotal"),
    cards: document.querySelector("#cardsView"),
    table: document.querySelector("#tableView"),
    dialog: document.querySelector("#listingDialog"),
    form: document.querySelector("#listingForm"),
    dialogTitle: document.querySelector("#dialogTitle"),
    toast: document.querySelector("#toast")
  };

  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function cloneModeWeights(key) { return { ...SCORE_MODES[key].weights }; }
  function detectMode(weights) {
    return Object.entries(SCORE_MODES).find(([_, mode]) => mode.weights && Object.keys(mode.weights).every(key => number(weights?.[key]) === mode.weights[key]))?.[0] || "custom";
  }
  function normalizeListing(item) {
    const demo = demoListings.find(x => x.id === item.id);
    const fallbackSafety = demo?.safety || defaultSafety;
    const legacyPending = Math.max(0, Math.min(4, number(item.riskCount)));
    const migratedSafety = { ...fallbackSafety, ...(item.safety || {}) };
    if (!item.safety && !demo && legacyPending) {
      ["depositTerms", "utilityTerms", "exitTerms", "repairTerms"].slice(0, legacyPending).forEach(key => migratedSafety[key] = "pending");
    }
    return {
      ...item,
      managementFee: item.managementFee ?? demo?.managementFee ?? 0,
      landlordType: item.landlordType || demo?.landlordType || "unknown",
      safety: migratedSafety
    };
  }
  function loadState() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (saved?.listings && saved?.weights) return { ...clone(defaultState), ...saved, scoreMode: SCORE_MODES[saved.scoreMode] ? saved.scoreMode : detectMode(saved.weights), listings: saved.listings.map(normalizeListing) };
    } catch (_) {}
    return clone(defaultState);
  }
  function saveState() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
  function number(value) { return Number(value) || 0; }
  function clamp(value, min = 0, max = 100) { return Math.min(max, Math.max(min, value)); }
  function yuan(value) { return `¥${Math.round(value).toLocaleString("zh-CN")}`; }
  function escapeHTML(value = "") {
    return String(value).replace(/[&<>'"]/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", "'":"&#39;", '"':"&quot;" }[c]));
  }

  function derived(item) {
    const extraMonthly = number(item.managementFee) + number(item.propertyFee) + number(item.utilities)
      + (number(item.agencyFee) + number(item.otherFee)) / 12;
    const monthly = number(item.rent) + extraMonthly;
    const firstCash = number(item.rent) * number(item.paymentMonths)
      + number(item.rent) * number(item.depositMonths) + number(item.agencyFee)
      + number(item.managementFee) + number(item.propertyFee) + number(item.utilities) + number(item.otherFee);
    const dailyCommute = number(item.commute) * 2;
    return { monthly, extraMonthly, firstCash, dailyCommute };
  }

  function landlordLabel(item) {
    return item.landlordType === "owner" ? "一手房东" : item.landlordType === "sublessor" ? "二手房东" : "尚未确认";
  }

  function safetySummary(item) {
    const safety = { ...defaultSafety, ...(item.safety || {}) };
    const checks = ["depositTerms", "utilityTerms", "exitTerms", "repairTerms"];
    if (item.landlordType === "sublessor") checks.unshift("subleaseAuth");
    let pending = checks.filter(key => safety[key] === "pending" || safety[key] === "na").length;
    const problems = checks.filter(key => safety[key] === "problem").length;
    if (item.landlordType === "unknown") pending += 1;
    const score = clamp(100 - pending * 8 - problems * 20, 20, 100);
    const label = problems && pending ? `${problems} 项有问题，${pending} 项待确认`
      : problems ? `${problems} 项存在问题` : pending ? `${pending} 项待确认` : "信息已确认";
    return { score, pending, problems, label };
  }

  function inverseScore(value, min, max) {
    if (max === min) return 88;
    return clamp(100 - ((value - min) / (max - min)) * 55, 45, 100);
  }

  function scoreListings(listings) {
    if (!listings.length) return [];
    const enriched = listings.map(item => ({ ...item, stats: derived(item) }));
    const monthly = enriched.map(x => x.stats.monthly);
    const cash = enriched.map(x => x.stats.firstCash);
    const commutes = enriched.map(x => number(x.commute));
    const ranges = {
      monthly: [Math.min(...monthly), Math.max(...monthly)],
      cash: [Math.min(...cash), Math.max(...cash)],
      commute: [Math.min(...commutes), Math.max(...commutes)]
    };

    return enriched.map(item => {
      const cost = inverseScore(item.stats.monthly, ...ranges.monthly) * .72
        + inverseScore(item.stats.firstCash, ...ranges.cash) * .28;
      const commute = inverseScore(number(item.commute), ...ranges.commute);
      const areaScore = clamp(number(item.area) / 60 * 100, 35, 100);
      const stairsScore = item.elevator ? 94 : clamp(100 - Math.max(0, number(item.floor) - 2) * 11, 25, 90);
      const living = number(item.lighting) * 20 * .28 + number(item.condition) * 20 * .24
        + (6 - number(item.noise)) * 20 * .18 + areaScore * .2 + stairsScore * .1;
      const risk = safetySummary(item).score;
      const scores = { cost, commute, living, risk };
      const total = Object.keys(scores).reduce((sum, key) => sum + scores[key] * state.weights[key] / 100, 0);
      return { ...item, scores, total };
    }).sort((a, b) => b.total - a.total);
  }

  function recommendation(item, scored) {
    const positives = [];
    const warnings = [];
    const s = item.scores;
    const bestKey = Object.entries(s).sort((a,b) => b[1] - a[1])[0][0];
    const worstKey = Object.entries(s).sort((a,b) => a[1] - b[1])[0][0];
    const positiveMap = {
      cost: "预算控制最好", commute: "通勤最省时间", living: "住起来更舒服", risk: "租住信息确认得更完整"
    };
    const warningMap = {
      cost: "总支出偏高", commute: "通勤消耗较大", living: "居住体验有取舍", risk: "仍有租住安全事项需要核对"
    };
    positives.push(positiveMap[bestKey]);
    warnings.push(warningMap[worstKey]);
    if (!item.elevator && number(item.floor) >= 5) warnings.push(`${item.floor} 楼无电梯`);
    if (number(item.agencyFee) > 0) warnings.push(`含 ${yuan(item.agencyFee)} 中介费`);
    const safety = safetySummary(item);
    if (item.landlordType === "sublessor" && item.safety?.subleaseAuth !== "confirmed") warnings.push("二手房东的转租授权未确认");
    else if (safety.problems) warnings.push(`${safety.problems} 项租住信息存在问题`);
    if (number(item.commute) <= 20) positives.push("适合看重下班后时间的人");
    else if (number(item.area) >= 50) positives.push("适合需要更多生活空间的人");
    else if (item.stats.monthly === Math.min(...scored.map(x => x.stats.monthly))) positives.push("适合优先控制每月预算的人");
    return { positives, warnings };
  }

  function renderWeights() {
    renderModes();
    els.weights.innerHTML = Object.entries(WEIGHT_META).map(([key, meta]) => `
      <label class="weight-control">
        <span class="weight-head">
          <span><i class="weight-icon" style="color:${meta.color};background:${meta.soft}">${meta.icon}</i>${meta.label}</span>
          <strong class="weight-value" id="weight-${key}-value">${state.weights[key]}%</strong>
        </span>
        <span class="weight-slider-row">
          <button class="weight-step" type="button" data-weight-adjust="-1" data-weight-key="${key}" aria-label="减少${meta.label}">−</button>
          <input type="range" min="0" max="100" step="1" value="${state.weights[key]}" data-weight="${key}" style="--fill:${state.weights[key]}%" />
          <button class="weight-step" type="button" data-weight-adjust="1" data-weight-key="${key}" aria-label="增加${meta.label}">＋</button>
        </span>
      </label>`).join("");
    els.weightTotal.textContent = `${Object.values(state.weights).reduce((a,b) => a+b, 0)}%`;
  }

  function renderModes() {
    els.modes.innerHTML = Object.entries(SCORE_MODES).map(([key, mode]) => `<button type="button" class="mode-chip ${state.scoreMode === key ? "active" : ""}" data-score-mode="${key}" role="radio" aria-checked="${state.scoreMode === key}"><span>${mode.icon}</span>${mode.label}</button>`).join("");
    els.modeHint.textContent = SCORE_MODES[state.scoreMode]?.hint || SCORE_MODES.custom.hint;
  }

  function updateModeUI() {
    els.modes.querySelectorAll("[data-score-mode]").forEach(button => {
      const active = button.dataset.scoreMode === state.scoreMode;
      button.classList.toggle("active", active);
      button.setAttribute("aria-checked", String(active));
    });
    els.modeHint.textContent = SCORE_MODES[state.scoreMode]?.hint || SCORE_MODES.custom.hint;
  }

  function updateWeightUI() {
    Object.keys(state.weights).forEach(key => {
      const input = els.weights.querySelector(`[data-weight="${key}"]`);
      const value = document.querySelector(`#weight-${key}-value`);
      if (input) {
        input.value = state.weights[key];
        input.style.setProperty("--fill", `${state.weights[key]}%`);
      }
      if (value) value.textContent = `${state.weights[key]}%`;
    });
    els.weightTotal.textContent = `${Object.values(state.weights).reduce((a,b) => a+b, 0)}%`;
  }

  function adjustWeights(changedKey, nextValue) {
    const others = Object.keys(state.weights).filter(k => k !== changedKey);
    const targetOthers = 100 - nextValue;
    const oldOthers = others.reduce((sum, key) => sum + state.weights[key], 0);
    state.weights[changedKey] = nextValue;
    let allocated = 0;
    others.forEach((key, index) => {
      const value = index === others.length - 1
        ? targetOthers - allocated
        : Math.round((oldOthers ? state.weights[key] / oldOthers : 1 / others.length) * targetOthers);
      state.weights[key] = clamp(value, 0, 100);
      allocated += state.weights[key];
    });
    const total = Object.values(state.weights).reduce((a,b) => a+b, 0);
    if (total !== 100) state.weights[others[others.length - 1]] += 100 - total;
  }

  function radarSVG(scores) {
    const keys = ["cost", "commute", "living", "risk"];
    const labels = ["成本", "通勤", "居住", "安全"];
    const center = 72.5, radius = 47;
    const point = (index, scale) => {
      const angle = -Math.PI / 2 + index * Math.PI / 2;
      return [center + Math.cos(angle) * radius * scale, center + Math.sin(angle) * radius * scale];
    };
    const polygons = [.33, .66, 1].map(scale => keys.map((_,i) => point(i,scale).join(",")).join(" "));
    const data = keys.map((key,i) => point(i, scores[key] / 100).join(",")).join(" ");
    const axes = keys.map((_,i) => { const p=point(i,1); return `<line x1="${center}" y1="${center}" x2="${p[0]}" y2="${p[1]}" stroke="#dbe5ee"/>`; }).join("");
    const textPos = [[72.5,11],[132,76],[72.5,142],[13,76]];
    return `<svg class="radar" viewBox="0 0 145 145" aria-label="四项评分雷达图">
      ${polygons.map(p => `<polygon points="${p}" fill="none" stroke="#dbe5ee"/>`).join("")}${axes}
      <polygon points="${data}" fill="rgba(72,103,131,.17)" stroke="#486783" stroke-width="2"/>
      ${keys.map((key,i) => { const p=point(i,scores[key]/100); return `<circle cx="${p[0]}" cy="${p[1]}" r="3" fill="#486783"/>`; }).join("")}
      ${labels.map((label,i) => `<text x="${textPos[i][0]}" y="${textPos[i][1]}" text-anchor="middle">${label}</text>`).join("")}
    </svg>`;
  }

  function renderBanner(scored) {
    if (!scored.length) {
      els.banner.innerHTML = `<div class="winner-copy"><span class="eyebrow">等待比较</span><h2 class="winner-title">先添加至少一套房源</h2><p>录入费用、通勤和居住条件后，这里会给出实时结论。</p></div>`;
      return;
    }
    const best = scored[0];
    const rec = recommendation(best, scored);
    els.banner.innerHTML = `
      <div class="winner-copy"><span class="eyebrow">📌 当前更推荐</span><h2 class="winner-title"><b>${escapeHTML(best.name)}</b>，综合 ${best.total.toFixed(1)} 分</h2><p>${rec.positives[0]}；需要接受的是${rec.warnings[0]}。调整左侧权重，结论可能会改变。</p></div>
      <div class="banner-stat"><span>真实月成本</span><strong>${yuan(best.stats.monthly)}</strong><small>含摊销费用</small></div>
      <div class="banner-stat"><span>首月准备金</span><strong>${yuan(best.stats.firstCash)}</strong><small>签约前备足</small></div>
      <div class="banner-stat"><span>每天往返</span><strong>${best.stats.dailyCommute} 分钟</strong><small>单程 ${best.commute} 分钟</small></div>`;
  }

  function smartCommentary(item, scored) {
    const safety = safetySummary(item);
    if (scored.length === 1) {
      return `${escapeHTML(item.name)}的真实月成本约为${yuan(item.stats.monthly)}，每天往返通勤${item.stats.dailyCommute}分钟，租住安全${safety.score}分。再添加一套房源后，我会把每月差价和每天通勤差异直接算给你看。`;
    }
    const other = item.id === scored[0].id ? scored[1] : scored[0];
    const money = Math.round(item.stats.monthly - other.stats.monthly);
    const commute = Math.round(item.stats.dailyCommute - other.stats.dailyCommute);
    const moneyText = money === 0 ? "每月花费基本一样" : `每月${money > 0 ? "多花" : "少花"}${yuan(Math.abs(money))}`;
    const commuteText = commute === 0 ? "每天通勤时间基本一样" : `每天${commute > 0 ? "多通勤" : "少通勤"}${Math.abs(commute)}分钟`;
    const modeText = state.scoreMode === "custom" ? "按你现在的自定义权重" : `按“${SCORE_MODES[state.scoreMode]?.label || "自定义"}”模式`;
    const resultText = item.id === scored[0].id
      ? `${modeText}，它在综合取舍上更占优势。`
      : `${modeText}，${escapeHTML(scored[0].name)}的综合取舍更合适。`;
    const connector = money && commute && Math.sign(money) !== Math.sign(commute) ? "但" : "而且";
    return `相比${escapeHTML(other.name)}，${moneyText}，${connector}${commuteText}；租住安全为${safety.score}分（${safety.label}）。${resultText}`;
  }

  function renderCards(scored) {
    if (!scored.length) {
      els.cards.innerHTML = `<div class="empty-state"><div class="empty-icon">⌂</div><h3>还没有房源</h3><p>添加两套以上，比较结果会更有参考价值。</p><button class="button primary" type="button" data-action="add">添加第一套房源</button></div>`;
      return;
    }
    els.cards.innerHTML = scored.map((item, index) => {
      const rec = recommendation(item, scored);
      const safety = safetySummary(item);
      const scoreRows = Object.entries(WEIGHT_META).map(([key, meta]) => `<div><span>${meta.label.slice(0,2)}</span><span class="tiny-bar"><i style="width:${item.scores[key]}%;background:${meta.color}"></i></span><b>${Math.round(item.scores[key])}</b></div>`).join("");
      return `<article class="home-card ${index === 0 ? "winner" : ""}">
        <div class="card-top">
          <div class="rank-line"><span class="rank-badge"><i class="rank-number">${index + 1}</i>${index === 0 ? "当前首选" : "综合排名"}</span><span class="card-menu"><button class="mini-btn" data-action="edit" data-id="${item.id}" aria-label="编辑 ${escapeHTML(item.name)}">✎</button><button class="mini-btn danger" data-action="delete" data-id="${item.id}" aria-label="删除 ${escapeHTML(item.name)}">×</button></span></div>
          <h3>${escapeHTML(item.name)}</h3><div class="subline">${item.area}㎡ · ${item.floor} 楼 · ${item.elevator ? "有电梯" : "无电梯"}</div>
          <div class="score-row"><div class="score"><strong>${item.total.toFixed(1)}</strong><small>分</small></div><div class="monthly"><strong>${yuan(item.stats.monthly)}/月</strong><span>真实月成本</span></div></div>
          <div class="score-bar"><span style="width:${item.total}%"></span></div>
        </div>
        <div class="card-middle">
          <div class="metric"><span>挂牌月租</span><strong>${yuan(item.rent)}</strong></div>
          <div class="metric"><span>每月额外支出</span><strong>${yuan(item.stats.extraMonthly)}</strong></div>
          <div class="metric"><span>首月准备金</span><strong>${yuan(item.stats.firstCash)}</strong></div>
          <div class="metric"><span>每天往返通勤</span><strong>${item.stats.dailyCommute} 分钟</strong></div>
        </div>
        <div class="card-bottom">
          <div class="tradeoff"><p class="advice-line good"><b>适合</b><span>${rec.positives.join("，")}。</span></p><p class="advice-line caution"><b>取舍</b><span>${rec.warnings.join("，")}。</span></p></div>
          <div class="tags"><span class="tag">${number(item.paymentMonths) === 1 ? "月付" : `押一付${item.paymentMonths}`}</span>${number(item.managementFee) ? `<span class="tag">管理费 ${yuan(item.managementFee)}/月</span>` : ""}<span class="tag">${landlordLabel(item)}</span><span class="tag ${safety.problems || safety.pending ? "warn" : ""}">${safety.label}</span></div>
          <button class="detail-toggle" data-action="detail" data-id="${item.id}" type="button">展开评分详情 ↓</button>
        </div>
        <div class="card-detail" id="detail-${item.id}" hidden><div class="radar-layout">${radarSVG(item.scores)}<div class="score-list">${scoreRows}</div></div><div class="ai-note"><div class="ai-note-title"><span>✨</span><strong>智能决策点评</strong></div><p>${smartCommentary(item, scored)}</p></div>${item.notes ? `<p class="panel-note" style="margin-bottom:0">备注：${escapeHTML(item.notes)}</p>` : ""}</div>
      </article>`;
    }).join("");
  }

  function renderTable(scored) {
    if (!scored.length) { els.table.innerHTML = ""; return; }
    const rows = [
      { label:"综合排名", get:x => `第 ${scored.indexOf(x)+1} 名`, value:x => scored.indexOf(x), best:"min" },
      { label:"综合评分", get:x => `${x.total.toFixed(1)} 分`, value:x => x.total, best:"max" },
      { label:"挂牌月租", get:x => yuan(x.rent), value:x => number(x.rent), best:"min" },
      { label:"管理费 / 月", get:x => yuan(x.managementFee), value:x => number(x.managementFee), best:"min" },
      { label:"每月额外支出", get:x => yuan(x.stats.extraMonthly), value:x => x.stats.extraMonthly, best:"min" },
      { label:"真实月成本", get:x => yuan(x.stats.monthly), value:x => x.stats.monthly, best:"min" },
      { label:"首月准备金", get:x => yuan(x.stats.firstCash), value:x => x.stats.firstCash, best:"min" },
      { label:"单程通勤", get:x => `${x.commute} 分钟`, value:x => number(x.commute), best:"min" },
      { label:"每天往返", get:x => `${x.stats.dailyCommute} 分钟`, value:x => x.stats.dailyCommute, best:"min" },
      { label:"面积", get:x => `${x.area}㎡`, value:x => number(x.area), best:"max" },
      { label:"楼层 / 电梯", get:x => `${x.floor} 楼 / ${x.elevator ? "有" : "无"}` },
      { label:"房东类型", get:x => landlordLabel(x) },
      { label:"租住安全", get:x => `${safetySummary(x).score} 分 · ${safetySummary(x).label}`, value:x => safetySummary(x).score, best:"max" }
    ];
    const few = scored.length <= 3;
    const minWidth = few ? "100%" : `${150 + scored.length * 190}px`;
    els.table.innerHTML = `<table class="compare-table ${few ? "few-columns" : ""}" style="min-width:${minWidth}"><thead><tr><th>对比项目</th>${scored.map((x,i) => `<th>${i===0?"★ ":""}${escapeHTML(x.name)}</th>`).join("")}</tr></thead><tbody>${rows.map(row => {
      const values = row.value ? scored.map(row.value) : [];
      const bestValue = row.best === "min" ? Math.min(...values) : row.best === "max" ? Math.max(...values) : null;
      return `<tr><td>${row.label}</td>${scored.map(x => { const isBest = row.value && row.value(x) === bestValue; return `<td class="${isBest ? "best-cell" : ""}">${isBest ? "<strong>" : ""}${row.get(x)}${isBest ? "</strong>" : ""}</td>`; }).join("")}</tr>`;
    }).join("")}</tbody></table>`;
  }

  function renderOutputs() {
    const scored = scoreListings(state.listings);
    renderBanner(scored);
    renderCards(scored);
    renderTable(scored);
    document.querySelectorAll(".view-switch button").forEach(btn => btn.classList.toggle("active", btn.dataset.view === state.view));
    els.cards.hidden = state.view !== "cards";
    els.table.hidden = state.view !== "table";
    saveState();
  }

  function scheduleOutputs() {
    cancelAnimationFrame(resultFrame);
    resultFrame = requestAnimationFrame(renderOutputs);
  }

  function render() {
    renderWeights();
    renderOutputs();
  }

  function showToast(message) {
    clearTimeout(toastTimer);
    els.toast.textContent = message;
    els.toast.classList.add("show");
    toastTimer = setTimeout(() => els.toast.classList.remove("show"), 2200);
  }

  function openForm(item = null) {
    els.form.reset();
    els.dialogTitle.textContent = item ? "编辑房源" : "添加房源";
    const values = normalizeListing(item || { id:"", name:"", rent:3500, area:35, commute:35, paymentMonths:3, depositMonths:1, agencyFee:0, managementFee:0, propertyFee:100, utilities:200, otherFee:0, floor:5, elevator:true, lighting:3, condition:3, noise:3, landlordType:"unknown", safety:clone(defaultSafety), notes:"" });
    Object.entries(values).forEach(([key, value]) => {
      if (els.form.elements[key]) els.form.elements[key].value = String(value);
    });
    Object.entries(values.safety).forEach(([key, value]) => {
      if (els.form.elements[key]) els.form.elements[key].value = String(value);
    });
    updateSubleaseVisibility();
    els.dialog.showModal();
    setTimeout(() => els.form.elements.name.focus(), 50);
  }

  function formToListing(form) {
    const data = new FormData(form);
    const get = key => data.get(key);
    return {
      id: get("id") || `home-${Date.now()}`,
      name: get("name").trim(), rent: number(get("rent")), area: number(get("area")), commute: number(get("commute")),
      paymentMonths: number(get("paymentMonths")), depositMonths: number(get("depositMonths")), agencyFee: number(get("agencyFee")),
      managementFee: number(get("managementFee")), propertyFee: number(get("propertyFee")), utilities: number(get("utilities")), otherFee: number(get("otherFee")),
      floor: number(get("floor")), elevator: get("elevator") === "true", lighting: number(get("lighting")),
      condition: number(get("condition")), noise: number(get("noise")), landlordType: get("landlordType"),
      safety: {
        subleaseAuth: get("landlordType") === "sublessor" ? get("subleaseAuth") : "na",
        depositTerms: get("depositTerms"), utilityTerms: get("utilityTerms"),
        exitTerms: get("exitTerms"), repairTerms: get("repairTerms")
      },
      notes: get("notes").trim()
    };
  }

  function updateSubleaseVisibility() {
    const show = els.form.elements.landlordType.value === "sublessor";
    document.querySelector("#subleaseAuthWrap").hidden = !show;
    if (!show) els.form.elements.subleaseAuth.value = "na";
  }

  document.querySelector("#addBtn").addEventListener("click", () => openForm());
  document.querySelector("#closeDialogBtn").addEventListener("click", () => els.dialog.close());
  document.querySelector("#cancelDialogBtn").addEventListener("click", () => els.dialog.close());
  els.modes.addEventListener("click", e => {
    const button = e.target.closest("[data-score-mode]");
    if (!button) return;
    const key = button.dataset.scoreMode;
    state.scoreMode = key;
    if (SCORE_MODES[key].weights) state.weights = cloneModeWeights(key);
    render();
    showToast(key === "custom" ? "现在可以自由调整权重" : `已切换为${SCORE_MODES[key].label}`);
  });
  document.querySelector("#resetBtn").addEventListener("click", () => {
    if (!confirm("恢复示例会覆盖当前房源和权重，确定继续吗？")) return;
    state = clone(defaultState); render(); showToast("已恢复示例房源");
  });
  document.querySelector("#methodToggle").addEventListener("click", e => {
    const btn = e.currentTarget; const open = btn.getAttribute("aria-expanded") === "true";
    btn.setAttribute("aria-expanded", String(!open)); document.querySelector("#methodContent").hidden = open;
  });
  els.form.elements.landlordType.addEventListener("change", updateSubleaseVisibility);
  els.weights.addEventListener("input", e => {
    if (!e.target.matches("[data-weight]")) return;
    state.scoreMode = "custom";
    adjustWeights(e.target.dataset.weight, number(e.target.value));
    updateModeUI();
    updateWeightUI();
    scheduleOutputs();
  });
  els.weights.addEventListener("click", e => {
    const button = e.target.closest("[data-weight-adjust]");
    if (!button) return;
    const key = button.dataset.weightKey;
    state.scoreMode = "custom";
    adjustWeights(key, clamp(state.weights[key] + number(button.dataset.weightAdjust), 0, 100));
    updateModeUI();
    updateWeightUI();
    scheduleOutputs();
  });
  document.querySelector(".view-switch").addEventListener("click", e => {
    const btn = e.target.closest("[data-view]"); if (!btn) return;
    state.view = btn.dataset.view; render();
  });
  els.cards.addEventListener("click", e => {
    const button = e.target.closest("[data-action]"); if (!button) return;
    const { action, id } = button.dataset;
    if (action === "add") return openForm();
    const item = state.listings.find(x => x.id === id);
    if (action === "edit" && item) openForm(item);
    if (action === "delete" && item && confirm(`确定删除“${item.name}”吗？`)) {
      state.listings = state.listings.filter(x => x.id !== id); render(); showToast("房源已删除");
    }
    if (action === "detail") {
      const detail = document.querySelector(`#detail-${CSS.escape(id)}`);
      detail.hidden = !detail.hidden;
      button.textContent = detail.hidden ? "展开评分详情 ↓" : "收起评分详情 ↑";
    }
  });
  els.form.addEventListener("submit", e => {
    e.preventDefault();
    if (!els.form.reportValidity()) return;
    const listing = formToListing(els.form);
    const index = state.listings.findIndex(x => x.id === listing.id);
    if (index >= 0) state.listings[index] = listing; else state.listings.push(listing);
    els.dialog.close(); render(); showToast(index >= 0 ? "房源已更新" : "房源已添加");
  });
  els.dialog.addEventListener("click", e => {
    if (e.target === els.dialog) els.dialog.close();
  });

  function registerWebMCP() {
    const modelContext = navigator.modelContext;
    if (!modelContext || typeof modelContext.registerTool !== "function") return;
    try {
      modelContext.registerTool({
        name: "add_rental_listing",
        description: "向租房决策助手添加一套房源，并立即重新计算排名。",
        inputSchema: {
          type: "object",
          properties: {
            name: { type: "string", description: "房源名称" },
            rent: { type: "number", description: "月租，单位元" },
            area: { type: "number", description: "面积，单位平方米" },
            commute: { type: "number", description: "单程通勤分钟数" }
          },
          required: ["name", "rent", "area", "commute"]
        },
        execute: async input => {
          state.listings.push({
            id: `home-${Date.now()}`, name: String(input.name), rent: number(input.rent), area: number(input.area), commute: number(input.commute),
            paymentMonths: 3, depositMonths: 1, agencyFee: 0, managementFee: 0, propertyFee: 0, utilities: 200,
            otherFee: 0, floor: 5, elevator: true, lighting: 3, condition: 3, noise: 3, landlordType: "unknown",
            safety: clone(defaultSafety), notes: "由助手添加，可在页面继续编辑。"
          });
          render();
          return { content: [{ type: "text", text: `已添加${input.name}，当前共 ${state.listings.length} 套房源。` }] };
        }
      });
      modelContext.registerTool({
        name: "set_rental_preferences",
        description: "设置经济成本、通勤效率、居住体验和租住安全四项权重，数值会自动换算为百分比。",
        inputSchema: {
          type: "object",
          properties: {
            cost: { type: "number" }, commute: { type: "number" }, living: { type: "number" }, risk: { type: "number" }
          },
          required: ["cost", "commute", "living", "risk"]
        },
        execute: async input => {
          const keys = ["cost", "commute", "living", "risk"];
          const total = keys.reduce((sum, key) => sum + Math.max(0, number(input[key])), 0) || 4;
          let used = 0;
          keys.forEach((key, index) => {
            state.weights[key] = index === keys.length - 1 ? 100 - used : Math.round(Math.max(0, number(input[key])) / total * 100);
            used += state.weights[key];
          });
          state.scoreMode = "custom";
          render();
          return { content: [{ type: "text", text: `偏好已更新，当前首选是${scoreListings(state.listings)[0]?.name || "暂无房源"}。` }] };
        }
      });
    } catch (_) {}
  }

  render();
  registerWebMCP();
})();
