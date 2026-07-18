/**
 * ender.js
 *
 * Ender Shard — "Blink"
 *   - Teleports the player up to ~20 blocks in their view direction
 *   - Avoids teleporting the player inside solid blocks
 *   - Cooldown (90s) handled by shardManager
 *
 * How the obstruction check works:
 * A single raycast only tells you the FIRST block your line of sight hits —
 * it doesn't tell you where along that path is still safe to stand. Instead,
 * we walk outward from the player in fixed steps, checking both the "feet"
 * and "head" block at each step. We remember the last step that was fully
 * clear (both blocks non-air) and stop as soon as we hit an obstruction,
 * unloaded chunk, or the max distance. This is the same mental model as a
 * blink/teleport ability in most action games: walk back from the wall,
 * don't just trust the far endpoint.
 *
 * We check block.isAir rather than block.isSolid: isAir is a long-stable
 * property, while isSolid is still flagged pre-release in the current
 * stable docs. Treating "not air" as "not safe" is slightly more
 * conservative (won't blink through things like open trapdoors) but keeps
 * this ability built entirely on stable API surface.
 */

import { registerAbility } from "../managers/shardManager.js";
import {
  sendActionBar,
  playAbilitySound,
  spawnAbilityParticle,
} from "../utils.js";
import { SHARDS } from "../config.js";

const MAX_BLINK_DISTANCE = 20;
const STEP_SIZE = 1;

/**
 * Finds the furthest safe point along the player's view direction.
 * @param {import("@minecraft/server").Player} player
 * @returns {import("@minecraft/server").Vector3}
 */
function findSafeBlinkLocation(player) {
  const dimension = player.dimension;
  const origin = player.location;
  const direction = player.getViewDirection();

  let safeLocation = origin;

  for (let distance = STEP_SIZE; distance <= MAX_BLINK_DISTANCE; distance += STEP_SIZE) {
    const point = {
      x: origin.x + direction.x * distance,
      y: origin.y + direction.y * distance,
      z: origin.z + direction.z * distance,
    };

    const feetBlock = dimension.getBlock(point);
    const headBlock = dimension.getBlock({ x: point.x, y: point.y + 1, z: point.z });

    // Unloaded chunk ahead — stop extending rather than risk teleporting
    // somewhere we can't verify is safe.
    if (!feetBlock || !headBlock) break;

    if (!feetBlock.isAir || !headBlock.isAir) break; // Obstruction found — stop here.

    safeLocation = point;
  }

  return safeLocation;
}

function executeBlink(player) {
  const destination = findSafeBlinkLocation(player);

  // Particle/sound at the origin first, so the "departure" reads clearly
  // before the player's position actually changes.
  spawnAbilityParticle(player, "minecraft:colored_flame_particle", undefined, {
    red: 0.2,
    green: 0.9,
    blue: 0.25,
  });
  playAbilitySound(player, "mob.endermen.portal", { pitch: 1.4 });

  player.teleport(destination, { keepVelocity: false });

  spawnAbilityParticle(player, "minecraft:colored_flame_particle", destination, {
    red: 0.2,
    green: 0.9,
    blue: 0.25,
  });
  sendActionBar(player, "§dBlink!");
}

registerAbility(SHARDS.ender.id, executeBlink);
