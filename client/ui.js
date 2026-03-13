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

  // We no longer show a separate market block here; prices are shown on Sell buttons in the action panel.
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
export function showActionPanel(districtId, { buyButtons, dealButtons, buildingList } = {}){
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

  // replace or append panel
  // remove previous action-panel if any
  const prev = sidebar.querySelector('.action-panel');
  if(prev) prev.remove();
  sidebar.appendChild(panel);
}


