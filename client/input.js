// client/input.js
// Handles user interactions and delegates DOM rendering to ui.js and board.js

import {
  showActionPanel,
  renderSidebar,
  clearActionPanel,
  openDistrictPanel,
  closeDistrictPanel,
  getSelectedDistrictId,
} from "./ui.js";
import { playCard, playCardOnDistrict, getCardById } from "../game/cards.js";
import {
  buyBuilding,
  dealProduct,
  deleteBuilding,
  buyPusher,
  hireThugs,
} from "../game/economy.js";
import { updateDistrict, highlightTargets, flashDistrict } from "./board.js";
import { gameState, getPlayer } from "../game/state.js";
import { getValidAttackTargets } from "../game/combat.js";

const PRODUCT_META = [
  { type: "coke", emoji: "🧪" },
  { type: "weed", emoji: "🌿" },
  { type: "heroin", emoji: "⚗️" },
];

function setPanelSelection(districtId) {
  const board = document.getElementById("board");
  if (!board) return;
  board.querySelectorAll(".district").forEach((tile) => {
    tile.classList.remove("selected");
    if (tile.dataset.id === districtId) {
      tile.classList.add("selected", "select-pulse");
      setTimeout(() => tile.classList.remove("select-pulse"), 400);
    }
  });
}

/**
 * Build and display the dealing panel for a source district.
 * Called on first click and re-called after each successful sale to refresh state.
 */
export function showDealPanel(sourceId) {
  const src = gameState.districts.find((x) => x.id === sourceId);
  if (!src) return;

  const stash = src.stash || { coke: 0, weed: 0, heroin: 0 };
  const totalStash =
    (stash.coke || 0) + (stash.weed || 0) + (stash.heroin || 0);
  // If stash was wiped (e.g. by a raid) since the panel was opened, close it
  if (totalStash <= 0) return;

  const player = getPlayer("player1");
  if (!player) return;

  const capacityMultiplier =
    (gameState.eventModifiers && gameState.eventModifiers.pusherCapacityMultiplier) ||
    1;
  const maxSells = (player.pushers || 0) * 2 * capacityMultiplier;
  const soldThisRound = player.soldThisRound || 0;
  const capacityExhausted = soldThisRound >= maxSells;

  // Build one section per product type that has stash > 0
  const sections = PRODUCT_META.filter((p) => (stash[p.type] || 0) > 0).map(
    (p) => {
      const stashAmt = stash[p.type] || 0;

      // All owned, non-raided districts sorted by dealingPrice descending
      const targets = gameState.districts
        .filter((d) => d.owner === "player1" && !d.raided)
        .map((d) => {
          const rawPrice =
            d.dealingPrices && d.dealingPrices[p.type]
              ? d.dealingPrices[p.type]
              : d.prices && d.prices[p.type]
                ? d.prices[p.type]
                : 100;
          return {
            id: d.id,
            name: d.name,
            price: Math.round(rawPrice / 5) * 5,
            maxQty: stashAmt,
            disabled: capacityExhausted,
            onSell: (qty) => {
                const res = dealProduct(sourceId, d.id, p.type, qty);
                if (res && res.success) {
                  flashDistrict(d.id);
                  // Update both source and target tiles immediately
                  if (res.targetDistrict) updateDistrict(d.id, res.targetDistrict);
                  if (res.sourceDistrict) updateDistrict(sourceId, res.sourceDistrict);
                  renderSidebar();
                  // Re-render updated panel after the sale so stash and counters refresh
                  showDealPanel(sourceId);
                } else {
                  console.warn("dealProduct failed", res && res.message);
                }
            },
          };
        })
        .sort((a, b) => b.price - a.price);

      return {
        productType: p.type,
        emoji: p.emoji,
        stashAmt,
        targets,
      };
    },
  );

  openDistrictPanel(sourceId, src, {
    dealingControls: {
      sourceName: src.name,
      stash: {
        coke: stash.coke || 0,
        weed: stash.weed || 0,
        heroin: stash.heroin || 0,
      },
      sections,
    },
  });

  // Track current open dealing source and stash snapshot so we can refresh
  _currentDealSource = sourceId;
  _lastDealSnapshot = JSON.stringify({ stash: src.stash || {}, raided: !!src.raided });
}

let _currentDealSource = null;
let _lastDealSnapshot = null;
let _dealListenerAttached = false;

function _onGameStateChangedForDeal() {
  try {
    if (!_currentDealSource) return;
    const openId = getSelectedDistrictId();
    if (openId !== _currentDealSource) {
      // user navigated away — stop listening
      _currentDealSource = null;
      _lastDealSnapshot = null;
      return;
    }
    const d = gameState.districts.find((x) => x.id === _currentDealSource);
    if (!d) return;
    const snap = JSON.stringify({ stash: d.stash || {}, raided: !!d.raided });
    if (snap !== _lastDealSnapshot) {
      _lastDealSnapshot = snap;
      const totalStash = (d.stash && ((d.stash.coke || 0) + (d.stash.weed || 0) + (d.stash.heroin || 0))) || 0;
      if (d.raided) {
        // If raided, reopen generic panel with a status message so user sees raid
        openDistrictPanel(d.id, d, { statusMessage: 'This district was just raided' });
        _currentDealSource = null;
        _lastDealSnapshot = null;
        return;
      }
      if (totalStash <= 0) {
        // stash emptied — close dealing UI to prevent spamming
        openDistrictPanel(d.id, d, {});
        _currentDealSource = null;
        _lastDealSnapshot = null;
        return;
      }
      // otherwise rebuild the dealing panel so counts/prices update
      showDealPanel(_currentDealSource);
    }
  } catch (err) {
    // defensive
  }
}

// attach global listener once
if (typeof window !== 'undefined' && !_dealListenerAttached) {
  window.addEventListener('gameStateChanged', _onGameStateChangedForDeal);
  _dealListenerAttached = true;
}
export function openBuyingPanel(districtId) {
  const d = gameState.districts.find((x) => x.id === districtId);
  if (!d || d.owner !== "player1") return;
  const player = getPlayer("player1");
  if (!player) return;

  const types = ["lab", "growhouse", "refinery"];
  const buyButtons = types.map((type) => {
    const idx = Math.min((player.buildingsBoughtThisRound && player.buildingsBoughtThisRound[type]) || 0, 2);
    const cost = Math.round([100, 180, 300][idx] / 5) * 5;
    const disabled = d.buildings && d.buildings.length >= 5;
    const reachedLimit = player.buildingsBoughtThisRound && (player.buildingsBoughtThisRound[type] || 0) >= 3;
    return {
      label: `Buy ${type.charAt(0).toUpperCase() + type.slice(1)} (costs $${cost})`,
      disabled: disabled || reachedLimit,
      onClick: () => {
        const res = buyBuilding(districtId, type);
        if (res && res.success) {
          updateDistrict(districtId, res.district);
          renderSidebar();
          openBuyingPanel(districtId);
        }
      },
    };
  });

  buyButtons.push({
    label: "Buy Pusher (cost $150)",
    disabled: false,
    onClick: () => {
      const res = buyPusher();
      if (res && res.success) {
        renderSidebar();
        openBuyingPanel(districtId);
      }
    },
  });

  const thugIdx = Math.min(player.thugsHiredThisRound || 0, 2);
  const thugCost = Math.round([100, 180, 300][thugIdx] / 5) * 5;
  buyButtons.push({
    label: `Hire Thug (cost $${thugCost})`,
    disabled: false,
    onClick: () => {
      const res = hireThugs(districtId, 1);
      if (res && res.success) {
        updateDistrict(districtId, res.district);
        renderSidebar();
        openBuyingPanel(districtId);
      }
    },
  });

  const buildingList = (d.buildings || []).map((b, idx) => {
    const emoji = b.type === "lab" ? "🧪" : b.type === "growhouse" ? "🌿" : "⚗️";
    return {
      label: `${emoji} ${b.type.charAt(0).toUpperCase() + b.type.slice(1)}`,
      onDelete: () => {
        const res = deleteBuilding(districtId, idx);
        if (res && res.success) {
          updateDistrict(districtId, res.district);
          renderSidebar();
          openBuyingPanel(districtId);
        }
      },
    };
  });

  setPanelSelection(districtId);
  openDistrictPanel(districtId, d, { buyButtons, buildingList });
}

export function initInput() {
  const board = document.getElementById("board");
  if (!board) return;

  // Attack selection state
  let selectedSourceId = null;
  let selectedCount = 1;
  let selectedTargetId = null;

  // Card-targeting state for 'targeted' cards
  let pendingCardId = null;

  function clearCardTargeting() {
    pendingCardId = null;
    highlightTargets([]);
    clearActionPanel();
  }

  function setCardTargeting(cardId, message) {
    pendingCardId = cardId;
    const owned = gameState.districts
      .filter((x) => x.owner === "player1")
      .map((x) => x.id);
    highlightTargets(owned);
    showActionPanel(owned[0] || null, {
      buyButtons: [{ label: message, disabled: true }],
    });
  }

  

  board.addEventListener("click", (ev) => {
    const el = ev.target.closest("[data-id]");
    if (!el) return;
    const id = el.dataset.id;
    const d = gameState.districts.find((x) => x.id === id);
    if (!d) return;

    // Re-click same district while panel open → close panel
    if (getSelectedDistrictId() === id) {
      closeDistrictPanel();
      return;
    }

    // If we're in pending card-target mode, apply card to clicked owned district
    if (pendingCardId && d.owner === "player1") {
      const res = playCardOnDistrict(pendingCardId, id);
      if (res && res.success) {
        pendingCardId = null;
        highlightTargets([]);
        updateDistrict(id, d);
        renderSidebar();
        setPanelSelection(id);
        openDistrictPanel(id, d, { statusMessage: "Card applied" });
      } else {
        clearCardTargeting();
      }
      return;
    }

    // ── ATTACKING phase ──────────────────────────────────────────────────────
    if (gameState.phase === "Attacking") {
      // ── Click on an owned district → select it as the attack source ────────
      if (d.owner === "player1") {
        const player = getPlayer("player1");

        if (player && player.hasAttackedThisRound) {
          // Blitz card grants a second attack — consume the flag and allow it
          const extraAttack =
            gameState.eventModifiers && gameState.eventModifiers.extraAttack;
          if (extraAttack) {
            gameState.eventModifiers.extraAttack = false;
            player.hasAttackedThisRound = false;
          } else {
            selectedSourceId = null;
            selectedTargetId = null;
            highlightTargets([]);
            setPanelSelection(id);
              openDistrictPanel(id, d, { statusMessage: "Attack already used this round" });
            return;
          }
        }

        selectedSourceId = id;
        selectedTargetId = null;

        if ((d.thugs || 0) <= 0) {
          selectedSourceId = null;
          highlightTargets([]);
          setPanelSelection(id);
            openDistrictPanel(id, d, { statusMessage: "No thugs in this district" });
          return;
        }

        const valid = getValidAttackTargets(id);
        // Highlight valid targets in red; no selected target yet
        highlightTargets(valid);
        selectedCount = Math.min(Math.max(1, selectedCount || 1), d.thugs || 1);

        setPanelSelection(id);
        openDistrictPanel(id, d, {
          attackControls: {
            selectedCount,
            max: d.thugs || 1,
            targetId: selectedTargetId,
            confirmDisabled: true,
            onCountChange: (v) => {
              selectedCount = v;
            },
            onConfirm: () => {
              // Guard: should never fire with confirmDisabled=true, but be safe
              if (!selectedSourceId || !selectedTargetId) return;
              _queueAttack(selectedSourceId, selectedTargetId, selectedCount);
              selectedSourceId = null;
              selectedTargetId = null;
              selectedCount = 1;
            },
          },
        });
        return;
      }

      // ── Click on a non-owned district while a source is selected → pick target
      const selectedSource = selectedSourceId
        ? gameState.districts.find((x) => x.id === selectedSourceId)
        : null;

      if (selectedSource && d.owner !== "player1") {
        const valid = getValidAttackTargets(selectedSourceId);
        if (valid.includes(id)) {
          selectedTargetId = id;

          // Redraw highlights: valid targets in red, selected target in gold
          highlightTargets(valid, selectedTargetId);

          const src = gameState.districts.find((x) => x.id === selectedSourceId);
          if (src)
            openDistrictPanel(selectedSourceId, src, {
              attackControls: {
                selectedCount,
                max: selectedSource.thugs || 1,
                targetId: selectedTargetId,
                confirmDisabled: false,
                onCountChange: (v) => {
                  selectedCount = v;
                },
                onConfirm: () => {
                  if (!selectedSourceId || !selectedTargetId) return;
                  _queueAttack(selectedSourceId, selectedTargetId, selectedCount);
                  selectedSourceId = null;
                  selectedTargetId = null;
                  selectedCount = 1;
                },
              },
            });
        }
      }
      return;
    }

    // ── BUYING phase ─────────────────────────────────────────────────────────
    if (gameState.phase === "Buying" && d.owner === "player1") {
      openBuyingPanel(id);
      return;
    }

    // ── DEALING phase ─────────────────────────────────────────────────────────
    if (gameState.phase === "Dealing") {
      const stash = d.stash || {};
      const totalStash =
        (stash.coke || 0) + (stash.weed || 0) + (stash.heroin || 0);
      if (totalStash > 0) {
        setPanelSelection(id);
        showDealPanel(id);
        return;
      }
    }

    // ── Any other district click: open panel with read-only details ───────────
    setPanelSelection(id);
    openDistrictPanel(id, d, {});
  });

  // ── Card clicks (hand in bottom bar) ─────────────────────────────────────
  const bottomBar = document.getElementById("bottom-bar");
  if (bottomBar) {
    bottomBar.addEventListener("click", (ev) => {
      const cardEl = ev.target.closest("[data-card-id]");
      if (!cardEl) return;
      const cardId = cardEl.dataset.cardId;
      if (!cardId) return;

      const card = getCardById(cardId);
      if (card && card.targeted) {
        const res = playCard(cardId);
        // playCard for targeted cards returns requiresTarget with card since we need a district first
        if (res && res.requiresTarget) {
          pendingCardId = cardId;
          const ownedTargets = gameState.districts
            .filter((x) => x.owner === "player1")
            .map((x) => x.id);
          highlightTargets(ownedTargets);
          showActionPanel(ownedTargets[0] || null, {
            buyButtons: [
              {
                label: `Select owned district to apply ${card.name}`,
                disabled: true,
              },
            ],
          });
        }
        return;
      }

      const res = playCard(cardId);
      if (res && res.success) {
        // Re-render sidebar (hand state changes) and refresh all district tiles
        // so any immediate effects (heat, thugs, etc.) appear on the board.
        renderSidebar();
        gameState.districts.forEach((d) => updateDistrict(d.id, d));
      } else {
        console.warn("[input] playCard failed:", res && res.message);
      }
    });
  }

  /**
   * Queue an attack, mark the target district as pending-attack so the board
   * tile gets a persistent purple glow until the attack resolves next Buying phase.
   */
  function _queueAttack(fromId, toId, thugsCount) {
    if (!gameState.queuedAttacks) gameState.queuedAttacks = [];
    gameState.queuedAttacks.push({ fromId, toId, thugsCount });

    const p = getPlayer("player1");
    if (p) p.hasAttackedThisRound = true;

    // Mark the target district — board.js/updateDistrict will keep the glow
    // visible across re-renders until phases.js clears it when the attack resolves.
    const tgt = gameState.districts.find((x) => x.id === toId);
    if (tgt) {
      tgt.pendingAttack = true;
      updateDistrict(toId, tgt);
    }

    // Clear all selection highlights and the action panel
    highlightTargets([]);
    clearActionPanel();
    renderSidebar();
    // If the side panel is still open for the source district, refresh it to remove attack UI
    try {
      const openId = getSelectedDistrictId();
      if (openId === fromId) {
        const d = gameState.districts.find((x) => x.id === fromId);
        if (d) openDistrictPanel(fromId, d, { statusMessage: 'Attack already used this round' });
      }
    } catch (err) {
      // defensive
    }
  }
}
