// client/ui.js
// Renders the non-board UI: sidebar, phase banner, timer, side panel.

import { gameState, getPlayer } from "../game/state.js";

let selectedDistrictId = null;

const OWNER_NAME_COLORS = {
  player1: "#6ee7b7",
  enemy1: "#fca5a5",
  enemy2: "#93c5fd",
  enemy3: "#c4b5fd",
  neutral: "rgba(255,255,255,0.4)",
};

export function getSelectedDistrictId() {
  return selectedDistrictId;
}

export function closeDistrictPanel() {
  const panel = document.getElementById("side-panel");
  if (panel) panel.classList.remove("open");
  document.body.classList.remove("side-panel-open");
  selectedDistrictId = null;
  const board = document.getElementById("board");
  if (board)
    board.querySelectorAll(".district.selected").forEach((el) => el.classList.remove("selected"));
}

export function openDistrictPanel(
  id,
  district,
  { buyButtons = [], buildingList = [], attackControls, dealingControls, statusMessage } = {},
) {
  selectedDistrictId = id;
  const panel = document.getElementById("side-panel");
  if (panel) {
    panel.classList.add("open");
    document.body.classList.add("side-panel-open");
  }

  const nameEl = document.getElementById("panel-district-name");
  const ownerEl = document.getElementById("panel-owner-line");
  const owner = (district && district.owner) || "neutral";
  const ownerLabel =
    owner === "player1" ? "OWNED" : owner === "neutral" ? "NEUTRAL" : "ENEMY";
  if (nameEl) {
    nameEl.textContent = (district && district.name) || id;
    nameEl.style.color = OWNER_NAME_COLORS[owner] || OWNER_NAME_COLORS.neutral;
  }
  if (ownerEl) ownerEl.textContent = ownerLabel;

  const thugs = (district && district.thugs) || 0;
  const buildings = (district && district.buildings) || [];
  const heat = (district && district.heat) || 0;
  const HEAT_CAP = 20;
  const riskPct = Math.min(100, Math.round((heat / HEAT_CAP) * 100));

  const statsEl = document.getElementById("panel-stats");
  if (statsEl) {
    const riskClass =
      riskPct >= 70 ? "risk-high" : riskPct >= 30 ? "risk-mid" : "risk-low";
    statsEl.innerHTML = `
      <div class="panel-stat-card"><span class="panel-stat-label">Thugs</span><div class="panel-stat-value">${thugs}</div></div>
      <div class="panel-stat-card"><span class="panel-stat-label">Buildings</span><div class="panel-stat-value">${buildings.length}/5</div></div>
      <div class="panel-stat-card ${riskClass}"><span class="panel-stat-label">Risk</span><div class="panel-stat-value">${heat}/${HEAT_CAP}</div></div>
    `;
  }

  // Guard: if attackControls were requested but player already used attack this round
  if (attackControls && gameState.phase === 'Attacking' && owner === 'player1') {
    const player = getPlayer('player1');
    const extraAttack = gameState.eventModifiers && gameState.eventModifiers.extraAttack;
    if (player && player.hasAttackedThisRound && !extraAttack) {
      attackControls = null;
      statusMessage = statusMessage || 'Attack already used this round';
    }
  }

  const stash = (district && district.stash) || { coke: 0, weed: 0, heroin: 0 };
  const stashEl = document.getElementById("panel-stash");
  if (stashEl) {
    stashEl.innerHTML = `
      <div class="panel-section-title" style="font-size:7px;text-transform:uppercase;letter-spacing:0.1em;color:rgba(255,255,255,0.2);margin-bottom:6px;">Stash</div>
      <div class="panel-row"><span class="panel-row-label"><span class="panel-row-dot coke"></span>Cocaine</span><span class="panel-row-value">${stash.coke || 0}</span></div>
      <div class="panel-row"><span class="panel-row-label"><span class="panel-row-dot weed"></span>Weed</span><span class="panel-row-value">${stash.weed || 0}</span></div>
      <div class="panel-row"><span class="panel-row-label"><span class="panel-row-dot heroin"></span>Heroin</span><span class="panel-row-value">${stash.heroin || 0}</span></div>
    `;
  }

  const useDealingPrices = gameState.phase === "Dealing" && district && district.dealingPrices;
  const prices = useDealingPrices
    ? district.dealingPrices
    : (district && district.prices) || { coke: 0, weed: 0, heroin: 0 };
  const priceArr = [
    { k: "coke", label: "Coke", v: prices.coke || 0 },
    { k: "weed", label: "Weed", v: prices.weed || 0 },
    { k: "heroin", label: "Heroin", v: prices.heroin || 0 },
  ];
  const maxPrice = Math.max(...priceArr.map((p) => p.v));
  const pricesEl = document.getElementById("panel-prices");
  if (pricesEl) {
    pricesEl.innerHTML = `
      <div class="panel-section-title">${gameState.phase === "Dealing" ? "Live prices this round" : "Base prices"}</div>
      ${priceArr
        .map(
          (p) =>
            `<div class="panel-row"><span class="panel-row-label">${p.label}</span><span class="panel-row-value ${p.v === maxPrice && maxPrice > 0 ? "highest" : ""}">$${(p.v || 0).toLocaleString()}</span></div>`,
        )
        .join("")}
    `;
  }
      const actionsEl = document.getElementById("panel-actions");
      if (actionsEl) {
        let html = "";

        // status message (single-line muted text)
        if (statusMessage) {
          html += `<div class="panel-actions-title">${gameState.phase || "Buying"} phase</div>`;
          html += `<div style="font-size:9px;color:rgba(255,255,255,0.3);padding:6px 0;font-style:italic;">${uiEscape(statusMessage)}</div>`;
        } else if (attackControls) {
          html += `<div class="panel-actions-title">Attacking phase</div>`;
          html += `<div style="margin-bottom:8px;">`;
          html += `<div style="font-size:9px;color:rgba(255,255,255,0.35);margin-bottom:4px;">Count: ${attackControls.selectedCount || 1}</div><input type="range" min="1" max="${attackControls.max || 1}" value="${attackControls.selectedCount || 1}" style="width:100%;" data-attack-count>`;
          html += `</div>`;
          html += `<div style="font-size:9px;color:rgba(255,255,255,0.35);margin-bottom:6px;">Target: ${attackControls.targetId || "None"}</div>`;
          html += `<button type="button" class="panel-action-btn accent" data-attack-confirm ${attackControls.confirmDisabled ? "disabled" : ""}>Confirm attack</button>`;
        } else if (dealingControls && dealingControls.sections && dealingControls.sections.length) {
          html += `<div class="panel-actions-title">Dealing phase</div>`;
          // tabs for product types
          html += `<div class="deal-tabs">`;
          dealingControls.sections.forEach((section, idx) => {
            const label = `${section.emoji} ${section.productType.charAt(0).toUpperCase() + section.productType.slice(1)}`;
            html += `<button type="button" class="deal-tab ${idx === 0 ? 'active' : ''}" data-deal-tab="${section.productType}">${uiEscape(label)}</button>`;
          });
          html += `</div>`;
          html += `<div class="deal-tab-contents">`;
          dealingControls.sections.forEach((section, idx) => {
            html += `<div class="deal-tab-content" data-deal-content="${section.productType}" style="${idx === 0 ? 'display:block;' : 'display:none;'}">`;
            html += `<div class="deal-section-header">${section.emoji} ${section.productType.charAt(0).toUpperCase() + section.productType.slice(1)} — ${section.stashAmt} available</div>`;
            // show all targets; panel is scrollable so no need to hide extras
            (section.targets || []).forEach((t) => {
              const highest = t.price === Math.max(...(section.targets || []).map((x) => x.price));
              html += `
          <div class="deal-target-row">
            <div class="deal-target-info">
              <span class="deal-target-name">${uiEscape(t.name)}</span>
              <span class="deal-target-price ${highest ? 'highest' : ''}">$${t.price.toLocaleString()}</span>
            </div>
            <div class="deal-target-controls">
              <input type="number" min="1" max="${t.maxQty}" value="1" class="deal-qty-in" data-deal-target-id="${t.id}" data-deal-type="${section.productType}">
              <button type="button" class="panel-action-btn accent deal-sell-btn" data-deal-sell data-target-id="${t.id}" data-type="${section.productType}" ${t.disabled ? 'disabled' : ''}>Sell</button>
            </div>
          </div>`;
            });
            // no 'more hidden' indicator — show full list and rely on panel scroll
            html += `</div>`;
          });
          html += `</div>`;
        } else if (Array.isArray(buyButtons) && buyButtons.length) {
          html += `<div class="panel-actions-title">Buying phase</div>`;
          html += `<div class="panel-actions-grid">`;
          buyButtons.forEach((b, i) => {
            const label = b.label.replace(/\s*\(costs?\s*\$[\d,]+\)\s*$/i, "").trim();
            const costMatch = b.label.match(/\$[\d,]+/);
            const cost = costMatch ? costMatch[0] : "";
            html += `<button type="button" class="panel-action-btn" ${b.disabled ? "disabled" : ""} data-action-index="${i}"><span class="panel-action-label">${uiEscape(label)}</span><span class="panel-action-cost">${cost}</span></button>`;
          });
          html += `</div>`;
        } else {
          // no content — leave empty; visibility rules will hide the section
          html = "";
        }

        actionsEl.innerHTML = html;

        if (dealingControls && dealingControls.sections) {
          // tab switching
          const tabBtns = actionsEl.querySelectorAll('.deal-tab');
          if (tabBtns && tabBtns.length) {
            tabBtns.forEach((btn) => {
              btn.addEventListener('click', () => {
                tabBtns.forEach((b) => b.classList.remove('active'));
                btn.classList.add('active');
                const type = btn.dataset.dealTab;
                actionsEl.querySelectorAll('.deal-tab-content').forEach((c) => {
                  c.style.display = c.dataset.dealContent === type ? 'block' : 'none';
                });
              });
            });
          }

          actionsEl.querySelectorAll("[data-deal-sell]").forEach((btn) => {
            const targetId = btn.dataset.targetId;
            const type = btn.dataset.type;
            const section = (dealingControls.sections || []).find((s) => s.productType === type);
            const target = section && (section.targets || []).find((t) => t.id === targetId);
            if (target && typeof target.onSell === "function") {
              btn.addEventListener("click", () => {
                const qtyInput = actionsEl.querySelector(`.deal-qty-in[data-deal-target-id="${targetId}"][data-deal-type="${type}"]`);
                const qty = Math.max(1, Math.min(parseInt(qtyInput && qtyInput.value, 10) || 1, target.maxQty));
                target.onSell(qty);
              });
            }
          });
        }

        if (attackControls) {
          const range = actionsEl.querySelector("[data-attack-count]");
          const confirmBtn = actionsEl.querySelector("[data-attack-confirm]");
          if (range)
            range.addEventListener("input", (e) => {
              const v = parseInt(e.target.value, 10);
              if (typeof attackControls.onCountChange === "function")
                attackControls.onCountChange(v);
              openDistrictPanel(id, gameState.districts.find((d) => d.id === id) || district, { buyButtons, buildingList, attackControls: { ...attackControls, selectedCount: v }, dealingControls });
            });
          if (confirmBtn && !attackControls.confirmDisabled)
            confirmBtn.addEventListener("click", () => {
              if (typeof attackControls.onConfirm === "function")
                attackControls.onConfirm();
            });
        } else if (Array.isArray(buyButtons) && buyButtons.length) {
          buyButtons.forEach((b, i) => {
            const btn = actionsEl.querySelector(`[data-action-index="${i}"]`);
            if (btn && typeof b.onClick === "function")
              btn.addEventListener("click", () => b.onClick());
          });
        }
      }
    const buildingsEl = document.getElementById("panel-buildings");
    if (buildingsEl) {
      buildingsEl.innerHTML = `
      <div style="font-size:7px;text-transform:uppercase;letter-spacing:0.1em;color:rgba(255,255,255,0.2);margin-bottom:6px;">Buildings</div>
      ${(buildingList || []).length
        ? (buildingList || [])
            .map(
              (b, i) =>
                `<div class="panel-building-item"><span>${uiEscape(b.label)}</span><button type="button" class="panel-building-del" data-building-del="${i}">&times;</button></div>`,
            )
            .join("")
        : '<div style="font-size:9px;color:rgba(255,255,255,0.3);">None</div>'}
    `;
      (buildingList || []).forEach((b, i) => {
        const del = buildingsEl.querySelector(`[data-building-del="${i}"]`);
        if (del && typeof b.onDelete === "function")
          del.addEventListener("click", () => b.onDelete());
      });
    }

  // Render dispatch into floating panel `#dispatch-float` (fallback to inline panel if missing)
  const dispatchContainer = document.getElementById("dispatch-float") || document.getElementById("panel-dispatch");
  if (dispatchContainer) {
    const news = Array.isArray(gameState.news) ? gameState.news : [];
    const entries = news.slice(-8).reverse();
    const listEl = dispatchContainer.querySelector('#dispatch-list') || dispatchContainer;
    if (entries.length) {
      listEl.innerHTML = entries
        .map((n) => {
          const text = (n && n.text) || String(n);
          const ts = n && n.ts ? new Date(n.ts).toLocaleTimeString() : "";
          let type = "neutral";
          if (/raid|raided/i.test(text)) type = "raid";
          else if (/win|captured|gain/i.test(text)) type = "win";
          else if (/loss|repelled|lost/i.test(text)) type = "loss";
          return `<div class="panel-dispatch-entry"><div class="panel-dispatch-text ${type}">${uiEscape(text)}</div><div class="panel-dispatch-ts">${ts}</div></div>`;
        })
        .join("");
    } else {
      listEl.innerHTML = '<div style="font-size:9px;color:rgba(255,255,255,0.3);">No activity</div>';
    }
  }

  // Visibility rules based on phase and ownership
  const phase = gameState.phase;
  const isOwned = owner === "player1";

  // panel-stash: show during Buying and Dealing only for owned districts, hide during Attacking
  const stashEl2 = document.getElementById("panel-stash");
  if (stashEl2) stashEl2.style.display = (isOwned && phase !== "Attacking") ? "block" : "none";

  // panel-prices: show during Dealing only
  const pricesEl2 = document.getElementById("panel-prices");
  if (pricesEl2) pricesEl2.style.display = (phase === "Dealing") ? "block" : "none";

  // panel-buildings: show during Buying only, and only for owned districts
  const buildingsEl2 = document.getElementById("panel-buildings");
  if (buildingsEl2) buildingsEl2.style.display = (phase === "Buying" && isOwned) ? "block" : "none";

  // panel-actions: hide entirely for non-owned districts outside of Attacking
  // (Attacking phase handles non-owned via attackControls passed from input.js)
  const actionsEl2 = document.getElementById("panel-actions");
  if (actionsEl2) {
    const actionsHtml = actionsEl2.innerHTML.trim();
    const hasVisibleContent = actionsHtml.length > 0;
    actionsEl2.style.display = hasVisibleContent ? 'block' : 'none';
  }
}

export function initPanelCloseHandlers() {
  const panel = document.getElementById("side-panel");
  const closeBtn = document.getElementById("panel-close");
  if (closeBtn) closeBtn.addEventListener("click", () => closeDistrictPanel());
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeDistrictPanel();
  });
  document.addEventListener("click", (e) => {
    if (!panel || !panel.classList.contains("open")) return;
    if (panel.contains(e.target)) return;
    // Don't close when the click was on the board (district click that opened the panel)
    if (e.target.closest("#board")) return;
    closeDistrictPanel();
  });
}

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

/** Renders the player hand into #hand-area (created by renderBottomBar). */
export function renderSidebar() {
  // Re-render the entire bottom bar (hand + player strips) so cash/pushers update
  renderBottomBar();
}

// Track which event is currently displayed so we only restart the fade
// timer when the event actually changes (renderEventTile is called every tick).
// Key format: "<roundNumber>:<eventId>"
let _shownEventKey = null;
let _fadeTimerId = null;

/**
 * Create or update the fixed event-tile callout positioned below the phase banner.
 * New event fades in (0.4s); after 15s fades out (1.2s) then display none.
 */
export function renderEventTile() {
  const intel = document.getElementById("intel-strip");
  const intelText = document.getElementById("intel-text");
  const ev = gameState.currentEvent;

  if (!intel || !intelText) return;
  if (!ev) {
    if (_fadeTimerId) {
      clearTimeout(_fadeTimerId);
      _fadeTimerId = null;
    }
    _shownEventKey = null;
    intel.classList.add("hidden");
    const p = document.getElementById('intel-progress');
    if (p) { p.style.transition = 'none'; p.style.width = '100%'; }
    return;
  }

  const eventKey = `${gameState.roundNumber || 0}:${ev.id || ev.name || ""}`;
  const isNew = eventKey !== _shownEventKey;

  // If user dismissed or timeout-hidden this exact event, don't re-show it until it changes
  if (typeof window !== 'undefined' && window.__intelDismissedKey && window.__intelDismissedKey === eventKey) {
    return;
  }

  if (isNew) {
    if (_fadeTimerId) {
      clearTimeout(_fadeTimerId);
      _fadeTimerId = null;
    }
    _shownEventKey = eventKey;
    intel.classList.remove("hidden");
    intel.style.opacity = '';
    // allow multi-line messages; truncate in CSS if needed
    intelText.textContent = `${ev.name}: ${ev.description}`;

    // reset and animate progress
    const progressEl = document.getElementById('intel-progress');
    if (progressEl) {
      progressEl.style.transition = 'none';
      progressEl.style.width = '100%';
      // force reflow then animate
      // eslint-disable-next-line no-unused-expressions
      progressEl.offsetWidth;
      requestAnimationFrame(() => {
        progressEl.style.transition = 'width 15s linear';
        progressEl.style.width = '0%';
      });
    }

    // attach dismiss handler once
    const dismissBtn = document.getElementById('intel-dismiss');
    if (dismissBtn && !dismissBtn._intelAttached) {
      dismissBtn._intelAttached = true;
      dismissBtn.addEventListener('click', () => {
        if (_fadeTimerId) { clearTimeout(_fadeTimerId); _fadeTimerId = null; }
        intel.classList.add('hidden');
        if (progressEl) { progressEl.style.transition = 'none'; progressEl.style.width = '100%'; }
        // remember this key was dismissed so it won't reappear while unchanged
        if (typeof window !== 'undefined') window.__intelDismissedKey = eventKey;
      });
    }

    _fadeTimerId = setTimeout(() => {
      _fadeTimerId = null;
      intel.style.transition = 'opacity 1.2s ease';
      intel.style.opacity = '0';
      setTimeout(() => {
        intel.classList.add('hidden');
        intel.style.opacity = '';
        intel.style.transition = '';
        if (progressEl) { progressEl.style.transition = 'none'; progressEl.style.width = '100%'; }
        if (typeof window !== 'undefined') window.__intelDismissedKey = eventKey;
      }, 1200);
    }, 15000);
  } else {
    // update message only
    intelText.textContent = `${ev.name}: ${ev.description}`;
  }
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

  const ringWrap = document.querySelector(".timer-ring");
  const ring = ringWrap && ringWrap.querySelector("circle");
  if (ring) {
    const remain = Math.max(0, Math.min(45, timer));
    const pct = 1 - remain / 45;
    ring.style.strokeDashoffset = `${50 * pct}`;
  }
  if (ringWrap) {
    ringWrap.classList.toggle("timer-warning", timer <= 10 && timer > 5);
    ringWrap.classList.toggle("timer-danger", timer <= 5);
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

  const handArea = document.createElement("div");
  handArea.id = "hand-area";
  handArea.className = "hand-area";
  container.appendChild(handArea);

  const stripsRow = document.createElement("div");
  stripsRow.className = "player-strips-row";

  const defaultPlayers = [
    { id: "player1", name: "Jade", codename: "Viper", cash: 50000, dist: 4, push: 2, accent: "#10b981" },
    { id: "enemy1", name: "Crimson", codename: "Red", cash: 36000, dist: 3, push: 3, accent: "#f87171" },
    { id: "enemy2", name: "Blue", codename: "Shade", cash: 34500, dist: 3, push: 2, accent: "#60a5fa" },
    { id: "enemy3", name: "Violet", codename: "Wraith", cash: 31700, dist: 3, push: 2, accent: "#a78bfa" },
  ];

  const rawPlayers = gameState.players && gameState.players.length > 0 ? gameState.players : [];
  const districtCount = (pid) => (gameState.districts || []).filter((d) => d.owner === pid).length;

  for (let i = 0; i < 4; i += 1) {
    const def = defaultPlayers[i];
    const raw = rawPlayers[i] || {};
    const p = {
      ...def,
      ...raw,
      dist: raw.dist ?? districtCount(raw.id || def.id),
      push: raw.push ?? raw.pushers ?? def.push,
      cash: raw.cash ?? def.cash,
    };
    const strip = document.createElement("div");
    strip.className = "player-strip" + (i === 0 ? " local" : "");

    const dot = document.createElement("div");
    dot.className = "player-dot";
    dot.style.background = p.accent;
    dot.style.boxShadow = `0 0 8px ${p.accent}99`;

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
    stripsRow.appendChild(strip);
  }
  container.appendChild(stripsRow);
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
}

// expose helper so other code can update the bar if needed
let _phaseFlashInitialized = false;

export function renderGameStatus(phaseChanged = false) {
  renderTopBar(gameState.phase, gameState.timer, gameState.roundNumber);
  if (phaseChanged) {
    renderBottomBar();
  }
  // renderEventTile is called separately by main.js, do not call it here
}

/** Call when phase has just changed (e.detail.phaseChanged) to play the phase pill flash. Skips on first load. */
export function triggerPhaseChangeFlash() {
  if (!_phaseFlashInitialized) {
    _phaseFlashInitialized = true;
    return;
  }
  const pill = document.getElementById("phase-pill");
  if (!pill) return;
  pill.classList.add("phase-change-flash");
  setTimeout(() => pill.classList.remove("phase-change-flash"), 500);
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
  const host = document.getElementById("action-panel-host");
  if (!host) return;

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
  const prev = host.querySelector(".action-panel");
  if (prev) prev.remove();
  host.appendChild(panel);
}

export function clearActionPanel() {
  const host = document.getElementById("action-panel-host");
  if (!host) return;
  const prev = host.querySelector(".action-panel");
  if (prev) prev.remove();
}
