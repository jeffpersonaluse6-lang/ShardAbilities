/**
 * ice.js
 *
 * Ice Shard — "Frostbite"
 *   - Every other entity within ~6 blocks is slowed heavily for 5 seconds
 *   - Cooldown (50s) handled by shardManager
 *
 * Structurally near-identical to vision.js's area-targeting loop
 * (getEntities by radius, skip self, apply an effect to each). That
 * repetition is intentional, not an oversight — Vision and Frostbite are
 * both "affect everyone nearby" abilities, so they SHOULD look alike. If a
 * third or fourth ability needed this same shape, that would be the
 * signal to extract a shared `forEachNearbyEntity()` helper into utils.js.
 * Two occurrences isn't that signal yet — abstracting too early just adds
 * indirection for no real reuse benefit.
 */

import { registerAbility } from "../managers/shardManager.js";
import { sendActionBar, playAbilitySound, spawnAbilityParticle } from "../utils.js";
import { SHARDS } from "../config.js";

const FROSTBITE_RADIUS = 6;
const SLOWNESS_DURATION_TICKS = 5 * 20; // 5 seconds
const SLOWNESS_AMPLIFIER = 3; // Slowness IV — a heavy, noticeable freeze

/**
 * @param {import("@minecraft/server").Player} caster
 */
function executeFrostbite(caster) {
  const nearbyEntities = caster.dimension.getEntities({
    location: caster.location,
    maxDistance: FROSTBITE_RADIUS,
  });

  let frozenCount = 0;
  for (const entity of nearbyEntities) {
    if (entity.id === caster.id) continue;

    entity.addEffect("slowness", SLOWNESS_DURATION_TICKS, {
      amplifier: SLOWNESS_AMPLIFIER,
      showParticles: true,
    });
    frozenCount++;
  }

  spawnAbilityParticle(caster, "minecraft:colored_flame_particle", undefined, {
    red: 0.4,
    green: 0.85,
    blue: 0.95,
  });
  playAbilitySound(caster, "shard.ice.activate", { pitch: 1.0 });
  sendActionBar(
    caster,
    frozenCount > 0 ? `§bFrostbite: ${frozenCount} target(s) frozen!` : "§bFrostbite!"
  );
}

registerAbility(SHARDS.ice.id, executeFrostbite);
