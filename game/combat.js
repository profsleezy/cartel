// game/combat.js
// Resolve attacks between districts and provide helper to find valid targets

import { gameState } from './state.js';

/**
 * Resolve an attack. attackerDistrict and defenderDistrict are district objects.
 * attackerCount is number of attacking thugs committed.
 * Win chance = attackerCount / (attackerCount + defenderThugs) ± variance (10-15%).
 * Returns { attackerWon, attackerLosses, defenderLosses }
 */
export function resolveAttack(attackerDistrict, attackerCount, defenderDistrict){
  const defenderThugs = defenderDistrict.thugs || 0;
  // If defender has no thugs, attacker automatically wins with no losses
  if((defenderThugs || 0) === 0){
    return { attackerWon: true, attackerLosses: 0, defenderLosses: 0, attackerSurvivors: attackerCount };
  }
  const base = attackerCount / (attackerCount + Math.max(1, defenderThugs));
  // variance between -0.15 and +0.15
  const variance = (Math.random() * 0.3) - 0.15;
  const chance = Math.max(0, Math.min(1, base + variance));
  const roll = Math.random();
  const attackerWon = roll < chance;

  let attackerLosses = 0;
  let defenderLosses = 0;
  let attackerSurvivors = 0;

  if(attackerWon){
    // defender loses all thugs
    defenderLosses = defenderThugs;
    // attacker casualties depend on defender numbers
    if(defenderThugs === 0){
      attackerSurvivors = attackerCount; // all survive
      attackerLosses = 0;
    } else {
      // losses scale with defenderThugs and some randomness
      const lossEstimate = Math.round(defenderThugs * (0.4 + Math.random() * 0.6));
      attackerLosses = Math.min(attackerCount, lossEstimate);
      attackerSurvivors = Math.max(0, attackerCount - attackerLosses);
    }
  } else {
    // attacker loses all committed thugs
    attackerLosses = attackerCount;
    attackerSurvivors = 0;
    // defender may take light casualties
    defenderLosses = Math.round((defenderThugs || 0) * (Math.random() * 0.15));
  }

  return { attackerWon, attackerLosses, defenderLosses, attackerSurvivors };
}

/**
 * Return adjacent enemy district ids for a given district id.
 * Uses gameState.districts adjacency field.
 */
export function getValidAttackTargets(districtId){
  // Prefer computing adjacency from the rendered board layout (left/right/top/bottom neighbors).
  // This lets highlights always reflect the visual grid.
  const d = gameState.districts.find(x => x.id === districtId);
  if(!d) return [];
  if(typeof document === 'undefined'){
    // fallback to adjacency list in headless environments
    const adj = d.adjacency || [];
    const adjSet = new Set((adj || []).map(a => String(a)));
    const enemies = gameState.districts.filter(x => adjSet.has(String(x.id)) && x.owner !== 'owned');
    return enemies.map(e => e.id);
  }

  const board = document.getElementById('board');
  if(!board) return [];
  const elems = Array.from(board.querySelectorAll('[data-id]'));
  // collect positions
  const items = elems.map(el => ({ id: el.dataset.id, left: el.offsetLeft, top: el.offsetTop }));

  // helper to cluster nearly-equal positions into rows/cols
  function cluster(values){
    const sorted = Array.from(new Set(values)).sort((a,b)=>a-b);
    const groups = [];
    sorted.forEach(v => {
      const last = groups.length ? groups[groups.length-1] : null;
      if(last && Math.abs(v - last[0]) <= 8){
        // merge into group by averaging
        last.push(v);
      } else {
        groups.push([v]);
      }
    });
    // representative = average of group
    return groups.map(g => Math.round(g.reduce((s,x)=>s+x,0)/g.length));
  }

  const tops = cluster(items.map(i => i.top));
  const lefts = cluster(items.map(i => i.left));

  // map positions
  const posMap = new Map();
  items.forEach(it => {
    // find nearest top/left index
    const r = tops.findIndex(t => Math.abs(t - it.top) <= 10);
    const c = lefts.findIndex(l => Math.abs(l - it.left) <= 10);
    if(r >= 0 && c >= 0) posMap.set(`${r},${c}`, it.id);
  });

  // find source position
  let sourceKey = null;
  for(const [key, id] of posMap.entries()){
    if(id === districtId){ sourceKey = key; break; }
  }
  if(!sourceKey) return [];
  const [sr, sc] = sourceKey.split(',').map(Number);
  const neighborKeys = [`${sr-1},${sc}`, `${sr+1},${sc}`, `${sr},${sc-1}`, `${sr},${sc+1}`];
  const neighbors = neighborKeys.map(k => posMap.get(k)).filter(Boolean);
  // filter out owned districts
  const valid = neighbors.filter(id => {
    const x = gameState.districts.find(dd => dd.id === id);
    return x && x.owner !== 'owned';
  });
  return valid;
}
