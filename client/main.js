// client/main.js
import { renderSidebar, renderPhaseBanner, renderTimer } from './ui.js';
import { renderBoard } from './board.js';

document.addEventListener('DOMContentLoaded', () => {
  renderSidebar();
  renderPhaseBanner('Buying');
  renderTimer(45);

  const districts = [
    { id: 'd1', name: 'Little Havana', owner: 'owned' },
    { id: 'd2', name: 'South Beach', owner: 'neutral' },
    { id: 'd3', name: 'Downtown', owner: 'owned' },
    { id: 'd4', name: 'Wynwood', owner: 'enemy' },
    { id: 'd5', name: 'Coconut Grove', owner: 'neutral' },
    { id: 'd6', name: 'Little River', owner: 'owned' },
    { id: 'd7', name: 'Midtown', owner: 'neutral' },
    { id: 'd8', name: 'Harbor', owner: 'enemy' }
  ];

  renderBoard(districts);
});
