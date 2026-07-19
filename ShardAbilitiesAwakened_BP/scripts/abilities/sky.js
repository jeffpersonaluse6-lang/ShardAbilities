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

import { registerAbility } from "../managers/shardManager.js";
import {
  sendActionBar,
  playAbilitySound,
  spawnAbilityParticle,
} from "../utils.js";
import { SHARDS } from "../config.js";

const LAUNCH_VERTICAL_STRENGTH = 2.0; // was 1.4 — noticeably higher arc

function executeSkyLeap(player) {
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
