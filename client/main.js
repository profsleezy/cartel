// client/main.js
import {
  renderSidebar,
  renderGameStatus,
  renderEventTile,
  clearActionPanel,
  showGameOver,
  initPanelCloseHandlers,
  triggerPhaseChangeFlash,
  getSelectedDistrictId,
  openDistrictPanel,
} from "./ui.js";
import { renderBoard, updateDistrict, highlightTargets } from "./board.js";
import { gameState, initGameState, getPlayer } from "../game/state.js";
import { startPhaseTimer } from "../game/phases.js";
import { initEvents } from "../game/events.js";
import { initCards, dealStartingHand } from "../game/cards.js";
import { initInput, openBuyingPanel, showDealPanel } from "./input.js";

// Re-render UI whenever game state changes.
// phaseChanged = true  → full re-render (phase transition or initial load)
// phaseChanged = false → timer tick; only the countdown needs updating
window.addEventListener("gameStateChanged", (e) => {
  renderGameStatus(e.detail.phaseChanged);
  renderEventTile();
  
  // If phase changed OR data was updated (e.g. by AI), refresh the board and sidebar
  if (e.detail.phaseChanged || e.detail.dataUpdated) {
    if (e.detail.phaseChanged) {
      triggerPhaseChangeFlash();
      clearActionPanel();
      highlightTargets([]);
    }
    
    renderSidebar();
    gameState.districts.forEach((d) => updateDistrict(d.id, d));
    
    // If the side panel was open, refresh its contents
    try {
      const openId = getSelectedDistrictId();
      if (openId) {
        const d = gameState.districts.find((x) => x.id === openId);
        if (d) {
          if (gameState.phase === 'Buying' && d.owner === 'player1') {
            openBuyingPanel(openId);
          } else if (gameState.phase === 'Dealing' && d.owner === 'player1') {
            const stash = d.stash || {};
            const totalStash = (stash.coke || 0) + (stash.weed || 0) + (stash.heroin || 0);
            if (totalStash > 0) showDealPanel(openId);
            else openDistrictPanel(openId, d, {});
          } else if (gameState.phase === 'Attacking' && d.owner === 'player1') {
            const player = getPlayer('player1');
            if (player && player.hasAttackedThisRound) {
              openDistrictPanel(openId, d, { statusMessage: 'Attack already used this round' });
            } else {
              openDistrictPanel(openId, d, {});
            }
          } else {
            openDistrictPanel(openId, d, {});
          }
        }
      }
    } catch (err) {
      // ignore; defensive
    }
  }
});

// Show game-over overlay when phases.js detects elimination.
window.addEventListener("gameOver", (e) => {
  showGameOver(e.detail.humanExists);
});

document.addEventListener("DOMContentLoaded", async () => {
  // Load all data files in parallel before touching the DOM
  await Promise.all([initGameState(), initEvents(), initCards()]);

  // Deal the player's starting hand (needs card pool loaded first)
  // Deal starting hands for all players so each has equal cards
  (gameState.players || []).forEach((p) => {
    try { dealStartingHand(2, p.id); } catch (err) {}
  });

  // Initial render before the phase timer starts
  renderGameStatus(true);
  renderSidebar();
  renderBoard(gameState.districts);

  // Start the phase timer (fires gameStateChanged on every tick / phase change)
  startPhaseTimer();

  // Let bot players take their initial Buying decisions immediately
  try {
    const AI = await import('../game/ai.js');
    (gameState.players || []).forEach((p) => {
      if (p.isBot) {
        const delay = Math.floor(300 + Math.random() * 1200);
        setTimeout(() => AI.onBuyingPhase(p.id), delay);
      }
    });
    // trigger an immediate UI refresh so purchases/changes show up
    window.dispatchEvent(new CustomEvent('gameStateChanged', { detail: { phase: gameState.phase, phaseChanged: true } }));
  } catch (err) {
    // ignore if dynamic import fails
  }

  // Wire board and sidebar click handlers
  initInput();
  initPanelCloseHandlers();
});
