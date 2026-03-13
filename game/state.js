// game/state.js
// Single source of truth for game state. Nothing else should create its own copy.

export const gameState = {
  phase: 'Buying',
  timer: 45,
  roundNumber: 1,
  players: [
    { id: 'player1', cash: 500, dealers: 3 }
  ],
  districts: [
    { id: 'd1', name: 'Little Havana', owner: 'owned', product: 2, labs: 1, thugs: 3, heat: 2 },
    { id: 'd2', name: 'South Beach', owner: 'neutral', product: 1, labs: 0, thugs: 1, heat: 1 },
    { id: 'd3', name: 'Downtown', owner: 'owned', product: 3, labs: 2, thugs: 4, heat: 3 },
    { id: 'd4', name: 'Wynwood', owner: 'enemy', product: 1, labs: 0, thugs: 2, heat: 4 },
    { id: 'd5', name: 'Coconut Grove', owner: 'neutral', product: 0, labs: 0, thugs: 0, heat: 0 },
    { id: 'd6', name: 'Little River', owner: 'owned', product: 2, labs: 1, thugs: 2, heat: 1 },
    { id: 'd7', name: 'Midtown', owner: 'neutral', product: 1, labs: 0, thugs: 1, heat: 2 },
    { id: 'd8', name: 'Harbor', owner: 'enemy', product: 0, labs: 0, thugs: 3, heat: 5 }
  ]
};
