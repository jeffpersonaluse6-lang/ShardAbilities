/**
 * vision.js
 *
 * Vision Shard — "Hunter's Sight"
 *   - Every OTHER player within ~30 blocks is highlighted for 8 seconds
 *   - Cooldown (45s) handled by shardManager
 *
 * "Highlighted" maps directly onto Bedrock's native "glowing" effect — the
 * same outline-through-walls effect Glow Squid ink and spectral arrows use.
 * That's the closest (and actually exact) Bedrock equivalent the spec asks
 * for, so no approximation is needed here, unlike Rage's damage boost.
 *
 * Why dimension.getPlayers({location, maxDistance}) instead of looping
 * world.getAllPlayers() and computing distance by hand: the engine does the
 * spatial filtering internally, which is both less code and cheaper than a
 * manual per-player Pythagorean check, especially as player counts grow.
 */

import { registerAbility } from "../managers/shardManager.js";
import { sendActionBar, playAbilitySound, spawnAbilityParticle, spawnParticleRing } from "../utils.js";
import { SHARDS, DEBUG_MODE } from "../config.js";

const HIGHLIGHT_RADIUS = 30;
const HIGHLIGHT_DURATION_TICKS = 8 * 20; // 8 seconds
const VISION_COLOR = { red: 0.9, green: 0.7, blue: 0.1 };

/**
 * @param {import("@minecraft/server").Player} caster
 */
function executeHuntersSight(caster) {
  const nearbyPlayers = caster.dimension.getPlayers({
    location: caster.location,
    maxDistance: HIGHLIGHT_RADIUS,
  });

  if (DEBUG_MODE) {
    caster.sendMessage(
      `§b[debug] found ${nearbyPlayers.length} player(s) within ${HIGHLIGHT_RADIUS} blocks (includes self)`
    );
  }

  let highlightedCount = 0;
  for (const target of nearbyPlayers) {
    if (target.id === caster.id) continue; // Don't highlight yourself.

    try {
      target.addEffect("glowing", HIGHLIGHT_DURATION_TICKS, {
        amplifier: 0,
        showParticles: false,
      });
      if (DEBUG_MODE) caster.sendMessage(`§b[debug] addEffect(glowing) succeeded on ${target.name}`);
    } catch (e) {
      if (DEBUG_MODE) caster.sendMessage(`§c[debug] addEffect(glowing) FAILED on ${target.name}: ${e.message}`);
    }

    // A small ring at each revealed target's own feet — marks exactly who
    // got caught by this cast, distinct from the caster's own burst below.
    spawnParticleRing(target.dimension, target.location, "minecraft:colored_flame_particle", 1, 8, VISION_COLOR);
    highlightedCount++;
  }

  spawnAbilityParticle(caster, "minecraft:colored_flame_particle", undefined, VISION_COLOR);

  try {
    playAbilitySound(caster, "mob.enderman.stare", { pitch: 1.3 });
  } catch (e) {
    if (DEBUG_MODE) caster.sendMessage(`§c[debug] playSound FAILED: ${e.message}`);
  }

  sendActionBar(
    caster,
    highlightedCount > 0
      ? `§eHunter's Sight: ${highlightedCount} target(s) revealed!`
      : "§eHunter's Sight: no targets nearby."
  );
}

registerAbility(SHARDS.vision.id, executeHuntersSight);
