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
const PER_HIT_BONUS = 0.05;
const MAX_BONUS = 0.25;

/** @type {Map<string, {targetId: string, count: number, lastHitTick: number}>} */
const comboState = new Map();

function currentBonusFor(state) {
  return Math.min(MAX_BONUS, PER_HIT_BONUS * state.count);
}

function onHit(attacker, target) {
  const now = system.currentTick;
  const existing = comboState.get(attacker.id);

  const isSameTarget = existing?.targetId === target.id;
  const withinTimeout = existing ? now - existing.lastHitTick <= COMBO_TIMEOUT_TICKS : false;
  const continuingCombo = isSameTarget && withinTimeout;

  const count = continuingCombo ? existing.count + 1 : 1;
  const state = { targetId: target.id, count, lastHitTick: now };
  comboState.set(attacker.id, state);

  const bonusPercent = Math.round(currentBonusFor(state) * 100);
  sendActionBar(attacker, `§6⚔ Combo x${count} (+${bonusPercent}%)`);
  spawnAbilityParticle(attacker, "minecraft:colored_flame_particle", undefined, {
    red: 1.0,
    green: 0.7,
    blue: 0.1,
  });
  playAbilitySound(attacker, "random.orb", { pitch: 1.0 + Math.min(count, 5) * 0.08 });
}

function getMomentumBonus(attacker, target) {
  const state = comboState.get(attacker.id);
  if (!state) return 0;
  if (state.targetId !== target.id) return 0;
  if (system.currentTick - state.lastHitTick > COMBO_TIMEOUT_TICKS) return 0;
  return currentBonusFor(state);
}

registerHitPassive(PASSIVE_ITEMS.momentum.id, onHit);
registerDamageBonusProvider("momentum", getMomentumBonus);

registerLeaveCleanup((playerId) => comboState.delete(playerId));
registerDeathCleanup((deadEntityId) => {
  comboState.delete(deadEntityId);
  for (const [attackerId, state] of comboState) {
    if (state.targetId === deadEntityId) comboState.delete(attackerId);
  }
});
