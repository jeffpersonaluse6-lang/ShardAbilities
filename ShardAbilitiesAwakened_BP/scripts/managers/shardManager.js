/**
 * shardManager.js
 *
 * This is the framework's dispatcher. It owns two things:
 *
 * 1. An ability registry — each ability file (void.js, rage.js, ...) calls
 *    registerAbility() once, at import time, to plug itself in. shardManager
 *    never imports ability files directly and never contains a switch
 *    statement listing shard names. This is what makes adding a future
 *    shard a "write one file" change instead of a "touch five files" change.
 *
 * 2. activateShard() — the single reusable flow every shard goes through:
 *    check cooldown -> (execute ability | show cooldown message) -> start
 *    cooldown. This function is written once and never duplicated per shard.
 */

import { SHARDS } from "../config.js";
import {
  isOnCooldown,
  getRemainingSeconds,
  startCooldown,
} from "./cooldownManager.js";
import { sendActionBar, formatCooldownMessage } from "../utils.js";

/**
 * @callback AbilityExecutor
 * @param {import("@minecraft/server").Player} player
 * @returns {void}
 */

/** @type {Map<string, AbilityExecutor>} */
const abilityRegistry = new Map();

/**
 * Called by each ability file to register its execution logic under a
 * shard id. Keeping registration inversion-of-control like this means
 * shardManager stays generic forever, no matter how many shards exist.
 * @param {string} abilityId - Must match a key in config.js's SHARDS table.
 * @param {AbilityExecutor} executor
 */
export function registerAbility(abilityId, executor) {
  if (abilityRegistry.has(abilityId)) {
    console.warn(
      `[ShardAbilities] Ability "${abilityId}" was registered more than once — overwriting.`
    );
  }
  abilityRegistry.set(abilityId, executor);
}

/**
 * The core reusable activation flow. Called once per shard item use.
 * @param {import("@minecraft/server").Player} player
 * @param {import("../config.js").ShardDefinition} shard
 */
export function activateShard(player, shard) {
  if (isOnCooldown(player, shard.id)) {
    const remaining = getRemainingSeconds(player, shard.id);
    sendActionBar(player, formatCooldownMessage(shard.displayName, remaining));
    return;
  }

  const executor = abilityRegistry.get(shard.id);
  if (!executor) {
    // This means a shard is defined in config.js but its ability file
    // either wasn't imported in main.js or forgot to call registerAbility.
    console.warn(
      `[ShardAbilities] No ability registered for "${shard.id}" — check that its ability file is imported in main.js.`
    );
    return;
  }

  // Cooldown starts BEFORE execution. This matters: if we started it after,
  // a player could spam-use an ability that takes multiple ticks to resolve
  // (e.g. a delayed teleport) and fire it several times before the cooldown
  // ever kicks in. Starting first closes that window.
  startCooldown(player, shard.id, shard.cooldownSeconds);

  executor(player);
}

/**
 * Convenience export so main.js and other modules can enumerate every
 * configured shard without importing config.js separately.
 */
export { SHARDS };
