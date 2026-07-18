/**
 * cooldownManager.js
 *
 * Tracks ability cooldowns per player, per ability. This is the ONLY place
 * in the addon that knows how cooldowns are stored. Abilities and the
 * activation listener just call these functions — they never touch the
 * underlying data structure directly.
 *
 * Storage shape:
 *   playerCooldowns: Map<playerId: string, Map<abilityId: string, expiryTick: number>>
 *
 * Why nested Maps keyed by player.id (not player.name)?
 *   - player.id is a stable, unique identifier that doesn't change if a
 *     player renames their gamertag mid-session.
 *   - Using a Map keyed per player means every player's cooldowns are fully
 *     independent of every other player's — this is what makes the system
 *     multiplayer-safe. There is no single global cooldown variable that
 *     could leak between players.
 *
 * Why ticks instead of Date.now() or real seconds?
 *   - Minecraft's `system.currentTick` is the server's own clock, already
 *     synced to game time (20 ticks = 1 second). Using it means cooldowns
 *     behave consistently with in-game time, and we avoid pulling in wall
 *     clock time that has nothing to do with the simulation.
 */

import { system } from "@minecraft/server";

const TICKS_PER_SECOND = 20;

/** @type {Map<string, Map<string, number>>} */
const playerCooldowns = new Map();

/**
 * Gets (or lazily creates) the cooldown map for a specific player.
 * @param {string} playerId
 * @returns {Map<string, number>}
 */
function getPlayerMap(playerId) {
  let map = playerCooldowns.get(playerId);
  if (!map) {
    map = new Map();
    playerCooldowns.set(playerId, map);
  }
  return map;
}

/**
 * Returns true if the given ability is still on cooldown for this player.
 * @param {import("@minecraft/server").Player} player
 * @param {string} abilityId
 * @returns {boolean}
 */
export function isOnCooldown(player, abilityId) {
  const expiryTick = getPlayerMap(player.id).get(abilityId);
  if (expiryTick === undefined) return false;
  return system.currentTick < expiryTick;
}

/**
 * Returns remaining cooldown time in whole seconds (0 if ready).
 * @param {import("@minecraft/server").Player} player
 * @param {string} abilityId
 * @returns {number}
 */
export function getRemainingSeconds(player, abilityId) {
  const expiryTick = getPlayerMap(player.id).get(abilityId);
  if (expiryTick === undefined) return 0;
  const remainingTicks = expiryTick - system.currentTick;
  if (remainingTicks <= 0) return 0;
  return Math.ceil(remainingTicks / TICKS_PER_SECOND);
}

/**
 * Starts (or restarts) a cooldown for a player's ability.
 * @param {import("@minecraft/server").Player} player
 * @param {string} abilityId
 * @param {number} durationSeconds
 */
export function startCooldown(player, abilityId, durationSeconds) {
  const expiryTick = system.currentTick + durationSeconds * TICKS_PER_SECOND;
  getPlayerMap(player.id).set(abilityId, expiryTick);
}

/**
 * Removes all cooldown data for a player. Call this on player leave so the
 * Map doesn't quietly accumulate entries for players who are no longer
 * connected — important for long-running multiplayer servers.
 * @param {string} playerId
 */
export function clearPlayerCooldowns(playerId) {
  playerCooldowns.delete(playerId);
}
