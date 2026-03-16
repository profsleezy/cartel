// game/ai.js
// Minimal heuristic AI to exercise game mechanics for bots.

import { gameState, getPlayer, ensureQueuedAttacks, addNews, queueAttack } from "./state.js";
import { buyBuilding, hireThugs, buyPusher, dealProduct } from "./economy.js";
import { getValidAttackTargets } from "./combat.js";
import { drawCard } from "./cards.js";
import { rand } from "./rng.js";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function logAI(playerId, action, reason) {
  const msg = `[AI][${playerId}] ${action} — ${reason}`;
  try {
    console.log(msg);
  } catch (e) {}
  addNews(msg);
  // notify UI about state change so live updates appear
  try {
    if (typeof window !== 'undefined')
      window.dispatchEvent(new CustomEvent('gameStateChanged', { detail: { phase: gameState.phase, phaseChanged: false, dataUpdated: true } }));
  } catch (e) {}
}

function chooseBuildingTypeForDistrict(d) {
  if (!d || !d.specialty) return "lab";
  switch (d.specialty) {
    case "coke":
      return "lab";
    case "weed":
      return "growhouse";
    case "heroin":
      return "refinery";
    default:
      return "lab";
  }
}

export async function onBuyingPhase(playerId) {
  const player = getPlayer(playerId);
  if (!player || !player.isBot) return;
  const owned = gameState.districts.filter((d) => d.owner === playerId);

  // personality: aggressiveness (0..1), greed (0..1)
  const aggressiveness = player.aiProfile?.aggressiveness ?? 0.5 + (rand() - 0.5) * 0.2;
  const greed = player.aiProfile?.greed ?? 0.5 + (rand() - 0.5) * 0.2;

  // Decide number of buying actions (0..2)
  const actions = Math.max(0, Math.round(greed * 2 + Math.floor(rand() * 2) - 0.5));
  let did = 0;

  // Prefer to buy buildings that align with district specialty
  const candidates = owned
    .filter((d) => Array.isArray(d.buildings) ? d.buildings.length < 5 : true)
    .sort((a, b) => ((b.basePrices.coke || 0) - (a.basePrices.coke || 0)));

  for (const target of candidates) {
    if (did >= actions) break;
    if ((player.cash || 0) < 5000) break;
    
    await sleep(Math.floor(500 + rand() * 1500)); // AI thinking delay
    
    const type = chooseBuildingTypeForDistrict(target);
    const res = buyBuilding(target.id, type, playerId);
    if (res && res.success) {
      logAI(playerId, `Bought ${type} on ${target.id}`, `greed=${greed.toFixed(2)} selected target by specialty`);
      did++;
    }
  }

  // Optionally buy a pusher
  if (did < actions && (player.pushers || 0) < 3 && (player.cash || 0) > 12000 && rand() < 0.7) {
    await sleep(Math.floor(300 + rand() * 1000));
    const r = buyPusher(playerId);
    if (r && r.success) logAI(playerId, `Bought pusher`, `increase distribution capacity`);
  }

  // Hire a thug on a border district probabilistically based on aggressiveness
  if (rand() < aggressiveness) {
    for (const d of owned) {
      const targets = getValidAttackTargets(d.id, playerId);
      if (targets && targets.length && (player.cash || 0) > 8000) {
        await sleep(Math.floor(400 + rand() * 1200));
        const res = hireThugs(d.id, 1, playerId);
        if (res && res.success) {
          logAI(playerId, `Hired 1 thug on ${d.id}`, `aggressiveness=${aggressiveness.toFixed(2)} border presence`);
        }
        break;
      }
    }
  }
}

export async function onDealingPhase(playerId) {
  const player = getPlayer(playerId);
  if (!player || !player.isBot) return;
  // Draw a card for the bot at Buying->Dealing transition (safety)
  drawCard(playerId);

  const owned = gameState.districts.filter((d) => d.owner === playerId);
  const greed = player.aiProfile?.greed ?? 0.5 + (rand() - 0.5) * 0.2;

  // For each product, sell selectively: prefer highest price districts and sell a portion
  for (const product of ["coke", "weed", "heroin"]) {
    // collect sources with stash
    const sources = owned.filter((s) => (s.stash && (s.stash[product] || 0) > 0));
    if (!sources.length) continue;
    // pick best target (highest price for this product)
    let bestTarget = owned[0];
    let bestPrice = (bestTarget.dealingPrices && bestTarget.dealingPrices[product]) || bestTarget.prices[product] || 0;
    for (const t of owned) {
      const p = (t.dealingPrices && t.dealingPrices[product]) || t.prices[product] || 0;
      if (p > bestPrice) {
        bestTarget = t;
        bestPrice = p;
      }
    }
    // sell from at most two sources, and only a fraction based on greed
    let soldCount = 0;
    for (const src of sources) {
      if (soldCount >= 2) break;
      const available = src.stash[product] || 0;
      const capacity = Math.max(1, Math.floor((player.pushers || 1) * (1 + (player.aiProfile?.capacityBonus || 0)) * 2));
      const amount = Math.min(available, Math.floor(capacity * (0.5 + greed * 0.5)));

      if (amount > 0) {
        await sleep(Math.floor(300 + rand() * 1000));
        const res = dealProduct(src.id, bestTarget.id, product, amount, playerId);
        if (res && res.success) {
          logAI(playerId, `Dealt ${amount} ${product} from ${src.id} to ${bestTarget.id}`, `greed=${greed.toFixed(2)} price=${bestPrice}`);
          soldCount++;
        }
      }
    }
  }
}

export async function onAttackingPhase(playerId) {
  const player = getPlayer(playerId);
  if (!player || !player.isBot) return;
  const owned = gameState.districts.filter((d) => d.owner === playerId);
  if (!gameState.queuedAttacks) gameState.queuedAttacks = [];

  const aggressiveness = player.aiProfile?.aggressiveness ?? 0.5 + (rand() - 0.5) * 0.3;
  // limit total attacks per bot this phase: one attack per bot for now
  const maxAttacks = 1;
  let attacksPlanned = 0;

  // Score potential attacks and choose best ones
  const candidates = [];
  for (const d of owned) {
    const available = d.thugs || 0;
    if (available <= 0) continue;
    const targets = getValidAttackTargets(d.id, playerId);
    if (!targets || !targets.length) continue;
    for (const tid of targets) {
      const tgt = gameState.districts.find((x) => x.id === tid);
      if (!tgt) continue;
      const defender = tgt.thugs || 0;
      const score = (available - defender) + (tgt.buildings ? tgt.buildings.length * 0.5 : 0) - (tgt.heat || 0) * 0.2;
      candidates.push({ from: d.id, to: tid, available, defender, score });
    }
  }

  candidates.sort((a, b) => b.score - a.score);
  for (const c of candidates) {
    if (attacksPlanned >= maxAttacks) break;
    // only attack if score is reasonable or luck favors
    if (c.score >= 0 || rand() < aggressiveness) {
      await sleep(Math.floor(1000 + rand() * 2000));
      const commit = Math.max(1, Math.min(c.available, Math.round(c.defender * (0.9 + rand() * 0.4))));
      const res = queueAttack(c.from, c.to, commit, playerId);
      if (res && res.success) {
        attacksPlanned++;
        logAI(playerId, `Queued attack from ${c.from} -> ${c.to} (commit ${commit})`, `score=${c.score.toFixed(2)} aggressiveness=${aggressiveness.toFixed(2)}`);
      }
    }
  }
}
