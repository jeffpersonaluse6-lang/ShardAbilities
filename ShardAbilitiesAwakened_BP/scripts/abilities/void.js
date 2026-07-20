/**
 * void.js
 *
 * Void Shard — "Void Form"
 *   - CONTINUOUSLY pulls every other player within ~10 blocks toward the
 *     caster for the full 8-second duration (not a single yank) — a
 *     gravity well, not a one-time tug
 *   - Grants Strength scaled to the highest number of players caught in
 *     the pull at any point during the cast, capped at Strength V
 *   - Cooldown (180s) handled by shardManager
 *
 * Runs as a system.runInterval every few ticks for the cast's duration,
 * re-checking who's in range each pulse — so someone who runs INTO range
 * partway through still gets caught, and someone who escapes range stops
 * being pulled, rather than the initial player list being locked in at
 * the moment of cast.
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

const PULL_RADIUS = 10;
const EFFECT_DURATION_TICKS = 8 * 20; // 8 seconds
const PULL_INTERVAL_TICKS = 4; // pulse the pull every 4 ticks, not every tick — plenty smooth, far cheaper
const PULL_HORIZONTAL_STRENGTH = 0.9; // weaker per-pulse than the old single yank, since this fires repeatedly
const PULL_VERTICAL_STRENGTH = 0.1;
const MAX_STRENGTH_AMPLIFIER = 4; // caps at Strength V

function pullTowardCaster(caster, target) {
  const dx = caster.location.x - target.location.x;
  const dz = caster.location.z - target.location.z;
  const horizontalLength = Math.sqrt(dx * dx + dz * dz);
  if (horizontalLength === 0) return;

  target.applyKnockback(
    {
      x: (dx / horizontalLength) * PULL_HORIZONTAL_STRENGTH,
      z: (dz / horizontalLength) * PULL_HORIZONTAL_STRENGTH,
    },
    PULL_VERTICAL_STRENGTH
  );
}

function executeVoidForm(caster) {
  spawnParticleRing(caster.dimension, caster.location, "minecraft:colored_flame_particle", 2.5, 12, {
    red: 0.6, green: 0.0, blue: 0.8,
  });
  spawnAbilityParticle(caster, "minecraft:colored_flame_particle", undefined, {
    red: 0.6, green: 0.0, blue: 0.8,
  });
  playAbilitySound(caster, "mob.endermen.portal", { pitch: 0.8 });
  sendActionBar(caster, "§5Void Form activated!");

  let ticksElapsed = 0;
  let peakPulledCount = 0;

  const intervalId = system.runInterval(() => {
    ticksElapsed += PULL_INTERVAL_TICKS;

    let currentlyPulled = 0;
    const nearbyPlayers = caster.dimension.getPlayers({
      location: caster.location,
      maxDistance: PULL_RADIUS,
    });

    for (const target of nearbyPlayers) {
      if (target.id === caster.id) continue;
      pullTowardCaster(caster, target);
      currentlyPulled++;
    }
    if (currentlyPulled > peakPulledCount) peakPulledCount = currentlyPulled;

    if (ticksElapsed >= EFFECT_DURATION_TICKS) {
      system.clearRun(intervalId);

      if (peakPulledCount > 0) {
        const amplifier = Math.min(peakPulledCount - 1, MAX_STRENGTH_AMPLIFIER);
        caster.addEffect("strength", EFFECT_DURATION_TICKS, { amplifier, showParticles: true });
        sendActionBar(caster, `§5Void Form: pulled up to ${peakPulledCount} target(s), Strength ${amplifier + 1}!`);
      } else {
        sendActionBar(caster, "§5Void Form: no targets nearby.");
      }
    }
  }, PULL_INTERVAL_TICKS);
}

registerAbility(SHARDS.void.id, executeVoidForm);
