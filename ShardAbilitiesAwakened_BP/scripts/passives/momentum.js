/**
 * momentum.js — Momentum (Legendary, passive)
 *
 *   Every consecutive hit on the SAME enemy increases damage:
 *     Hit 1: +5%   Hit 2: +10%   Hit 3: +15%   Hit 4: +20%   Hit 5+: +25% (cap)
 *
 *   Combo resets if: no hit for 4 seconds, the player switches targets,
 *   or either the player or their target dies.
 *
 * WHY THIS FILE PLAYS TWO ROLES (hit passive AND damage-bonus provider):
 * Tracking the combo (which target, how many hits, when was the last one)
 * has to happen on entityHitEntity — that's the only event that fires
 * every successful hit. But APPLYING the bonus has to happen through
 * combatManager's damage-bonus resolution, so it can be compared against
 * Rage's bonus and only the larger one wins, per your earlier call. So
 * this file updates combo state in one handler and reports it in another
 * — two small functions instead of one, because they're triggered by two
 * different events for a reason, not by accident.
 *
 * A NOTE ON EVENT ORDERING (being upfront about an assumption I can't
 * verify without live testing): this assumes entityHitEntity fires before
 * entityHurt for the same swing, which is the commonly observed order in
 * Bedrock and matches internal hit-detection-then-damage-application
 * logic. If that assumption is ever wrong on some platform, the bonus
 * would lag by one hit (using the previous hit's combo count instead of
 * the current one) — a minor cosmetic inaccuracy, not a crash risk. If
 * you notice combo damage feels "one hit behind" in testing, tell me and
 * we'll revisit this.
 *
 * A NOTE ON "miss" AS A RESET CONDITION: Bedrock's Script API has no
 * event for a swing that doesn't connect — entityHitEntity only fires on
 * a successful hit. So "reset on miss" and "reset after 4 seconds with no
 * hit" collapse into the same check here: a miss just means more time
 * passes without a landed hit, which the 4-second timeout already covers.
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

/** @type {Map<string, {targetId: string, count: number, lastHitTick: number}>} */
const comboState = new Map();

function currentBonusFor(state) {
  return Math.min(MAX_BONUS, PER_HIT_BONUS * state.count);
}

/**
 * Called on every hit landed by a player carrying Momentum. Updates combo
 * state and gives the player action bar/particle/sound feedback.
 */
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
  // Pitch climbs slightly with combo count so higher stacks feel more intense.
  playAbilitySound(attacker, "random.orb", { pitch: 1.0 + Math.min(count, 5) * 0.08 });
}

/**
 * Reports Momentum's current bonus for THIS specific attacker/target pair
 * — a combo built against one enemy doesn't apply to a hit on another.
 */
function getMomentumBonus(attacker, target) {
  const state = comboState.get(attacker.id);
  if (!state) return 0;
  if (state.targetId !== target.id) return 0;
  if (system.currentTick - state.lastHitTick > COMBO_TIMEOUT_TICKS) return 0;
  return currentBonusFor(state);
}

registerHitPassive(PASSIVE_ITEMS.momentum.id, onHit);
registerDamageBonusProvider("momentum", getMomentumBonus);

// Reset conditions: player leaves (their own combo is gone), player dies
// (combo dies with them), OR the entity they were combo-ing dies (nothing
// left to combo). Both hooked through combatManager's generic cleanup —
// see the note in combatManager.js about why this is a separate mechanism
// from the ownership-gated deathPassives map.
registerLeaveCleanup((playerId) => comboState.delete(playerId));
registerDeathCleanup((deadEntityId) => {
  comboState.delete(deadEntityId); // the attacker died
  for (const [attackerId, state] of comboState) {
    if (state.targetId === deadEntityId) comboState.delete(attackerId); // their target died
  }
});
