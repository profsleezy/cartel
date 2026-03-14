// client/ui.js
// Renders the non-board UI: sidebar, phase banner, timer.

import { gameState } from '../game/state.js';

export function renderSidebar(){
  const sidebar = document.getElementById('sidebar');
  if(!sidebar) return;

  sidebar.innerHTML = '';

  const title = document.createElement('h2');
  title.textContent = 'Player';

  const list = document.createElement('ul');

  // calculate total product from the player's inventory (sum of all types)
  const player = gameState.players && gameState.players[0] ? gameState.players[0] : { cash: 0, inventory: { coke:0, weed:0, heroin:0 } };
  const inv = player.inventory || { coke:0, weed:0, heroin:0 };
  const totalProduct = (inv.coke || 0) + (inv.weed || 0) + (inv.heroin || 0);

  const roundedCash = Math.round((player.cash || 0) / 5) * 5;
  const items = [
    ['Cash', `$${roundedCash}`],
    ['Heat', `${player.heat || 0}`],
    ['Pushers', `${player.pushers || 0}`],
    ['Product', `${totalProduct}`]
  ];

  items.forEach(([label, value]) => {
    const li = document.createElement('li');
    const span = document.createElement('span');
    span.textContent = label;
    const strong = document.createElement('strong');
    strong.textContent = value;
    li.appendChild(span);
    li.appendChild(strong);
    list.appendChild(li);
  });

  const tip = document.createElement('div');
  tip.className = 'sidebar-tip';
  tip.textContent = 'Click an owned district to see actions.';

  sidebar.appendChild(title);
  sidebar.appendChild(list);

  // Show per-product counters under the Product item (🧪 coke, 🌿 weed, ⚗️ heroin)
  const prodBox = document.createElement('div');
  prodBox.className = 'product-breakdown';
  prodBox.style.marginTop = '8px';
  prodBox.style.fontSize = '14px';
  prodBox.innerHTML = `
    <div>🧪 ${inv.coke || 0}</div>
    <div>🌿 ${inv.weed || 0}</div>
    <div>⚗️ ${inv.heroin || 0}</div>
  `;
  sidebar.appendChild(prodBox);

  sidebar.appendChild(tip);

  // news is rendered in a separate floating panel (renderNewsPanel)
  renderNewsPanel();

  // We no longer show a separate market block here; prices are shown on Sell buttons in the action panel.
}

/** Render or update a floating news panel in the bottom-right of the screen. */
export function renderNewsPanel(){
  // floating news box (shows up to 5 items, auto-removes after 30s)
  let panel = document.getElementById('news-panel');
  if(!panel){
    panel = document.createElement('div');
    panel.id = 'news-panel';
    panel.style.position = 'fixed';
    panel.style.right = '12px';
    panel.style.bottom = '12px';
    panel.style.width = '320px';
    panel.style.background = 'var(--surface)';
    panel.style.color = 'var(--text)';
    panel.style.padding = '10px';
    panel.style.borderRadius = '8px';
    panel.style.boxShadow = '0 6px 18px rgba(0,0,0,0.4)';
    panel.style.zIndex = 2000;
    panel.style.fontSize = '13px';
    panel.style.maxHeight = '50vh';
    panel.style.overflow = 'hidden';
    document.body.appendChild(panel);
  }

  if(!gameState || !Array.isArray(gameState.news) || gameState.news.length === 0){
    panel.style.display = 'none';
    // stop interval if running
    if(window.__newsInterval){ clearInterval(window.__newsInterval); window.__newsInterval = null; }
    return;
  }

  // prune items older than 30s and ensure objects have timestamps
  const now = Date.now();
  gameState.news = gameState.news.filter(n => {
    const ts = n && n.ts ? n.ts : 0;
    return (now - ts) < 30000;
  });

  // keep only the last 5 items (most recent last)
  if(gameState.news.length > 5){
    gameState.news = gameState.news.slice(-5);
  }

  // render (newest first)
  panel.style.display = 'block';
  panel.innerHTML = `<div style="font-weight:600;margin-bottom:6px">News</div>`;
  const ul = document.createElement('ul');
  ul.style.listStyle = 'none'; ul.style.margin = '0'; ul.style.padding = '0'; ul.style.maxHeight = '38vh'; ul.style.overflowY = 'auto';
  const recent = Array.from(gameState.news).slice(-5).reverse();
  recent.forEach(item => {
    const li = document.createElement('li');
    li.style.marginBottom = '8px';
    li.style.paddingBottom = '6px';
    li.style.borderBottom = '1px solid rgba(255,255,255,0.03)';
    li.textContent = item && item.text ? item.text : String(item || '');
    ul.appendChild(li);
  });
  panel.appendChild(ul);

  // ensure an interval is clearing expired news every second while panel visible
  if(!window.__newsInterval){
    window.__newsInterval = setInterval(() => { renderNewsPanel(); }, 1000);
  }
}

/**
 * Show a transient toast message (stacks). durationMs defaults to 15000 (15s).
 */
// (toast system removed — use floating news panel instead)

/**
 * Show a simple full-screen game over overlay. `youWon` boolean.
 */
export function showGameOver(youWon){
  let overlay = document.getElementById('game-over-overlay');
  if(!overlay){
    overlay = document.createElement('div');
    overlay.id = 'game-over-overlay';
    overlay.style.position = 'fixed';
    overlay.style.left = '0';
    overlay.style.top = '0';
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.background = 'rgba(0,0,0,0.7)';
    overlay.style.zIndex = '9999';
    document.body.appendChild(overlay);
  }
  overlay.innerHTML = `<div style="background:var(--surface);padding:24px;border-radius:8px;color:var(--text);text-align:center;min-width:220px">
    <h2>${youWon ? 'You Win!' : 'You Lost'}</h2>
    <div style="margin-top:12px"><button id="game-over-close">Close</button></div>
  </div>`;
  const btn = document.getElementById('game-over-close');
  if(btn) btn.addEventListener('click', () => { overlay.remove(); });
}

export function renderPhaseBanner(phase){
  const el = document.getElementById('phase-banner');
  if(!el) return;
  el.textContent = `Phase: ${phase}`;
}

export function renderTimer(seconds){
  const el = document.getElementById('timer');
  if(!el) return;
  el.textContent = `${seconds}s`;
}

/**
 * Show an action panel for the given district. This function is responsible for DOM work
 * (input.js should not touch DOM directly). onBuyLab is a callback invoked when the user
 * clicks Buy Lab.
 */
export function showActionPanel(districtId, { buyButtons, dealButtons, buildingList, attackControls } = {}){
  const sidebar = document.getElementById('sidebar');
  if(!sidebar) return;

  // small panel area
  const panel = document.createElement('div');
  panel.className = 'action-panel';
  panel.innerHTML = `
    <h3>Actions</h3>
    <div id="action-district">${districtId}</div>
  `;

  // buyButtons: [{ label, onClick, disabled }]
  if(Array.isArray(buyButtons)){
    buyButtons.forEach(b => {
      const btn = document.createElement('button');
      btn.textContent = b.label;
      if(b.disabled) btn.disabled = true;
      btn.addEventListener('click', () => { if(typeof b.onClick === 'function') b.onClick(); });
      panel.appendChild(btn);
    });
  }

  // buildingList: [{ label, onDelete }]
  if(Array.isArray(buildingList)){
    const listWrap = document.createElement('div');
    listWrap.style.marginTop = '8px';
    buildingList.forEach((b, idx) => {
      const row = document.createElement('div');
      row.className = 'building-row';
      const span = document.createElement('span');
      span.textContent = b.label;
      span.style.marginRight = '8px';
      const del = document.createElement('button');
      del.textContent = '×';
      del.title = 'Remove building (refund $50)';
      del.addEventListener('click', () => { if(typeof b.onDelete === 'function') b.onDelete(); });
      row.appendChild(span);
      row.appendChild(del);
      listWrap.appendChild(row);
    });
    panel.appendChild(listWrap);
  }

  // dealButtons: [{ label, onClick, disabled }]
  if(Array.isArray(dealButtons)){
    dealButtons.forEach(b => {
      const btn = document.createElement('button');
      btn.textContent = b.label;
      if(b.disabled) btn.disabled = true;
      btn.addEventListener('click', () => { if(typeof b.onClick === 'function') b.onClick(); });
      panel.appendChild(btn);
    });
  }

  // attackControls: { selectedCount, max, onCountChange, confirmDisabled, onConfirm, targetId }
  if(attackControls && typeof attackControls === 'object'){
    const wrap = document.createElement('div');
    wrap.style.marginTop = '8px';
    wrap.innerHTML = `<div style="margin-bottom:6px">Attack</div>`;
    // count display
    const countLabel = document.createElement('div');
    countLabel.textContent = `Count: ${attackControls.selectedCount || 1}`;
    wrap.appendChild(countLabel);

    const range = document.createElement('input');
    range.type = 'range';
    range.min = 1;
    range.max = attackControls.max || 1;
    range.step = 1;
    range.value = attackControls.selectedCount || 1;
    range.addEventListener('input', (e) => {
      const v = parseInt(e.target.value, 10) || 1;
      countLabel.textContent = `Count: ${v}`;
      if(typeof attackControls.onCountChange === 'function') attackControls.onCountChange(v);
    });
    wrap.appendChild(range);

    const targetLabel = document.createElement('div');
    targetLabel.style.marginTop = '6px';
    targetLabel.textContent = `Target: ${attackControls.targetId || 'None'}`;
    wrap.appendChild(targetLabel);

    const confirm = document.createElement('button');
    confirm.textContent = 'Confirm Attack';
    if(attackControls.confirmDisabled) confirm.disabled = true;
    confirm.addEventListener('click', () => { if(typeof attackControls.onConfirm === 'function') attackControls.onConfirm(); });
    wrap.appendChild(confirm);

    panel.appendChild(wrap);
  }

  // replace or append panel
  // remove previous action-panel if any
  const prev = sidebar.querySelector('.action-panel');
  if(prev) prev.remove();
  sidebar.appendChild(panel);
}

export function clearActionPanel(){
  const sidebar = document.getElementById('sidebar');
  if(!sidebar) return;
  const prev = sidebar.querySelector('.action-panel');
  if(prev) prev.remove();
}


