/**
 * void.js
 *
 * Void Shard — "Void Form"
 *   - Speed II, Resistance I for 8 seconds
 *   - NEW: Suction effect pulls all nearby enemies/players (within ~15 blocks)
 *     toward the caster
 *   - Strength level scales with number of enemies pulled:
 *     1 enemy = Strength I, 2 enemies = Strength II, etc.
 *   - Cooldown (180s) and activation flow are handled entirely by
 *     shardManager — this file ONLY contains what makes Void unique.
 *
 * This file is the template the other five abilities will follow:
 * one default export-free module that calls registerAbility() once.
 */

import { system } from "@minecraft/server";
import { registerAbility } from "../managers/shardManager.js";
import {
  sendActionBar,
  playAbilitySound,
  spawnAbilityParticle,
  spawnParticleRing,
} from "../utils.js";
import { SHARDS } from "../config.js";

const EFFECT_DURATION_TICKS = 8 * 20; // 8 seconds
const SUCTION_RADIUS = 15; // Pull enemies within this radius
const SUCTION_PULL_STRENGTH = 1.5; // Knockback force toward caster
const TICKS_PER_PULL = 4; // How often to apply pull (in ticks)
const TOTAL_PULL_DURATION_TICKS = 2 * 20; // 2 seconds of pulling

/**
 * Applies the Void Form status effects.
 * Strength amplifier scales with number of enemies pulled.
 * @param {import("@minecraft/server").Player} player
 * @param {number} enemiesPulled - Number of enemies successfully pulled
 */
function applyVoidEffects(player, enemiesPulled) {
  // Strength scales with enemies pulled: 1 enemy = level 1, 2 enemies = level 2, etc.
  const strengthAmplifier = Math.max(0, enemiesPulled - 1);
  player.addEffect("strength", EFFECT_DURATION_TICKS, {
    amplifier: strengthAmplifier,
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
 * Applies suction effect to pull all nearby entities toward the caster.
 * Returns the count of entities pulled.
 * @param {import("@minecraft/server").Player} caster
 * @returns {number} - Number of entities pulled
 */
function applySuctionEffect(caster) {
  const casterLocation = caster.location;
  let pulledCount = 0;

  const nearbyEntities = caster.dimension.getEntities({
    location: casterLocation,
    maxDistance: SUCTION_RADIUS,
  });

  for (const entity of nearbyEntities) {
    if (entity.id === caster.id) continue;
    
    // Calculate direction from entity to caster
    const dx = casterLocation.x - entity.location.x;
    const dz = casterLocation.z - entity.location.z;
    const distance = Math.sqrt(dx * dx + dz * dz);
    
    if (distance === 0) continue;

    // Normalize and apply knockback toward caster
    const direction = {
      x: (dx / distance) * SUCTION_PULL_STRENGTH,
      z: (dz / distance) * SUCTION_PULL_STRENGTH,
    };

    entity.applyKnockback(direction, 0.1);
    pulledCount++;
  }

  return pulledCount;
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
  // Apply suction effect to pull all nearby enemies toward the caster
  const enemiesPulled = applySuctionEffect(player);
  
  // Apply effects with Strength scaled based on number of enemies pulled
  applyVoidEffects(player, enemiesPulled);
  
  spawnVoidBurst(player);
  playAbilitySound(player, "mob.endermen.portal", { pitch: 0.8 });
  sendActionBar(player, `§5Void Form activated! Pulled ${enemiesPulled} enemy(s).`);
}

registerAbility(SHARDS.void.id, executeVoidForm);
