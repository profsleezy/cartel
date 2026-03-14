// client/ui.js
// Renders the non-board UI: sidebar, phase banner, timer.

import { gameState, getPlayer } from "../game/state.js";

function formatCurrency(value) {
  if (typeof value !== "number") return "$0";
  return `$${value.toLocaleString()}`;
}

// Effect type → display metadata for the active effects indicator
const EFFECT_META = {
  price_surge: { icon: "📈", label: "Price Up" },
  price_drop: { icon: "📉", label: "Price Down" },
  production_boost: { icon: "⚗️", label: "2× Output" },
  raid_immunity: { icon: "🛡️", label: "Raid Shield" },
  stash_protect: { icon: "🔐", label: "Stash Guard" },
  pusher_double: { icon: "×2", label: "×2 Capacity" },
  extra_attack: { icon: "⚔️", label: "Blitz" },
};

export function renderSidebar() {
  const sidebar = document.getElementById("sidebar");
  if (!sidebar) return;

  sidebar.innerHTML = "";

  const title = document.createElement("h2");
  title.textContent = "Player";

  const list = document.createElement("ul");

  const player = getPlayer("player1") || { cash: 0, pushers: 0 };

  // total stash across all player1-owned districts
  const ownedDistricts = gameState.districts.filter(
    (d) => d.owner === "player1",
  );
  const totalCoke = ownedDistricts.reduce(
    (s, d) => s + ((d.stash && d.stash.coke) || 0),
    0,
  );
  const totalWeed = ownedDistricts.reduce(
    (s, d) => s + ((d.stash && d.stash.weed) || 0),
    0,
  );
  const totalHeroin = ownedDistricts.reduce(
    (s, d) => s + ((d.stash && d.stash.heroin) || 0),
    0,
  );
  const totalProduct = totalCoke + totalWeed + totalHeroin;

  const roundedCash = Math.round((player.cash || 0) / 5) * 5;
  const maxRisk = Math.max(0, ...ownedDistricts.map((d) => d.heat || 0));

  const items = [
    ["Cash", formatCurrency(roundedCash)],
    ["Max Risk", `${maxRisk}`],
    ["Pushers", `${player.pushers || 0}`],
    ["Product", `${totalProduct}`],
  ];

  items.forEach(([label, value]) => {
    const li = document.createElement("li");
    const span = document.createElement("span");
    span.textContent = label;
    const strong = document.createElement("strong");
    strong.textContent = value;
    li.appendChild(span);
    li.appendChild(strong);
    list.appendChild(li);
  });

  const tip = document.createElement("div");
  tip.className = "sidebar-tip";
  tip.textContent = "Click an owned district to see actions.";

  sidebar.appendChild(title);
  sidebar.appendChild(list);

  // per-product stash totals across all owned districts
  const prodBox = document.createElement("div");
  prodBox.className = "product-breakdown";
  prodBox.innerHTML = `
    <div>🧪 ${totalCoke}</div>
    <div>🌿 ${totalWeed}</div>
    <div>⚗️ ${totalHeroin}</div>
  `;
  sidebar.appendChild(prodBox);

  sidebar.appendChild(tip);

  // active long-term card effects for this round
  renderActiveEffects(sidebar);

  // player's card hand
  renderHand(sidebar);
}

// Track which event is currently displayed so we only restart the fade
// timer when the event actually changes (renderEventTile is called every tick).
// Key format: "<roundNumber>:<eventId>"
let _shownEventKey = null;
let _fadeTimerId = null;

/**
 * Create or update the fixed event-tile callout positioned below the phase banner.
 * Each new event is shown at full opacity and fades out after 15 seconds.
 * Hidden immediately when there is no current event.
 */
export function renderEventTile() {
  const intel = document.getElementById("intel-strip");
  const intelText = document.getElementById("intel-text");
  const ev = gameState.currentEvent;

  if (!intel || !intelText) return;
  if (!ev) {
    intel.classList.add("hidden");
    return;
  }

  intel.classList.remove("hidden");
  intelText.textContent = `${ev.name}: ${ev.description}`;
}

function renderTopBar(phase, timer, roundNumber) {
  const segments = Array.from(document.querySelectorAll(".phase-segment"));
  const active = phase ? phase.toLowerCase() : "buying";
  segments.forEach((seg) => {
    const p = seg.dataset.phase ? seg.dataset.phase.toLowerCase() : "";
    if (p === active) {
      seg.classList.add("active");
    } else {
      seg.classList.remove("active");
    }
  });

  const ring = document.querySelector(".timer-ring circle");
  if (ring) {
    const remain = Math.max(0, Math.min(45, timer));
    const pct = 1 - remain / 45;
    ring.style.strokeDashoffset = `${50 * pct}`;
  }

  const timerSeconds = document.getElementById("timer-seconds");
  if (timerSeconds) timerSeconds.textContent = `${timer}`;

  const roundEl = document.getElementById("round-value");
  if (roundEl) roundEl.textContent = `${roundNumber}`;
}

function renderBottomBar() {
  const container = document.getElementById("bottom-bar");
  if (!container) return;
  container.innerHTML = "";

  const defaultPlayers = [
    { id: "player1", name: "Jade", codename: "Viper", cash: 50000, dist: 4, push: 2, accent: "#10b981" },
    { id: "enemy1", name: "Crimson", codename: "Red", cash: 36000, dist: 3, push: 3, accent: "#f87171" },
    { id: "enemy2", name: "Blue", codename: "Shade", cash: 34500, dist: 3, push: 2, accent: "#60a5fa" },
    { id: "enemy3", name: "Violet", codename: "Wraith", cash: 31700, dist: 3, push: 2, accent: "#a78bfa" },
  ];

  const players = gameState.players && gameState.players.length > 0 ? gameState.players : defaultPlayers;

  for (let i = 0; i < 4; i += 1) {
    const p = players[i] || defaultPlayers[i];
    const strip = document.createElement("div");
    strip.className = "player-strip" + (i === 0 ? " local" : "");

    const dot = document.createElement("div");
    dot.className = "player-dot";
    dot.style.background = p.accent;
    dot.style.boxShadow = `0 0 8px ${p.accent}66`;

    const meta = document.createElement("div");
    meta.className = "player-meta";
    const name = document.createElement("div"); name.className = "player-name"; name.textContent = p.name;
    name.style.color = i === 0 ? "#34d399" : "rgba(255,255,255,0.55)";
    const codename = document.createElement("div"); codename.className = "player-codename"; codename.textContent = p.codename;
    meta.appendChild(name);
    meta.appendChild(codename);

    const stats = document.createElement("div"); stats.className = "player-stats";
    const cash = document.createElement("div"); cash.className = "stat-column"; cash.innerHTML = `<div class="stat-value cash-value" style="color:${p.accent}">${formatCurrency(p.cash || 0)}</div><div class="stat-label">Cash</div>`;
    const dist = document.createElement("div"); dist.className = "stat-column"; dist.innerHTML = `<div class="stat-value">${p.dist || 0}</div><div class="stat-label">Dist</div>`;
    const push = document.createElement("div"); push.className = "stat-column"; push.innerHTML = `<div class="stat-value">${p.push || 0}</div><div class="stat-label">Push</div>`;
    stats.appendChild(cash); stats.appendChild(dist); stats.appendChild(push);

    strip.appendChild(dot);
    strip.appendChild(meta);
    strip.appendChild(stats);
    container.appendChild(strip);
  }
}

export function renderPhaseBanner(phase) {
  renderTopBar(phase, gameState.timer, gameState.roundNumber);
}

export function renderTimer(seconds) {
  renderTopBar(gameState.phase, seconds, gameState.roundNumber);
}

function renderGameUi() {
  renderTopBar(gameState.phase, gameState.timer, gameState.roundNumber);
  renderBottomBar();
  renderEventTile();
}

// expose helper so other code can update the bar if needed
export function renderGameStatus() {
  renderGameUi();
}

/**
 * Render the player's card hand inside the provided sidebar element.
 * Cards matching the current phase get .card--active.
 * After a card is played this round every card gets .card--spent.
 */
function renderHand(sidebar) {
  const player = getPlayer("player1");
  if (!player || !Array.isArray(player.hand) || player.hand.length === 0)
    return;

  const section = document.createElement("div");
  section.className = "hand";

  const heading = document.createElement("div");
  heading.className = "hand__heading";
  heading.textContent = "Hand";
  section.appendChild(heading);

  player.hand.forEach((card) => {
    const el = document.createElement("div");
    el.className = "card";
    el.dataset.cardId = card.id;

    const phaseMatch = card.phase === "Any" || card.phase === gameState.phase;

    if (phaseMatch) {
      el.classList.add("card--active");
    }

    el.innerHTML = `
      <div class="card__name">${uiEscape(card.name)}</div>
      <div class="card__phase">${uiEscape(card.phase)}</div>
      <div class="card__desc">${uiEscape(card.description)}</div>
    `;
    section.appendChild(el);
  });

  sidebar.appendChild(section);
}

/**
 * Render glowing pill indicators for long-term card effects that are
 * still active this round. Shown between the stats and the hand.
 */
function renderActiveEffects(sidebar) {
  const effects = Array.isArray(gameState.activeCardEffects)
    ? gameState.activeCardEffects
    : [];
  const raided = (gameState.districts || []).filter(
    (d) => d.owner === "player1" && d.raided,
  );
  if (effects.length === 0 && raided.length === 0) return;

  const section = document.createElement("div");
  section.className = "active-effects";

  const heading = document.createElement("div");
  heading.className = "active-effects__heading";
  heading.textContent = "Active Effects";
  section.appendChild(heading);

  const hint = document.createElement("div");
  hint.className = "active-effects__hint";
  hint.textContent = "Modifiers and raid timers shown for this round.";
  hint.style.fontSize = "11px";
  hint.style.opacity = "0.7";
  hint.style.marginBottom = "6px";
  section.appendChild(hint);

  const list = document.createElement("div");
  list.className = "active-effects__list";

  effects.forEach((e) => {
    const meta = EFFECT_META[e.effectType] || { icon: "✦", label: e.name };
    const pill = document.createElement("div");
    pill.className = "active-effect-pill";
    pill.title = e.description;
    pill.innerHTML = `
      <span class="active-effect-pill__icon">${meta.icon}</span>
      <span class="active-effect-pill__name">${uiEscape(e.name)}</span>
      <span style="font-size:10px;opacity:0.7;margin-left:6px;">Active</span>
    `;
    list.appendChild(pill);
  });

  raided.forEach((d) => {
    const pill = document.createElement("div");
    pill.className = "active-effect-pill";
    pill.title = `${d.name} is raided until ${d.raidTimer || 0} phase ticks`;
    pill.innerHTML = `
      <span class="active-effect-pill__icon">⚠️</span>
      <span class="active-effect-pill__name">${uiEscape(d.name)} raided</span>
      <span style="font-size:10px;opacity:0.7;margin-left:6px;">${d.raidTimer || 0} ticks left</span>
    `;
    list.appendChild(pill);
  });

  section.appendChild(list);
  sidebar.appendChild(section);
}

/** Minimal HTML-escape for dynamic text inserted via innerHTML. */
function uiEscape(s) {
  return String(s).replace(
    /[&<>"]/g,
    (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[ch],
  );
}

/**
 * Incrementally update the floating news panel.
 * Called every second from main.js's gameStateChanged handler.
 *
 * — New items are prepended (newest at top) identified by their ts timestamp.
 * — Items older than 28 s get .news-item--fading which triggers a CSS fade.
 * — Items older than 30 s are removed from the DOM and from gameState.news.
 * — The panel hides itself when no items remain.
 */
export function renderNewsPanel() {
  // ── Ensure panel shell exists ──────────────────────────────────────────────
  let panel = document.getElementById("news-panel");
  if (!panel) {
    panel = document.createElement("div");
    panel.id = "news-panel";
    panel.style.position = "fixed";
    panel.style.right = "12px";
    panel.style.bottom = "12px";
    panel.style.width = "320px";
    panel.style.background = "var(--surface)";
    panel.style.color = "var(--text)";
    panel.style.padding = "10px";
    panel.style.borderRadius = "8px";
    panel.style.boxShadow = "0 6px 18px rgba(0,0,0,0.4)";
    panel.style.zIndex = 2000;
    panel.style.fontSize = "13px";
    panel.style.maxHeight = "50vh";
    panel.style.overflowY = "auto";

    const header = document.createElement("div");
    header.className = "news-header";
    header.textContent = "News";
    panel.appendChild(header);

    const ul = document.createElement("ul");
    ul.id = "news-list";
    ul.style.listStyle = "none";
    ul.style.margin = "0";
    ul.style.padding = "0";
    panel.appendChild(ul);

    document.body.appendChild(panel);
  }

  const ul = document.getElementById("news-list");
  if (!ul) return;

  const news = Array.isArray(gameState.news) ? gameState.news : [];
  const now = Date.now();

  // ── Prepend any items not yet in the DOM ───────────────────────────────────
  const existingKeys = new Set(
    Array.from(ul.querySelectorAll("[data-ts]")).map((el) => el.dataset.ts),
  );
  // Iterate newest-first so prepend order keeps newest at top
  [...news].reverse().forEach((item) => {
    if (!item || !item.ts) return;
    const key = String(item.ts);
    if (existingKeys.has(key)) return;
    const li = document.createElement("li");
    li.className = "news-item";
    li.dataset.ts = key;
    li.textContent = item.text || String(item);
    ul.prepend(li);
  });

  // ── Age existing DOM items: fade then remove ───────────────────────────────
  Array.from(ul.querySelectorAll("[data-ts]")).forEach((el) => {
    const age = now - parseInt(el.dataset.ts, 10);
    if (age > 28000 && !el.classList.contains("news-item--fading")) {
      el.classList.add("news-item--fading");
    }
    if (age > 30000) {
      el.remove();
      // Keep gameState.news in sync
      if (Array.isArray(gameState.news)) {
        gameState.news = gameState.news.filter(
          (n) => n && String(n.ts) !== el.dataset.ts,
        );
      }
    }
  });

  // ── Show / hide the panel ──────────────────────────────────────────────────
  panel.style.display = ul.children.length > 0 ? "block" : "none";
}

/**
 * Show a simple full-screen game over overlay.
 */
export function showGameOver(youWon) {
  let overlay = document.getElementById("game-over-overlay");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "game-over-overlay";
    overlay.style.position = "fixed";
    overlay.style.left = "0";
    overlay.style.top = "0";
    overlay.style.width = "100%";
    overlay.style.height = "100%";
    overlay.style.display = "flex";
    overlay.style.alignItems = "center";
    overlay.style.justifyContent = "center";
    overlay.style.background = "rgba(0,0,0,0.7)";
    overlay.style.zIndex = "9999";
    document.body.appendChild(overlay);
  }
  overlay.innerHTML = `<div style="background:var(--surface);padding:24px;border-radius:8px;color:var(--text);text-align:center;min-width:220px">
    <h2>${youWon ? "You Win!" : "You Lost"}</h2>
    <div style="margin-top:12px"><button id="game-over-close">Close</button></div>
  </div>`;
  const btn = document.getElementById("game-over-close");
  if (btn)
    btn.addEventListener("click", () => {
      overlay.remove();
    });
}

export function renderPhaseBanner(phase) {
  const el = document.getElementById("phase-banner");
  if (!el) return;
  el.textContent = `Phase: ${phase}`;
}

export function renderTimer(seconds) {
  const el = document.getElementById("timer");
  if (!el) return;
  el.textContent = `${seconds}s`;
}

/**
 * Show an action panel for the given district.
 *
 * Options:
 *   buyButtons    – [{ label, onClick, disabled }]
 *   buildingList  – [{ label, onDelete }]
 *   dealButtons   – [{ label, onClick, disabled }]  (legacy, unused in dealing phase)
 *   attackControls – { selectedCount, max, onCountChange, confirmDisabled, onConfirm, targetId }
 *   dealingControls – {
 *     sourceName: string,
 *     stash: { coke, weed, heroin },
 *     sections: [{
 *       productType, emoji, stashAmt,
 *       targets: [{ id, name, price, maxQty, disabled, onSell(qty) }]
 *     }]
 *   }
 */
export function showActionPanel(
  districtId,
  {
    buyButtons,
    dealButtons,
    buildingList,
    attackControls,
    dealingControls,
  } = {},
) {
  const sidebar = document.getElementById("sidebar");
  if (!sidebar) return;

  const panel = document.createElement("div");
  panel.className = "action-panel";
  panel.innerHTML = `
    <h3>Actions</h3>
    <div id="action-district">${districtId}</div>
  `;

  // ── buy buttons ────────────────────────────────────────────────────────────
  if (Array.isArray(buyButtons)) {
    buyButtons.forEach((b) => {
      const btn = document.createElement("button");
      btn.textContent = b.label;
      if (b.disabled) btn.disabled = true;
      btn.addEventListener("click", () => {
        if (typeof b.onClick === "function") b.onClick();
      });
      panel.appendChild(btn);
    });
  }

  // ── building list (with delete) ────────────────────────────────────────────
  if (Array.isArray(buildingList)) {
    const listWrap = document.createElement("div");
    listWrap.style.marginTop = "8px";
    buildingList.forEach((b) => {
      const row = document.createElement("div");
      row.className = "building-row";
      const span = document.createElement("span");
      span.textContent = b.label;
      span.style.marginRight = "8px";
      const del = document.createElement("button");
      del.textContent = "×";
      del.title = "Remove building (refund $50)";
      del.addEventListener("click", () => {
        if (typeof b.onDelete === "function") b.onDelete();
      });
      row.appendChild(span);
      row.appendChild(del);
      listWrap.appendChild(row);
    });
    panel.appendChild(listWrap);
  }

  // ── deal buttons (legacy) ──────────────────────────────────────────────────
  if (Array.isArray(dealButtons)) {
    dealButtons.forEach((b) => {
      const btn = document.createElement("button");
      btn.textContent = b.label;
      if (b.disabled) btn.disabled = true;
      btn.addEventListener("click", () => {
        if (typeof b.onClick === "function") b.onClick();
      });
      panel.appendChild(btn);
    });
  }

  // ── attack controls ────────────────────────────────────────────────────────
  if (attackControls && typeof attackControls === "object") {
    const wrap = document.createElement("div");
    wrap.style.marginTop = "8px";
    wrap.innerHTML = `<div style="margin-bottom:6px">Attack</div>`;

    const countLabel = document.createElement("div");
    countLabel.textContent = `Count: ${attackControls.selectedCount || 1}`;
    wrap.appendChild(countLabel);

    const range = document.createElement("input");
    range.type = "range";
    range.min = 1;
    range.max = attackControls.max || 1;
    range.step = 1;
    range.value = attackControls.selectedCount || 1;
    range.addEventListener("input", (e) => {
      const v = parseInt(e.target.value, 10) || 1;
      countLabel.textContent = `Count: ${v}`;
      if (typeof attackControls.onCountChange === "function")
        attackControls.onCountChange(v);
    });
    wrap.appendChild(range);

    const targetLabel = document.createElement("div");
    targetLabel.style.marginTop = "6px";
    targetLabel.textContent = `Target: ${attackControls.targetId || "None"}`;
    wrap.appendChild(targetLabel);

    const confirm = document.createElement("button");
    confirm.textContent = "Confirm Attack";
    if (attackControls.confirmDisabled) confirm.disabled = true;
    confirm.addEventListener("click", () => {
      if (typeof attackControls.onConfirm === "function")
        attackControls.onConfirm();
    });
    wrap.appendChild(confirm);

    panel.appendChild(wrap);
  }

  // ── dealing controls ───────────────────────────────────────────────────────
  if (dealingControls && typeof dealingControls === "object") {
    const wrap = document.createElement("div");
    wrap.className = "dealing-panel";

    // source header: name + stash summary
    const header = document.createElement("div");
    header.className = "deal-source";
    const nameEl = document.createElement("div");
    nameEl.className = "deal-source-name";
    nameEl.textContent = dealingControls.sourceName;
    const stashEl = document.createElement("div");
    stashEl.className = "deal-stash-summary";
    stashEl.textContent = [
      `🧪 ${dealingControls.stash.coke || 0}`,
      `🌿 ${dealingControls.stash.weed || 0}`,
      `⚗️ ${dealingControls.stash.heroin || 0}`,
    ].join("  ");
    header.appendChild(nameEl);
    header.appendChild(stashEl);
    wrap.appendChild(header);

    // one section per product type that has stash > 0
    dealingControls.sections.forEach((section) => {
      const secEl = document.createElement("div");
      secEl.className = "deal-section";

      const secHeader = document.createElement("div");
      secHeader.className = "deal-section-header";
      secHeader.textContent = `${section.emoji} ${section.productType.charAt(0).toUpperCase() + section.productType.slice(1)} — ${section.stashAmt} available`;
      secEl.appendChild(secHeader);

      // target rows, highest price first
      section.targets.forEach((target) => {
        const row = document.createElement("div");
        row.className = "deal-row";

        const nameSpan = document.createElement("span");
        nameSpan.className = "deal-target-name";
        nameSpan.textContent = target.name;

        const priceSpan = document.createElement("span");
        priceSpan.className = "deal-target-price";
        priceSpan.textContent = `$${target.price}`;

        const qtyInput = document.createElement("input");
        qtyInput.type = "number";
        qtyInput.className = "deal-qty";
        qtyInput.min = 1;
        qtyInput.max = target.maxQty;
        qtyInput.value = 1;

        const sellBtn = document.createElement("button");
        sellBtn.textContent = "Sell";
        sellBtn.disabled = target.disabled;
        sellBtn.addEventListener("click", () => {
          const qty = Math.max(
            1,
            Math.min(parseInt(qtyInput.value, 10) || 1, target.maxQty),
          );
          if (typeof target.onSell === "function") target.onSell(qty);
        });

        row.appendChild(nameSpan);
        row.appendChild(priceSpan);
        row.appendChild(qtyInput);
        row.appendChild(sellBtn);
        secEl.appendChild(row);
      });

      wrap.appendChild(secEl);
    });

    panel.appendChild(wrap);
  }

  // replace any existing action panel
  const prev = sidebar.querySelector(".action-panel");
  if (prev) prev.remove();
  sidebar.appendChild(panel);
}

export function clearActionPanel() {
  const sidebar = document.getElementById("sidebar");
  if (!sidebar) return;
  const prev = sidebar.querySelector(".action-panel");
  if (prev) prev.remove();
}
