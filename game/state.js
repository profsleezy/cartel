// game/state.js
// Single source of truth for game state. Nothing else should create its own copy.

export const gameState = {
  phase: 'Buying',
  timer: 45,
  roundNumber: 1,
  players: [
    { id: 'player1', cash: 500, dealers: 3, inventory: { coke: 0, weed: 0, heroin: 0 }, pushers: 1, soldThisRound: 0 }
  ],
  // districts will be populated by initGameState() from data/districts.json
  districts: []
};

// queued attacks between phases
export function ensureQueuedAttacks(){
  if(!gameState.queuedAttacks) gameState.queuedAttacks = [];
  return gameState.queuedAttacks;
}

/**
 * Initialize the gameState.districts from data/districts.json
 * This is async because we fetch the JSON file in the browser environment.
 */
export async function initGameState(){
  try{
  // index.html lives at the repo root when served, so fetch from absolute path
  const res = await fetch('/data/districts.json');
    if(!res.ok) throw new Error('Failed to load districts.json');
    const data = await res.json();

    // map to internal district shape and set sensible defaults
    gameState.districts = data.map(d => ({
      id: d.id,
      name: d.name,
      prices: d.prices || {},
      adjacency: d.adjacency || [],
      owner: 'neutral',
      // buildings array (max 5). entries: { type: 'lab'|'growhouse'|'refinery' }
      buildings: [],
      thugs: 0,
      heat: 0
    }));

    // for a tiny hand-tuned starting state, mark some as owned/enemy
    const assign = { d1: 'owned', d3: 'owned', d6: 'owned', d4: 'enemy', d8: 'enemy' };
    gameState.districts.forEach(ds => { if(assign[ds.id]) ds.owner = assign[ds.id]; });

    // give each player-owned district a starting thug
    gameState.districts.forEach(ds => {
      if(ds.owner === 'owned') ds.thugs = 1;
    });

    // initialize per-player purchase counters and thug counters
    gameState.players.forEach(p => {
      p.buildingsBoughtThisRound = { lab: 0, growhouse: 0, refinery: 0 };
      // ensure pusher and sold counters exist
      if(typeof p.pushers !== 'number') p.pushers = 1;
      if(typeof p.soldThisRound !== 'number') p.soldThisRound = 0;
      // thugs hired counter per round
      if(typeof p.thugsHiredThisRound !== 'number') p.thugsHiredThisRound = 0;
      // attack flag per round
      if(typeof p.hasAttackedThisRound !== 'boolean') p.hasAttackedThisRound = false;
      // queued attacks array
      if(!gameState.queuedAttacks) gameState.queuedAttacks = [];
    });

    return gameState;
  }catch(err){
    console.error('initGameState error', err);
    throw err;
  }
}

/**
 * Remove players who own zero districts. Returns array of removed player ids.
 */
export function checkElimination(){
  const removed = [];
  // simple rule: if there are no districts owned by the human player, remove them
  const ownedCount = gameState.districts.filter(d => d.owner === 'owned').length;
  if(ownedCount === 0 && gameState.players.length > 0){
    const rem = gameState.players.splice(0,1);
    if(rem && rem.length) removed.push(rem[0].id);
  }
  return removed;
}
