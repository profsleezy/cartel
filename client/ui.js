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

  const player = gameState.players && gameState.players[0] ? gameState.players[0] : { cash: 0 };
  // calculate total product across player's owned districts
  const totalProduct = gameState.districts.reduce((sum, d) => sum + ((d.owner === 'owned' && d.product) ? d.product : 0), 0);

  const items = [
    ['Cash', `$${player.cash}`],
    ['Heat', `${player.heat || 0}`],
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
  sidebar.appendChild(tip);
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
export function showActionPanel(districtId, { onBuyLab } = {}){
  const sidebar = document.getElementById('sidebar');
  if(!sidebar) return;

  // small panel area
  const panel = document.createElement('div');
  panel.className = 'action-panel';
  panel.innerHTML = `
    <h3>Actions</h3>
    <div id="action-district">${districtId}</div>
  `;

  const buyBtn = document.createElement('button');
  buyBtn.textContent = 'Buy Lab';
  buyBtn.addEventListener('click', () => {
    if(typeof onBuyLab === 'function') onBuyLab();
  });

  panel.appendChild(buyBtn);

  // replace or append panel
  // remove previous action-panel if any
  const prev = sidebar.querySelector('.action-panel');
  if(prev) prev.remove();
  sidebar.appendChild(panel);
}


