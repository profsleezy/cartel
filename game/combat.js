// game/combat.js
// Resolve attacks between districts and provide helper to find valid targets

import { gameState } from "./state.js";
import { rand } from "./rng.js";

/**
 * Resolve an attack. attackerDistrict and defenderDistrict are district objects.
 * attackerCount is number of attacking thugs committed.
 * Win chance = attackerCount / (attackerCount + defenderThugs) ± variance (10-15%).
 * Returns { attackerWon, attackerLosses, defenderLosses }
 */
export function resolveAttack(
  attackerDistrict,
  attackerCount,
  defenderDistrict,
) {
  const defenderThugs = defenderDistrict.thugs || 0;
  // If defender has no thugs, attacker automatically wins with no losses
  if ((defenderThugs || 0) === 0) {
    return {
      attackerWon: true,
      attackerLosses: 0,
      defenderLosses: 0,
      attackerSurvivors: attackerCount,
    };
  }
  const base = attackerCount / (attackerCount + Math.max(1, defenderThugs));
  // bias: if attacker has same or more thugs, give a slight +0.05 bonus
  const bias = attackerCount >= defenderThugs ? 0.05 : 0;
  // variance between -0.15 and +0.15
  const variance = rand() * 0.3 - 0.15;
  const chance = Math.max(0, Math.min(1, base + bias + variance));
  const roll = rand();
  const attackerWon = roll < chance;

  let attackerLosses = 0;
  let defenderLosses = 0;
  let attackerSurvivors = 0;

  if (attackerWon) {
    // defender loses all thugs
    defenderLosses = defenderThugs;
    // attacker casualties depend on defender numbers
    if (defenderThugs === 0) {
      attackerSurvivors = attackerCount; // all survive
      attackerLosses = 0;
    } else {
      // losses scale with defenderThugs and some randomness
      const lossEstimate = Math.round(defenderThugs * (0.4 + rand() * 0.6));
      attackerLosses = Math.min(attackerCount, lossEstimate);
      attackerSurvivors = Math.max(0, attackerCount - attackerLosses);
    }
  } else {
    // attacker loses all committed thugs
    attackerLosses = attackerCount;
    attackerSurvivors = 0;
    // defender may take light casualties
    defenderLosses = Math.round((defenderThugs || 0) * (rand() * 0.15));
  }

  return { attackerWon, attackerLosses, defenderLosses, attackerSurvivors };
}

/**
 * Return adjacent non-player1 district ids for a given district id.
 * Reads adjacency purely from the adjacency array already present on each district
 * object in gameState.districts — no DOM access of any kind.
 */
export function getValidAttackTargets(districtId, playerId = "player1") {
  const d = gameState.districts.find((x) => x.id === districtId);
  if (!d) return [];

  const adjSet = new Set((d.adjacency || []).map((a) => String(a)));

  return gameState.districts
    .filter((x) => adjSet.has(String(x.id)) && x.owner !== playerId)
    .map((x) => x.id);
}
