/**
 * sky.js
 *
 * Sky Shard — "Sky Leap"
 *   - Launches the player upward
 *   - Applies Slow Falling for 8 seconds (so the landing doesn't hurt)
 *   - Cooldown (30s) handled by shardManager — shortest cooldown in the
 *     addon, matching its Uncommon rarity and low commitment/impact.
 *
 * Order matters here: we apply Slow Falling BEFORE the upward knockback.
 * If we launched first, there'd be a brief window (before the effect
 * packet reaches the client/simulation) where the player is airborne
 * without the effect active. Applying the effect first removes that gap.
 */

import { registerAbility } from "../managers/shardManager.js";
import {
  sendActionBar,
  playAbilitySound,
  spawnAbilityParticle,
} from "../utils.js";
import { SHARDS } from "../config.js";

const SLOW_FALLING_DURATION_TICKS = 8 * 20; // 8 seconds
const LAUNCH_VERTICAL_STRENGTH = 1.4;

function executeSkyLeap(player) {
  player.addEffect("slow_falling", SLOW_FALLING_DURATION_TICKS, {
    amplifier: 0,
    showParticles: true,
  });

  // No horizontal force — Sky Leap is a vertical launch, not a dash.
  player.applyKnockback({ x: 0, z: 0 }, LAUNCH_VERTICAL_STRENGTH);

  spawnAbilityParticle(player, "minecraft:colored_flame_particle", undefined, {
    red: 0.35,
    green: 0.7,
    blue: 0.95,
  });
  playAbilitySound(player, "mob.shulker.shoot", { pitch: 1.2 });
  sendActionBar(player, "§bSky Leap!");
}

registerAbility(SHARDS.sky.id, executeSkyLeap);
