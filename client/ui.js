// client/ui.js
// Renders the non-board UI: sidebar, phase banner, timer.

import { gameState, getPlayer } from "../game/state.js";

let newsInterval = null;

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
    ["Cash", `$${roundedCash}`],
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

  // news is rendered in a separate floating panel
  renderNewsPanel();
}

/** Render or update a floating news panel in the bottom-right of the screen. */
export function renderNewsPanel() {
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
    panel.style.overflow = "hidden";
    document.body.appendChild(panel);
  }

  if (
    !gameState ||
    !Array.isArray(gameState.news) ||
    gameState.news.length === 0
  ) {
    panel.style.display = "none";
    if (newsInterval) {
      clearInterval(newsInterval);
      newsInterval = null;
    }
    return;
  }

  // prune items older than 30s
  const now = Date.now();
  gameState.news = gameState.news.filter((n) => {
    const ts = n && n.ts ? n.ts : 0;
    return now - ts < 30000;
  });

  if (gameState.news.length > 5) {
    gameState.news = gameState.news.slice(-5);
  }

  panel.style.display = "block";
  panel.innerHTML = `<div style="font-weight:600;margin-bottom:6px">News</div>`;
  const ul = document.createElement("ul");
  ul.style.listStyle = "none";
  ul.style.margin = "0";
  ul.style.padding = "0";
  ul.style.maxHeight = "38vh";
  ul.style.overflowY = "auto";
  const recent = Array.from(gameState.news).slice(-5).reverse();
  recent.forEach((item) => {
    const li = document.createElement("li");
    li.style.marginBottom = "8px";
    li.style.paddingBottom = "6px";
    li.style.borderBottom = "1px solid rgba(255,255,255,0.03)";
    li.textContent = item && item.text ? item.text : String(item || "");
    ul.appendChild(li);
  });
  panel.appendChild(ul);

  if (!newsInterval) {
    newsInterval = setInterval(() => {
      renderNewsPanel();
    }, 1000);
  }
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
