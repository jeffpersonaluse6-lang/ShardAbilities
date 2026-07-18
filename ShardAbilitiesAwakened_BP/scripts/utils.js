import { MolangVariableMap } from "@minecraft/server";

/**
 * utils.js
 *
 * Small, generic helpers used across the addon. Nothing here is
 * shard-specific — if a function only makes sense for one ability, it
 * belongs in that ability's file instead, not here.
 */

/**
 * Sends a message to a player's action bar (the small text above the hotbar).
 * Centralized so every "on cooldown" / "ability activated" message looks
 * and behaves consistently.
 * @param {import("@minecraft/server").Player} player
 * @param {string} message
 */
export function sendActionBar(player, message) {
  player.onScreenDisplay.setActionBar(message);
}

/**
 * Plays a sound effect at a player's location, audible only to them.
 * Using playSound (not the world-wide variant) keeps ability feedback
 * personal and avoids spamming every nearby player's audio in multiplayer.
 * @param {import("@minecraft/server").Player} player
 * @param {string} soundId
 * @param {Partial<import("@minecraft/server").PlayerSoundOptions>} [options]
 */
export function playAbilitySound(player, soundId, options = {}) {
  player.playSound(soundId, options);
}

/**
 * Spawns a particle effect at (or relative to) a player's location.
 * @param {import("@minecraft/server").Player} player
 * @param {string} particleId
 * @param {import("@minecraft/server").Vector3} [location] - Defaults to the player's own location.
 * @param {{red: number, green: number, blue: number}} [color] - Optional RGB values for particles that use Molang color variables.
 */
export function spawnAbilityParticle(player, particleId, location, color) {
  const dimension = player.dimension;
  const particleLocation = location ?? player.location;

  if (color) {
    const variables = new MolangVariableMap();
    variables.setColorRGB("variable.color", color);
    dimension.spawnParticle(particleId, particleLocation, variables);
    return;
  }

  dimension.spawnParticle("minecraft:villager_happy", particleLocation);
}

/**
 * Formats a whole-second cooldown remainder into a short player-facing string.
 * @param {number} seconds
 * @returns {string}
 */
export function formatCooldownMessage(displayName, seconds) {
  return `§c${displayName} on cooldown: §f${seconds}s`;
}
