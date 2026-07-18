/**
 * abyss.js — Abyss (passive)
 *   Attacking an enemy below 5 hearts (10 HP) applies Blindness.
 * No hit counter needed — this checks the target's current health
 * directly on every hit, which is O(1) and needs no per-player state.
 */

import { registerHitPassive } from "../managers/combatManager.js";
import { applyEffect, getHealth } from "../managers/effectManager.js";
import { PASSIVE_ITEMS } from "../config.js";

const LOW_HEALTH_THRESHOLD = 10; // 5 hearts
const BLINDNESS_SECONDS = 5;

function onHit(attacker, target) {
  const health = getHealth(target);
  if (health && health.currentValue < LOW_HEALTH_THRESHOLD) {
    applyEffect(target, "blindness", BLINDNESS_SECONDS, 0);
  }
}

registerHitPassive(PASSIVE_ITEMS.abyss.id, onHit);
