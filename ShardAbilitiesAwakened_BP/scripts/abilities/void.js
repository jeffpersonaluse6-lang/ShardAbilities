/**
 * void.js
 *
 * Void Shard — "Void Form"
 *   - Strength I, Speed II, Resistance I for 8 seconds
 *   - Instant ~10 block dash in the direction the player is facing
 *   - Cooldown (180s) and activation flow are handled entirely by
 *     shardManager — this file ONLY contains what makes Void unique.
 *
 * This file is the template the other five abilities will follow:
 * one default export-free module that calls registerAbility() once.
 */

import { registerAbility } from "../managers/shardManager.js";
import {
  sendActionBar,
  playAbilitySound,
  spawnAbilityParticle,
  spawnParticleRing,
} from "../utils.js";
import { SHARDS } from "../config.js";

const EFFECT_DURATION_TICKS = 8 * 20; // 8 seconds
const DASH_HORIZONTAL_STRENGTH = 2.6; // Tuned so the resulting travel is ~10 blocks
const DASH_VERTICAL_STRENGTH = 0.15; // Small lift so the dash doesn't catch on floor friction

/**
 * Applies the Void Form status effects.
 * @param {import("@minecraft/server").Player} player
 */
function applyVoidEffects(player) {
  player.addEffect("strength", EFFECT_DURATION_TICKS, {
    amplifier: 0,
    showParticles: true,
  });
  player.addEffect("speed", EFFECT_DURATION_TICKS, {
    amplifier: 1,
    showParticles: true,
  });
  player.addEffect("resistance", EFFECT_DURATION_TICKS, {
    amplifier: 0,
    showParticles: true,
  });
}

/**
 * Dashes the player forward using their current view direction.
 * We only use the horizontal (x, z) component of the view direction so
 * looking up or down doesn't turn the dash into an unintended launch or
 * slam into the ground.
 * @param {import("@minecraft/server").Player} player
 */
function dashForward(player) {
  const view = player.getViewDirection();

  // Flatten to horizontal-only and re-normalize, otherwise looking
  // steeply up/down would shrink the horizontal push unpredictably.
  const horizontalLength = Math.sqrt(view.x * view.x + view.z * view.z);
  if (horizontalLength === 0) return; // Looking perfectly straight up/down — skip the dash.

  const direction = {
    x: view.x / horizontalLength,
    z: view.z / horizontalLength,
  };

  player.applyKnockback(
    { x: direction.x * DASH_HORIZONTAL_STRENGTH, z: direction.z * DASH_HORIZONTAL_STRENGTH },
    DASH_VERTICAL_STRENGTH
  );
}

/**
 * Void-purple particle burst at the player's feet, used both on cast and
 * to visually distinguish Void from every other shard's feedback.
 * @param {import("@minecraft/server").Player} player
 */
function spawnVoidBurst(player) {
  spawnParticleRing(player.dimension, player.location, "minecraft:colored_flame_particle", 2.5, 12, {
    red: 0.6,
    green: 0.0,
    blue: 0.8,
  });
  spawnAbilityParticle(player, "minecraft:colored_flame_particle", undefined, {
    red: 0.6,
    green: 0.0,
    blue: 0.8,
  });
}

/**
 * The ability's full execution — called by shardManager AFTER it has
 * already confirmed the shard is off cooldown and started the new one.
 * @param {import("@minecraft/server").Player} player
 */
function executeVoidForm(player) {
  applyVoidEffects(player);
  dashForward(player);
  spawnVoidBurst(player);
  playAbilitySound(player, "mob.endermen.portal", { pitch: 0.8 });
  sendActionBar(player, "§5Void Form activated!");
}

registerAbility(SHARDS.void.id, executeVoidForm);
