/**
 * main.js
 *
 * The addon's entry point. Its job is intentionally small:
 *   1. Import every ability file so they self-register.
 *   2. Listen for shard item activation and translate it into a shard lookup.
 *   3. Hand off to shardManager.activateShard() for everything else.
 *   4. Clean up per-player state when a player disconnects.
 *
 * main.js should stay thin. If you find yourself writing ability logic in
 * here, it belongs in abilities/*.js instead.
 */

import { world } from "@minecraft/server";
import { ITEM_ID_TO_SHARD } from "./config.js";
import { activateShard } from "./managers/shardManager.js";
import { clearPlayerCooldowns } from "./managers/cooldownManager.js";
import { runLeaveCleanup } from "./managers/combatManager.js";

// --- Ability imports (Shards: active-use, cooldown-gated) ----------------
import "./abilities/void.js";
import "./abilities/rage.js";
import "./abilities/ender.js";
import "./abilities/shadow.js";
import "./abilities/sky.js";
import "./abilities/vision.js";
import "./abilities/fire.js";
import "./abilities/water.js";
import "./abilities/lightning.js";
import "./abilities/frost.js";

// --- Passive imports (just-carry-it-in-inventory items) -------------------
import "./passives/momentum.js";

// Dev-only damage readout — see debug.js. Controlled by DEBUG_MODE in
// config.js; harmless to leave imported since it's a no-op when off.
import "./debug.js";

/**
 * Detects shard activation via item use. See ability files for the full
 * explanation of why itemUse is the correct event for this.
 */
world.afterEvents.itemUse.subscribe((event) => {
  const { source: player, itemStack } = event;

  const shard = ITEM_ID_TO_SHARD[itemStack.typeId];
  if (!shard) return; // Not one of our shard items — ignore.

  activateShard(player, shard);
});

/**
 * Prevents the cooldown manager's per-player Map from silently growing
 * forever on a long-running multiplayer server as players come and go.
 */
world.beforeEvents.playerLeave.subscribe((event) => {
  clearPlayerCooldowns(event.player.id);
  runLeaveCleanup(event.player.id);
});

console.log("[ShardAbilities] Framework loaded.");
