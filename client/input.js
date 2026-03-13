// client/input.js
// Handles user interactions and delegates DOM rendering to ui.js and board.js

import { showActionPanel, renderSidebar } from './ui.js';
import { buyLab } from '../game/economy.js';
import { updateDistrict } from './board.js';
import { gameState } from '../game/state.js';

export function initInput(){
  const board = document.getElementById('board');
  if(!board) return;

  board.addEventListener('click', (ev) => {
    const el = ev.target.closest('[data-id]');
    if(!el) return;
    const id = el.dataset.id;
    const d = gameState.districts.find(x => x.id === id);
    if(!d) return;

    // only show actions for owned districts
    if(d.owner === 'owned'){
      showActionPanel(id, {
        onBuyLab: () => {
          const res = buyLab(id);
          if(res && res.success){
            // reflect changes visually
            updateDistrict(id, res.district);
            renderSidebar();
          } else {
            // could show an error via UI; for now log
            console.warn('buyLab failed', res && res.message);
          }
        }
      });
    }
  });
}
