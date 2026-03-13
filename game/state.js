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

    // initialize per-player building purchase counters
    gameState.players.forEach(p => {
      p.buildingsBoughtThisRound = { lab: 0, growhouse: 0, refinery: 0 };
      // ensure pusher and sold counters exist
      if(typeof p.pushers !== 'number') p.pushers = 1;
      if(typeof p.soldThisRound !== 'number') p.soldThisRound = 0;
    });

    return gameState;
  }catch(err){
    console.error('initGameState error', err);
    throw err;
  }
}
