/**
 * sky.js
 *
 * Sky Shard — "Sky Leap"
 *   - Launches the player up to ~40 blocks high
 *   - No Slow Falling — landing damage is a real risk
 *   - Cooldown (30s) handled by shardManager
 *
 * WHY THIS IS A CONTROLLED ASCENT, NOT A SINGLE KNOCKBACK IMPULSE:
 * A single applyKnockback() launch is governed by Minecraft's actual
 * gravity/drag physics, which aren't something we can precisely predict
 * from script-side constants — tuning a knockback strength to reliably
 * hit "~40 blocks" would require a lot of live trial and error and would
 * still vary somewhat by version/platform. Instead, this teleports the
 * player upward in small steps over about a second, stopping early if it
 * hits a ceiling — this GUARANTEES the height requested regardless of
 * physics quirks. The player then falls back down under normal gravity
 * once the ascent ends (no forced landing, no Slow Falling).
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

const TARGET_HEIGHT = 40;
const ASCENT_TICKS = 20; // ~1 second climb
const HEIGHT_PER_TICK = TARGET_HEIGHT / ASCENT_TICKS;
const SKY_COLOR = { red: 0.35, green: 0.7, blue: 0.95 };

function executeSkyLeap(player) {
  const origin = player.location;
  let ticksElapsed = 0;

  spawnAbilityParticle(player, "minecraft:colored_flame_particle", undefined, SKY_COLOR);
  playAbilitySound(player, "mob.shulker.shoot", { pitch: 1.2 });
  sendActionBar(player, "§bSky Leap!");

  const intervalId = system.runInterval(() => {
    ticksElapsed++;
    if (ticksElapsed > ASCENT_TICKS) {
      system.clearRun(intervalId);
      return;
    }

    const nextY = origin.y + HEIGHT_PER_TICK * ticksElapsed;
    const nextLocation = { x: origin.x, y: nextY, z: origin.z };

    // Stop early if a ceiling is in the way, rather than teleporting the
    // player into a solid block.
    let block;
    try {
      block = player.dimension.getBlock(nextLocation);
    } catch {
      block = undefined; // Unloaded chunk — stop the ascent here.
    }
    if (block && !block.isAir) {
      system.clearRun(intervalId);
      return;
    }

    try {
      player.teleport(nextLocation);
    } catch {
      system.clearRun(intervalId);
      return;
    }

    // A ring every few ticks on the way up, not every single tick —
    // gives a rising trail effect without spawning 20 rings in one second.
    if (ticksElapsed % 4 === 0) {
      spawnParticleRing(player.dimension, nextLocation, "minecraft:colored_flame_particle", 1.5, 8, SKY_COLOR);
    }
  }, 1);
}

registerAbility(SHARDS.sky.id, executeSkyLeap);
