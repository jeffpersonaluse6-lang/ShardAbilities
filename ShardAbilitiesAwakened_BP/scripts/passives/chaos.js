/**
 * chaos.js — Chaos (passive)
 *   Every 30 seconds, grants a random Tier I potion effect.
 * Uses a per-player "last triggered" tick, checked each second by the
 * shared tick loop — same timer pattern as the original addon, just
 * moved out of a standalone system.runInterval into the shared one.
 */

import { system } from "@minecraft/server";
import { registerTickPassive, registerLeaveCleanup } from "../managers/combatManager.js";
import { applyEffect } from "../managers/effectManager.js";
import { PASSIVE_ITEMS } from "../config.js";

const TRIGGER_INTERVAL_TICKS = 30 * 20; // 30 seconds
const EFFECT_DURATION_SECONDS = 35;
const TIER_1_EFFECTS = [
  "speed", "strength", "jump_boost", "haste",
  "regeneration", "resistance", "fire_resistance", "night_vision",
];

/** @type {Map<string, number>} playerId -> tick last triggered */
const lastTriggerTick = new Map();

function onTick(player) {
  const now = system.currentTick;
  const last = lastTriggerTick.get(player.id) ?? -Infinity;
  if (now - last < TRIGGER_INTERVAL_TICKS) return;

  lastTriggerTick.set(player.id, now);
  const chosen = TIER_1_EFFECTS[Math.floor(Math.random() * TIER_1_EFFECTS.length)];
  applyEffect(player, chosen, EFFECT_DURATION_SECONDS, 0);
}

registerTickPassive(PASSIVE_ITEMS.chaos.id, onTick);
registerLeaveCleanup((playerId) => lastTriggerTick.delete(playerId));
