/**
 * fire.js
 *
 * Fire Shard — "Ember Burst"
 *   - Ignites every other entity within ~6 blocks for 4 seconds
 *   - Grants the caster Fire Resistance for 6 seconds (so they don't
 *     immediately catch themselves if standing in their own burst)
 *   - FIXED: Now spawns lava and fire ring where the player is looking,
 *     using a raycast to detect the targeted block (~12 blocks away).
 *     If no block is hit, falls back to ~12 blocks in front of the player.
 *   - Cooldown (60s) handled by shardManager
 *
 * HONEST CAVEAT ON THE LAVA/FIRE RING: these are REAL blocks, not a
 * particle illusion, which is what makes them look right — but real fire
 * blocks tick and can spread to adjacent flammable blocks (wood, leaves,
 * wool) during the few seconds they exist, same as any vanilla fire. Our
 * revert only restores the SPECIFIC blocks we placed; it can't undo a
 * spread that happened in the meantime. Low risk in open/stone terrain,
 * real risk if this gets used inside a wooden build. Worth keeping in mind
 * if this becomes a problem in practice — the fix at that point would be
 * to fire-ban the ring blocks from spreading, which is more involved.
 */

import { system, BlockPermutation } from "@minecraft/server";
import { registerAbility } from "../managers/shardManager.js";
import { sendActionBar, playAbilitySound, spawnAbilityParticle, spawnParticleRing } from "../utils.js";
import { SHARDS } from "../config.js";

const IGNITE_RADIUS = 6;
const IGNITE_SECONDS = 4;
const FIRE_RESISTANCE_DURATION_TICKS = 6 * 20; // 6 seconds
const RING_RADIUS = 3; // Larger ring around the lava center
const LAVA_FIRE_DURATION_TICKS = 5 * 20; // 5 seconds, then reverts
const RAYCAST_DISTANCE = 12; // Distance to look for target block

/**
 * Gets the target position where the player is looking using raycast.
 * Falls back to a position ~12 blocks in front if no block is hit.
 * @param {import("@minecraft/server").Player} player
 * @returns {import("@minecraft/server").Vector3}
 */
function getTargetPosition(player) {
  const viewDirection = player.getViewDirection();
  const startPos = {
    x: player.location.x,
    y: player.location.y + player.height, // Start from eye level
    z: player.location.z,
  };

  // Try to get the block the player is looking at
  const blockRay = player.dimension.getBlockFromViewDirection({
    ...startPos,
    ...viewDirection,
  }, RAYCAST_DISTANCE);

  if (blockRay && blockRay.block) {
    // Return the center of the targeted block face
    const block = blockRay.block;
    return {
      x: block.x + 0.5,
      y: block.y,
      z: block.z + 0.5,
    };
  }

  // Fallback: calculate position ~12 blocks in front of player
  const horizontalLength = Math.sqrt(viewDirection.x * viewDirection.x + viewDirection.z * viewDirection.z);
  if (horizontalLength === 0) {
    // Looking straight up/down, just use position in front
    return {
      x: startPos.x,
      y: startPos.y,
      z: startPos.z + RAYCAST_DISTANCE,
    };
  }

  const direction = {
    x: viewDirection.x / horizontalLength,
    z: viewDirection.z / horizontalLength,
  };

  return {
    x: startPos.x + direction.x * RAYCAST_DISTANCE,
    y: startPos.y,
    z: startPos.z + direction.z * RAYCAST_DISTANCE,
  };
}

/**
 * Places lava at the center and a ring of fire around it, remembering the
 * original block at each position so it can be restored later.
 * @param {import("@minecraft/server").Dimension} dimension
 * @param {import("@minecraft/server").Vector3} center
 */
function placeLavaFireRing(dimension, center) {
  const groundY = Math.floor(center.y);
  const positions = [{ x: Math.floor(center.x), y: groundY, z: Math.floor(center.z) }];

  const ringCount = 8;
  for (let i = 0; i < ringCount; i++) {
    const angle = (2 * Math.PI * i) / ringCount;
    positions.push({
      x: Math.round(center.x + Math.cos(angle) * RING_RADIUS),
      y: groundY,
      z: Math.round(center.z + Math.sin(angle) * RING_RADIUS),
    });
  }

  const lavaPermutation = BlockPermutation.resolve("minecraft:lava");
  const firePermutation = BlockPermutation.resolve("minecraft:fire");

  /** @type {Array<{pos: import("@minecraft/server").Vector3, original: import("@minecraft/server").BlockPermutation}>} */
  const restoreList = [];

  positions.forEach((pos, index) => {
    const block = dimension.getBlock(pos);
    if (!block) return; // Unloaded chunk — skip this position entirely.

    restoreList.push({ pos, original: block.permutation });
    block.setPermutation(index === 0 ? lavaPermutation : firePermutation);
  });

  system.runTimeout(() => {
    for (const { pos, original } of restoreList) {
      try {
        const block = dimension.getBlock(pos);
        if (block) block.setPermutation(original);
      } catch {
        // Chunk unloaded or block changed by something else in the
        // meantime — safe to skip reverting that one position.
      }
    }
  }, LAVA_FIRE_DURATION_TICKS);
}

/**
 * @param {import("@minecraft/server").Player} caster
 */
function executeEmberBurst(caster) {
  caster.addEffect("fire_resistance", FIRE_RESISTANCE_DURATION_TICKS, {
    amplifier: 0,
    showParticles: false,
  });

  const targetPosition = getTargetPosition(caster);

  const nearbyEntities = caster.dimension.getEntities({
    location: targetPosition,
    maxDistance: IGNITE_RADIUS,
  });

  let ignitedCount = 0;
  for (const entity of nearbyEntities) {
    if (entity.id === caster.id) continue;
    const wasIgnited = entity.setOnFire(IGNITE_SECONDS, true);
    if (wasIgnited) ignitedCount++;
  }

  placeLavaFireRing(caster.dimension, targetPosition);

  spawnParticleRing(caster.dimension, targetPosition, "minecraft:colored_flame_particle", RING_RADIUS + 1, 12, {
    red: 0.95,
    green: 0.35,
    blue: 0.15,
  });
  spawnAbilityParticle(caster, "minecraft:colored_flame_particle", targetPosition, {
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
