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
  console.log(`[Momentum STAGE 1] onHit() called: attacker=${attacker.id}, target=${target.id}`);
  const now = system.currentTick;
  const existing = comboState.get(attacker.id);

  console.log(`[Momentum STAGE 1] existing state for ${attacker.id}: ${existing ? `targetId=${existing.targetId}, count=${existing.count}` : 'NONE'}`);
  
  const isSameTarget = existing?.targetId === target.id;
  const withinTimeout = existing ? now - existing.lastHitTick <= COMBO_TIMEOUT_TICKS : false;
  const continuingCombo = isSameTarget && withinTimeout;

  console.log(`[Momentum STAGE 1] isSameTarget=${isSameTarget}, withinTimeout=${withinTimeout}, continuingCombo=${continuingCombo}`);

  const count = continuingCombo ? existing.count + 1 : 1;
  const state = { targetId: target.id, count, lastHitTick: now };
  comboState.set(attacker.id, state);

  console.log(`[Momentum STAGE 1] state saved: attacker=${attacker.id}, targetId=${target.id}, count=${count}`);
  
  const bonusPercent = Math.round(currentBonusFor(state) * 100);
  console.log(`[Momentum STAGE 1] onHit: count=${count}, bonusPercent=${bonusPercent}%, state set for attacker=${attacker.id}`);
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
  console.log(`[Momentum STAGE 2] getMomentumBonus() called: attacker=${attacker?.id}, target=${target?.id}`);
  if (!attacker || !target) {
    console.log(`[Momentum STAGE 2] RETURNING bonus=0 (null attacker or target)`);
    return 0;
  }
  const state = comboState.get(attacker.id);
  console.log(`[Momentum STAGE 2] comboState has ${comboState.size} entries, keys: ${Array.from(comboState.keys()).join(', ')}`);
  if (state) {
    console.log(`[Momentum STAGE 2] state found: targetId=${state.targetId}, count=${state.count}, lastHitTick=${state.lastHitTick}`);
  } else {
    console.log(`[Momentum STAGE 2] NO STATE for attacker ${attacker.id}`);
    console.log(`[Momentum STAGE 2] RETURNING bonus=0 (no state)`);
    return 0;
  }
  if (state.targetId !== target.id) {
    console.log(`[Momentum STAGE 2] TARGET MISMATCH state.targetId=${state.targetId} vs target.id=${target.id}`);
    console.log(`[Momentum STAGE 2] RETURNING bonus=0 (target mismatch)`);
    return 0;
  }
  const elapsed = system.currentTick - state.lastHitTick;
  console.log(`[Momentum STAGE 2] elapsed=${elapsed}, COMBO_TIMEOUT_TICKS=${COMBO_TIMEOUT_TICKS}`);
  if (elapsed > COMBO_TIMEOUT_TICKS) {
    console.log(`[Momentum STAGE 2] TIMEOUT elapsed=${elapsed} > ${COMBO_TIMEOUT_TICKS}`);
    console.log(`[Momentum STAGE 2] RETURNING bonus=0 (timeout)`);
    return 0;
  }
  const bonus = currentBonusFor(state);
  console.log(`[Momentum STAGE 2] RETURNING bonus=${bonus} (count=${state.count}, target=${target.id})`);
  return bonus;
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
