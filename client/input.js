// client/input.js
// Handles user interactions and delegates DOM rendering to ui.js and board.js

import { showActionPanel, renderSidebar } from './ui.js';
import { buyBuilding, dealProduct, deleteBuilding, buyPusher } from '../game/economy.js';
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
      // Buying phase: show buy building buttons
      if(gameState.phase === 'Buying'){
        const player = gameState.players[0];
        const types = ['lab','growhouse','refinery'];
        const buyButtons = types.map(type => {
          const idx = Math.min((player.buildingsBoughtThisRound && player.buildingsBoughtThisRound[type]) || 0, 2);
          const cost = Math.round([100,180,300][idx] / 5) * 5;
          const disabled = d.buildings && d.buildings.length >= 5;
          // also disable if player reached per-round limit for this type
          const reachedLimit = (player.buildingsBoughtThisRound && (player.buildingsBoughtThisRound[type] || 0) >= 3);
          return {
            label: `Buy ${type.charAt(0).toUpperCase()+type.slice(1)} (costs $${cost})`,
            disabled: disabled || reachedLimit,
            onClick: () => {
              const res = buyBuilding(id, type);
              if(res && res.success){
                updateDistrict(id, res.district);
                renderSidebar();
              } else {
                console.warn('buyBuilding failed', res && res.message);
              }
            }
          };
        });

        // Buy pusher button (cost $50)
        buyButtons.push({
          label: `Buy Pusher (cost $50)`,
          disabled: false,
          onClick: () => {
            const res = buyPusher();
            if(res && res.success){
              renderSidebar();
            } else {
              console.warn('buyPusher failed', res && res.message);
            }
          }
        });

        // build the building inspection list (each with a delete × button)
        const buildingList = (d.buildings || []).map((b, idx) => {
          const emoji = b.type === 'lab' ? '🧪' : (b.type === 'growhouse' ? '🌿' : '⚗️');
          return {
            label: `${emoji} ${b.type.charAt(0).toUpperCase()+b.type.slice(1)}`,
            onDelete: () => {
              const res = deleteBuilding(id, idx);
              if(res && res.success){
                updateDistrict(id, res.district);
                renderSidebar();
              } else {
                console.warn('deleteBuilding failed', res && res.message);
              }
            }
          };
        });

        showActionPanel(id, { buyButtons, buildingList });
        return;
      }

      // Dealing phase: show product type buttons if player has that product anywhere and district not raided
      if(gameState.phase === 'Dealing' && !d.raided){
        const player = gameState.players[0];
        if(!player) return;
        // show the clicked district's dealingPrices and show Sell buttons that draw from player.inventory
        const prices = d.dealingPrices || d.prices || {};
        const dealButtons = ['coke','weed','heroin'].map(pt => {
          const count = player.inventory && (player.inventory[pt] || 0) || 0;
          const price = Math.round(((prices[pt] || 0) ) / 5) * 5;
          const disabled = !(count > 0);
          return {
            label: `Sell ${pt} (${count}) - $${price}`,
            disabled,
            onClick: () => {
              const res = dealProduct(id, pt);
              if(res && res.success){
                // update district visuals
                const tgt = gameState.districts.find(x => x.id === id);
                if(tgt) updateDistrict(tgt.id, tgt);
                renderSidebar();
              } else {
                console.warn('dealProduct failed', res && res.message);
              }
            }
          };
        });

        showActionPanel(id, { dealButtons });
        return;
      }
    }
  });
}
