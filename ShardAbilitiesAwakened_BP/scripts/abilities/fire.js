/**
 * fire.js
 *
 * Fire Shard — "Ember Burst"
 *   - Ignites every other entity within ~6 blocks for 4 seconds
 *   - Grants the caster Fire Resistance for 6 seconds (so they don't
 *     immediately catch themselves if standing in their own burst)
 *   - Cooldown (60s) handled by shardManager
 *
 * This file exists to prove the framework's extensibility claim: adding
 * Fire required editing config.js (one new entry) and creating this file.
 * shardManager.js, cooldownManager.js, and main.js's activation listener
 * were NOT touched — only main.js's ability import list grew by one line,
 * which is the one part of the framework explicitly designed to grow.
 */

import { registerAbility } from "../managers/shardManager.js";
import { sendActionBar, playAbilitySound, spawnAbilityParticle } from "../utils.js";
import { SHARDS } from "../config.js";

const IGNITE_RADIUS = 6;
const IGNITE_SECONDS = 4;
const FIRE_RESISTANCE_DURATION_TICKS = 6 * 20; // 6 seconds

/**
 * @param {import("@minecraft/server").Player} caster
 */
function executeEmberBurst(caster) {
  caster.addEffect("fire_resistance", FIRE_RESISTANCE_DURATION_TICKS, {
    amplifier: 0,
    showParticles: false,
  });

  const nearbyEntities = caster.dimension.getEntities({
    location: caster.location,
    maxDistance: IGNITE_RADIUS,
  });

  let ignitedCount = 0;
  for (const entity of nearbyEntities) {
    if (entity.id === caster.id) continue;
    const wasIgnited = entity.setOnFire(IGNITE_SECONDS, true);
    if (wasIgnited) ignitedCount++;
  }

  spawnAbilityParticle(caster, "minecraft:colored_flame_particle", undefined, {
    red: 0.95,
    green: 0.35,
    blue: 0.15,
  });
  playAbilitySound(caster, "fire.ignite", { pitch: 1.0 });
  sendActionBar(
    caster,
    ignitedCount > 0
      ? `§6Ember Burst: ${ignitedCount} target(s) ignited!`
      : "§6Ember Burst!"
  );
}

registerAbility(SHARDS.fire.id, executeEmberBurst);
