/**
 * sky.js
 *
 * Sky Shard — "Sky Leap"
 *   - Launches the player upward, higher than before
 *   - No Slow Falling anymore — landing damage is a real risk now,
 *     matching the requested "remove the safety net" change.
 *   - Cooldown (30s) handled by shardManager — shortest cooldown in the
 *     addon, matching its Uncommon rarity and low commitment/impact.
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

const LAUNCH_VERTICAL_STRENGTH = 2.0; // was 1.4 — noticeably higher arc

function executeSkyLeap(player) {
  // No horizontal force — Sky Leap is a vertical launch, not a dash.
  player.applyKnockback({ x: 0, z: 0 }, LAUNCH_VERTICAL_STRENGTH);

  const skyColor = { red: 0.35, green: 0.7, blue: 0.95 };
  spawnAbilityParticle(player, "minecraft:colored_flame_particle", undefined, skyColor);

  // Three rings at increasing height, staggered a couple ticks apart, so
  // it reads as a rising burst chasing the player upward rather than one
  // flat ring at their feet.
  const origin = player.location;
  for (let i = 1; i <= 3; i++) {
    system.runTimeout(() => {
      try {
        spawnParticleRing(
          player.dimension,
          { x: origin.x, y: origin.y + i * 1.2, z: origin.z },
          "minecraft:colored_flame_particle",
          1.5 + i * 0.4,
          10,
          skyColor
        );
      } catch {
        // Player may have moved out of a loaded chunk mid-launch — skip.
      }
    }, i * 2);
  }

  playAbilitySound(player, "mob.shulker.shoot", { pitch: 1.2 });
  sendActionBar(player, "§bSky Leap!");
}

registerAbility(SHARDS.sky.id, executeSkyLeap);
