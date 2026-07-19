/**
 * water.js
 *
 * Water Shard — "Tidal Wave"
 *   - Knocks every other entity within ~5 blocks radially away from caster
 *   - Grants the caster Water Breathing for 8 seconds
 *   - Cooldown (60s) handled by shardManager
 *
 * Unlike Void/Sky's knockback (a single fixed direction), Tidal Wave needs
 * a DIFFERENT push direction per target — outward from the caster, like a
 * shockwave. So instead of one applyKnockback call, we compute a per-target
 * direction vector (target position minus caster position) and push each
 * entity along its own vector.
 *
 * This also uses this addon's first fully custom sound event
 * ("shard.water.activate") instead of a borrowed vanilla one — see
 * RP/sounds/sound_definitions.json for how that's wired up.
 */

import { registerAbility } from "../managers/shardManager.js";
import { sendActionBar, playAbilitySound, spawnParticleRing } from "../utils.js";
import { SHARDS } from "../config.js";

const WAVE_RADIUS = 5;
const KNOCKBACK_HORIZONTAL_STRENGTH = 4.5; // was 1.6 — scaled up for a 10-20 block push
const KNOCKBACK_VERTICAL_STRENGTH = 0.6; // was 0.3 — more hangtime carries the horizontal push further
const WATER_BREATHING_DURATION_TICKS = 8 * 20; // 8 seconds

/**
 * @param {import("@minecraft/server").Player} caster
 */
function executeTidalWave(caster) {
  caster.addEffect("water_breathing", WATER_BREATHING_DURATION_TICKS, {
    amplifier: 0,
    showParticles: false,
  });

  const nearbyEntities = caster.dimension.getEntities({
    location: caster.location,
    maxDistance: WAVE_RADIUS,
  });

  let pushedCount = 0;
  for (const entity of nearbyEntities) {
    if (entity.id === caster.id) continue;

    const dx = entity.location.x - caster.location.x;
    const dz = entity.location.z - caster.location.z;
    const horizontalLength = Math.sqrt(dx * dx + dz * dz);

    // Entity is standing exactly on top of the caster (rare, but possible) —
    // there's no meaningful "outward" direction, so just skip it rather
    // than divide by zero.
    if (horizontalLength === 0) continue;

    entity.applyKnockback(
      {
        x: (dx / horizontalLength) * KNOCKBACK_HORIZONTAL_STRENGTH,
        z: (dz / horizontalLength) * KNOCKBACK_HORIZONTAL_STRENGTH,
      },
      KNOCKBACK_VERTICAL_STRENGTH
    );
    pushedCount++;
  }

  spawnParticleRing(caster.dimension, caster.location, "minecraft:colored_flame_particle", WAVE_RADIUS, 16, {
    red: 0.25,
    green: 0.45,
    blue: 0.95,
  });
  playAbilitySound(caster, "shard.water.activate", { pitch: 1.0 });
  sendActionBar(
    caster,
    pushedCount > 0 ? `§bTidal Wave: ${pushedCount} target(s) pushed back!` : "§bTidal Wave!"
  );
}

registerAbility(SHARDS.water.id, executeTidalWave);
