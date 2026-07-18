/**
 * momentum.js — Momentum (Legendary, passive)
 *
 *   Every consecutive hit on the SAME enemy increases damage:
 *     Hit 1: +5%   Hit 2: +10%   Hit 3: +15%   Hit 4: +20%   Hit 5+: +25% (cap)
 *
 *   Combo resets if: no hit for 4 seconds, the player switches targets,
 *   or either the player or their target dies.
 */

import { system } from "@minecraft/server";
import {
  registerHitPassive,
  registerDamageBonusProvider,
  registerLeaveCleanup,
  registerDeathCleanup,
} from "../managers/combatManager.js";
import { sendActionBar, playAbilitySound, spawnAbilityParticle } from "../utils.js";
import { PASSIVE_ITEMS } from "../config.js";

const COMBO_TIMEOUT_TICKS = 4 * 20; // 4 seconds
const PER_HIT_BONUS = 0.05; // +5% per combo stack
const MAX_BONUS = 0.25; // cap at hit 5+

/** @type {Map<string, {count: number, lastHitTick: number}>} */
const comboState = new Map();

/**
 * Creates a stable composite key for attacker-target pair.
 * Using entity.id (UUID string) ensures consistency across different
 * event contexts where Entity object references may differ.
 */
function makeComboKey(attackerId, targetId) {
  return `${attackerId}:${targetId}`;
}

function currentBonusFor(state) {
  return Math.min(MAX_BONUS, PER_HIT_BONUS * state.count);
}

/**
 * Called on every hit landed by a player carrying Momentum. Updates combo
 * state and gives the player action bar/particle/sound feedback.
 */
function onHit(attacker, target) {
  const now = system.currentTick;
  const key = makeComboKey(attacker.id, target.id);
  const existing = comboState.get(key);

  const withinTimeout = existing ? now - existing.lastHitTick <= COMBO_TIMEOUT_TICKS : false;

  const count = withinTimeout ? existing.count + 1 : 1;
  const state = { count, lastHitTick: now };
  comboState.set(key, state);

  const bonusPercent = Math.round(currentBonusFor(state) * 100);
  sendActionBar(attacker, `§6⚔ Combo x${count} (+${bonusPercent}%)`);
  spawnAbilityParticle(attacker, "minecraft:colored_flame_particle", undefined, {
    red: 1.0,
    green: 0.7,
    blue: 0.1,
  });
  playAbilitySound(attacker, "random.orb", { pitch: 1.0 + Math.min(count, 5) * 0.08 });
}

/**
 * Reports Momentum's current bonus for THIS specific attacker/target pair
 * — a combo built against one enemy doesn't apply to a hit on another.
 */
function getMomentumBonus(attacker, target) {
  if (!attacker || !target) {
    return 0;
  }
  const key = makeComboKey(attacker.id, target.id);
  const state = comboState.get(key);
  if (!state) {
    return 0;
  }
  const elapsed = system.currentTick - state.lastHitTick;
  if (elapsed > COMBO_TIMEOUT_TICKS) {
    return 0;
  }
  return currentBonusFor(state);
}

registerHitPassive(PASSIVE_ITEMS.momentum.id, onHit);
registerDamageBonusProvider("momentum", getMomentumBonus);

// Reset conditions: player leaves (their own combo is gone), player dies
// (combo dies with them), OR the entity they were combo-ing dies (nothing
// left to combo).
registerLeaveCleanup((playerId) => comboState.delete(playerId));
registerDeathCleanup((deadEntityId) => {
  for (const [key, state] of comboState) {
    const [attackerId, targetId] = key.split(':');
    if (attackerId === deadEntityId || targetId === deadEntityId) {
      comboState.delete(key);
    }
  }
});
