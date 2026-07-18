/**
 * eclipse.js — Eclipse (passive)
 *   Below 5 hearts (10 HP): Regeneration I, Resistance II.
 * Same "refresh every second while condition holds" pattern as Nightfall.
 */

import { registerTickPassive } from "../managers/combatManager.js";
import { applyEffect, getHealth } from "../managers/effectManager.js";
import { PASSIVE_ITEMS } from "../config.js";

const EFFECT_REFRESH_SECONDS = 3;
const LOW_HEALTH_THRESHOLD = 10; // 5 hearts

function onTick(player) {
  const health = getHealth(player);
  if (!health || health.currentValue > LOW_HEALTH_THRESHOLD) return;

  applyEffect(player, "regeneration", EFFECT_REFRESH_SECONDS, 0); // Regeneration I
  applyEffect(player, "resistance", EFFECT_REFRESH_SECONDS, 1); // Resistance II
}

registerTickPassive(PASSIVE_ITEMS.eclipse.id, onTick);
