/**
 * nightfall.js — Nightfall (passive)
 *   At night: Strength II, Speed I, Resistance I.
 * Re-applied every second while it's night (each application only lasts
 * 3s), so effects stay topped up continuously without flickering, and
 * drop off naturally within 3s of dawn or of the item being unequipped —
 * matching the original addon's exact behavior.
 */

import { world } from "@minecraft/server";
import { registerTickPassive } from "../managers/combatManager.js";
import { applyEffect } from "../managers/effectManager.js";
import { PASSIVE_ITEMS } from "../config.js";

const EFFECT_REFRESH_SECONDS = 3;
const NIGHT_START = 13000;
const NIGHT_END = 23000;

function onTick(player) {
  const time = world.getTimeOfDay();
  const isNight = time >= NIGHT_START && time <= NIGHT_END;
  if (!isNight) return;

  applyEffect(player, "strength", EFFECT_REFRESH_SECONDS, 1); // Strength II
  applyEffect(player, "speed", EFFECT_REFRESH_SECONDS, 0); // Speed I
  applyEffect(player, "resistance", EFFECT_REFRESH_SECONDS, 0); // Resistance I
}

registerTickPassive(PASSIVE_ITEMS.nightfall.id, onTick);
