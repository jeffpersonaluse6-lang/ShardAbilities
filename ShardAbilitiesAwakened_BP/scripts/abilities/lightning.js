/**
 * lightning.js
 *
 * Lightning Shard — "Thunderclap"
 *   - Strikes a lightning bolt at whatever the caster is looking at
 *   - Grants the caster Speed II for 4 seconds (a jolt of momentum)
 *   - Cooldown (75s) handled by shardManager
 *
 * The interesting design problem here: "strike what the player is looking
 * at" has no single reliable data source. An entity might be in the way,
 * or terrain might be in the way, or NOTHING might be in the way (looking
 * out over open air). A raycast-only approach that assumes a hit always
 * exists would silently do nothing in that last case — a bad player
 * experience for an ability that just went on a 75-second cooldown.
 *
 * So this uses a three-tier fallback chain, each strictly more permissive
 * than the last:
 *   1. Is an entity directly in view within range? Strike them.
 *   2. Otherwise, is solid ground in view within range? Strike that spot.
 *   3. Otherwise (open sky/void), strike a fixed point straight ahead.
 * This guarantees Thunderclap always visibly does something, which matters
 * more for player trust than technical elegance.
 */

import { registerAbility } from "../managers/shardManager.js";
import { sendActionBar, playAbilitySound, spawnAbilityParticle } from "../utils.js";
import { SHARDS } from "../config.js";

const STRIKE_RANGE = 20;
const SPEED_DURATION_TICKS = 4 * 20; // 4 seconds

/**
 * Determines the best available strike location using the fallback chain
 * described above.
 * @param {import("@minecraft/server").Player} caster
 * @returns {import("@minecraft/server").Vector3}
 */
function findStrikeLocation(caster) {
  const origin = caster.getHeadLocation();
  const direction = caster.getViewDirection();

  // Tier 1: entity in view.
  const entityHits = caster.dimension.getEntitiesFromRay(origin, direction, {
    maxDistance: STRIKE_RANGE,
  });
  const validEntityHit = entityHits
    .filter((hit) => hit.entity.id !== caster.id)
    .sort((a, b) => a.distance - b.distance)[0];
  if (validEntityHit) {
    return validEntityHit.entity.location;
  }

  // Tier 2: solid terrain in view.
  const blockHit = caster.dimension.getBlockFromRay(origin, direction, {
    maxDistance: STRIKE_RANGE,
  });
  if (blockHit) {
    return blockHit.block.location;
  }

  // Tier 3: nothing in the way — strike a fixed point straight ahead.
  return {
    x: origin.x + direction.x * STRIKE_RANGE,
    y: origin.y + direction.y * STRIKE_RANGE,
    z: origin.z + direction.z * STRIKE_RANGE,
  };
}

/**
 * @param {import("@minecraft/server").Player} caster
 */
function executeThunderclap(caster) {
  const strikeLocation = findStrikeLocation(caster);

  caster.dimension.spawnEntity("minecraft:lightning_bolt", strikeLocation);

  caster.addEffect("speed", SPEED_DURATION_TICKS, {
    amplifier: 1,
    showParticles: true,
  });

  spawnAbilityParticle(caster, "minecraft:colored_flame_particle", undefined, {
    red: 0.95,
    green: 0.95,
    blue: 0.2,
  });
  playAbilitySound(caster, "shard.lightning.activate", { pitch: 1.0 });
  sendActionBar(caster, "§eThunderclap!");
}

registerAbility(SHARDS.lightning.id, executeThunderclap);
