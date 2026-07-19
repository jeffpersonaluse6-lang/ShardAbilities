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
 * Builds a MolangVariableMap for particles that need a "variable.color"
 * RGB input (like colored_flame_particle). Shared by every particle
 * helper below instead of each one building this map inline.
 * @param {{red: number, green: number, blue: number}} color
 * @returns {import("@minecraft/server").MolangVariableMap}
 */
function buildColorMolang(color) {
  const variables = new MolangVariableMap();
  variables.setColorRGB("variable.color", color);
  return variables;
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
    dimension.spawnParticle(particleId, particleLocation, buildColorMolang(color));
    return;
  }

  dimension.spawnParticle("minecraft:villager_happy", particleLocation);
}

/**
 * Spawns particles arranged in a circle around a center point — a ring
 * effect, rather than a single-point burst. Shared here so every ability
 * that wants a ring uses the same math instead of each reimplementing it.
 * @param {import("@minecraft/server").Dimension} dimension
 * @param {import("@minecraft/server").Vector3} center
 * @param {string} particleId
 * @param {number} radius
 * @param {number} count
 * @param {{red:number, green:number, blue:number}} [color]
 */
export function spawnParticleRing(dimension, center, particleId, radius, count, color) {
  const molang = color ? buildColorMolang(color) : undefined;
  for (let i = 0; i < count; i++) {
    const angle = (2 * Math.PI * i) / count;
    const point = {
      x: center.x + Math.cos(angle) * radius,
      y: center.y,
      z: center.z + Math.sin(angle) * radius,
    };
    try {
      dimension.spawnParticle(particleId, point, molang);
    } catch {
      // A ring point landed in an unloaded chunk — skip just that one.
    }
  }
}

/**
 * Spawns a short line of particles between two points — used for trail
 * effects (e.g. a teleport's flight path).
 * @param {import("@minecraft/server").Dimension} dimension
 * @param {import("@minecraft/server").Vector3} from
 * @param {import("@minecraft/server").Vector3} to
 * @param {string} particleId
 * @param {number} steps
 * @param {{red:number, green:number, blue:number}} [color]
 */
export function spawnParticleTrail(dimension, from, to, particleId, steps, color) {
  const molang = color ? buildColorMolang(color) : undefined;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const point = {
      x: from.x + (to.x - from.x) * t,
      y: from.y + (to.y - from.y) * t,
      z: from.z + (to.z - from.z) * t,
    };
    try {
      dimension.spawnParticle(particleId, point, molang);
    } catch {
      // A trail point landed in an unloaded chunk — skip just that one.
    }
  }
}

/**
 * Formats a whole-second cooldown remainder into a short player-facing string.
 * @param {number} seconds
 * @returns {string}
 */
export function formatCooldownMessage(displayName, seconds) {
  return `§c${displayName} on cooldown: §f${seconds}s`;
}
