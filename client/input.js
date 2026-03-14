// client/input.js
// Handles user interactions and delegates DOM rendering to ui.js and board.js

import { showActionPanel, renderSidebar, clearActionPanel } from "./ui.js";
import { playCard } from "../game/cards.js";
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

/**
 * Build and display the dealing panel for a source district.
 * Called on first click and re-called after each successful sale to refresh state.
 */
function showDealPanel(sourceId) {
  const src = gameState.districts.find((x) => x.id === sourceId);
  if (!src) return;

  const stash = src.stash || { coke: 0, weed: 0, heroin: 0 };
  const totalStash =
    (stash.coke || 0) + (stash.weed || 0) + (stash.heroin || 0);
  // If stash was wiped (e.g. by a raid) since the panel was opened, close it
  if (totalStash <= 0) return;

  const player = getPlayer("player1");
  if (!player) return;

  const maxSells = (player.pushers || 0) * 2;
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
                // Update the target tile's risk bar immediately — heat was just added
                updateDistrict(d.id, res.targetDistrict);
                renderSidebar();
                // Re-render updated panel after the sale
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

  showActionPanel(sourceId, {
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
}

export function initInput() {
  const board = document.getElementById("board");
  if (!board) return;

  // Attack selection state
  let selectedSourceId = null;
  let selectedCount = 1;
  let selectedTargetId = null;

  board.addEventListener("click", (ev) => {
    const el = ev.target.closest("[data-id]");
    if (!el) return;
    const id = el.dataset.id;
    const d = gameState.districts.find((x) => x.id === id);
    if (!d) return;

    // ── ATTACKING phase ──────────────────────────────────────────────────────
    if (gameState.phase === "Attacking") {
      // ── Click on an owned district → select it as the attack source ────────
      if (d.owner === "player1") {
        selectedSourceId = id;
        selectedTargetId = null;
        const player = getPlayer("player1");

        if (player && player.hasAttackedThisRound) {
          // Blitz card grants a second attack — consume the flag and allow it
          const extraAttack =
            gameState.eventModifiers && gameState.eventModifiers.extraAttack;
          if (extraAttack) {
            gameState.eventModifiers.extraAttack = false;
            player.hasAttackedThisRound = false;
          } else {
            highlightTargets([]);
            showActionPanel(id, {
              buyButtons: [{ label: "Attack used this round", disabled: true }],
            });
            return;
          }
        }
        if ((d.thugs || 0) <= 0) {
          highlightTargets([]);
          showActionPanel(id, {
            buyButtons: [{ label: "No thugs available", disabled: true }],
          });
          return;
        }

        const valid = getValidAttackTargets(id);
        // Highlight valid targets in red; no selected target yet
        highlightTargets(valid);
        selectedCount = Math.min(Math.max(1, selectedCount || 1), d.thugs || 1);

        showActionPanel(id, {
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

          showActionPanel(selectedSourceId, {
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
      const player = getPlayer("player1");
      const types = ["lab", "growhouse", "refinery"];
      const buyButtons = types.map((type) => {
        const idx = Math.min(
          (player.buildingsBoughtThisRound &&
            player.buildingsBoughtThisRound[type]) ||
            0,
          2,
        );
        const cost = Math.round([100, 180, 300][idx] / 5) * 5;
        const disabled = d.buildings && d.buildings.length >= 5;
        const reachedLimit =
          player.buildingsBoughtThisRound &&
          (player.buildingsBoughtThisRound[type] || 0) >= 3;
        return {
          label: `Buy ${type.charAt(0).toUpperCase() + type.slice(1)} (costs $${cost})`,
          disabled: disabled || reachedLimit,
          onClick: () => {
            const res = buyBuilding(id, type);
            if (res && res.success) {
              updateDistrict(id, res.district);
              renderSidebar();
            } else {
              console.warn("buyBuilding failed", res && res.message);
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
          } else {
            console.warn("buyPusher failed", res && res.message);
          }
        },
      });

      const buildingList = (d.buildings || []).map((b, idx) => {
        const emoji =
          b.type === "lab" ? "🧪" : b.type === "growhouse" ? "🌿" : "⚗️";
        return {
          label: `${emoji} ${b.type.charAt(0).toUpperCase() + b.type.slice(1)}`,
          onDelete: () => {
            const res = deleteBuilding(id, idx);
            if (res && res.success) {
              updateDistrict(id, res.district);
              renderSidebar();
            } else {
              console.warn("deleteBuilding failed", res && res.message);
            }
          },
        };
      });

      const thugIdx = Math.min(player.thugsHiredThisRound || 0, 2);
      const thugCost = Math.round([100, 180, 300][thugIdx] / 5) * 5;
      buyButtons.push({
        label: `Hire Thug (cost $${thugCost})`,
        disabled: false,
        onClick: () => {
          const res = hireThugs(id, 1);
          if (res && res.success) {
            updateDistrict(id, res.district);
            renderSidebar();
          } else {
            console.warn("hireThugs failed", res && res.message);
          }
        },
      });

      showActionPanel(id, { buyButtons, buildingList });
      return;
    }

    // ── DEALING phase ─────────────────────────────────────────────────────────
    if (gameState.phase === "Dealing") {
      const stash = d.stash || {};
      const totalStash =
        (stash.coke || 0) + (stash.weed || 0) + (stash.heroin || 0);
      if (totalStash > 0) {
        showDealPanel(id);
      }
    }
  });

  // ── Card clicks (sidebar) ─────────────────────────────────────────────────
  // Cards are rendered in the sidebar by ui.js with data-card-id attributes.
  // We listen here so all interaction logic stays in input.js.
  const sidebar = document.getElementById("sidebar");
  if (sidebar) {
    sidebar.addEventListener("click", (ev) => {
      const cardEl = ev.target.closest("[data-card-id]");
      if (!cardEl) return;
      const cardId = cardEl.dataset.cardId;
      if (!cardId) return;

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
  }
}
