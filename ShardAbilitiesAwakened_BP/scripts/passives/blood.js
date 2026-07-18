/**
 * blood.js — Blood (passive)
 *   Every 2nd hit heals 0.5 hearts (1 HP).
 * Preserves the original addon's exact behavior and numbers.
 */

import { registerHitPassive, registerLeaveCleanup } from "../managers/combatManager.js";
import { healEntity } from "../managers/effectManager.js";
import { PASSIVE_ITEMS } from "../config.js";

const HEAL_EVERY_N_HITS = 2;
const HEAL_AMOUNT_HP = 1; // 1 HP = 0.5 hearts

/** @type {Map<string, number>} playerId -> hit count */
const hitCounts = new Map();

function onHit(attacker) {
  const count = (hitCounts.get(attacker.id) ?? 0) + 1;
  hitCounts.set(attacker.id, count);
  if (count % HEAL_EVERY_N_HITS === 0) {
    healEntity(attacker, HEAL_AMOUNT_HP);
  }
}

registerHitPassive(PASSIVE_ITEMS.blood.id, onHit);
registerLeaveCleanup((playerId) => hitCounts.delete(playerId));
