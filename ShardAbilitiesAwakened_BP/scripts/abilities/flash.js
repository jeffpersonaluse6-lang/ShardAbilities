/**
 * flash.js
 *
 * Flash Shard — "Flashstep" (replaces Fire Shard)
 *   - Activate to start a 30-second window: every 10 blocks you walk
 *     during that window increases your Speed level by one stack
 *     (Speed I at 10 blocks, Speed II at 20, Speed III at 30, up to a
 *     cap of Speed V at 50 blocks)
 *   - Ends automatically after 30 seconds regardless of distance covered
 *   - Cooldown (60s) handled by shardManager
 *
 * Distance is tracked by sampling the player's position every few ticks
 * and summing the straight-line distance between samples — cheap (a
 * handful of subtractions and one sqrt every quarter-second), not a
 * per-tick cost, and self-cleans when the 30s window ends since the
 * interval clears itself rather than running indefinitely.
 */

import { system } from "@minecraft/server";
import { registerAbility } from "../managers/shardManager.js";
import {
  sendActionBar,
  playAbilitySound,
  spawnAbilityParticle,
} from "../utils.js";
import { SHARDS } from "../config.js";

const WINDOW_DURATION_TICKS = 30 * 20; // 30 seconds
const SAMPLE_INTERVAL_TICKS = 5; // check distance 4x/second, not every tick
const BLOCKS_PER_LEVEL = 10;
const MAX_SPEED_AMPLIFIER = 4; // caps at Speed V (50 blocks walked)
const FLASH_COLOR = { red: 0.9, green: 0.95, blue: 0.3 };

function executeFlashstep(player) {
  let lastPosition = player.location;
  let distanceAccumulated = 0;
  let currentLevel = 0;
  let ticksElapsed = 0;

  spawnAbilityParticle(player, "minecraft:colored_flame_particle", undefined, FLASH_COLOR);
  playAbilitySound(player, "mob.horse.gallop", { pitch: 1.3 });
  sendActionBar(player, "§eFlashstep activated! Keep moving...");

  const intervalId = system.runInterval(() => {
    ticksElapsed += SAMPLE_INTERVAL_TICKS;
    if (ticksElapsed >= WINDOW_DURATION_TICKS) {
      system.clearRun(intervalId);
      sendActionBar(player, "§eFlashstep ended.");
      return;
    }

    let currentPosition;
    try {
      currentPosition = player.location;
    } catch {
      system.clearRun(intervalId); // Player disconnected.
      return;
    }

    const dx = currentPosition.x - lastPosition.x;
    const dz = currentPosition.z - lastPosition.z;
    distanceAccumulated += Math.sqrt(dx * dx + dz * dz);
    lastPosition = currentPosition;

    const targetLevel = Math.min(
      MAX_SPEED_AMPLIFIER,
      Math.floor(distanceAccumulated / BLOCKS_PER_LEVEL)
    );

    if (targetLevel > currentLevel) {
      currentLevel = targetLevel;
      const remainingTicks = WINDOW_DURATION_TICKS - ticksElapsed;
      try {
        player.addEffect("speed", remainingTicks, { amplifier: currentLevel, showParticles: true });
        sendActionBar(player, `§eFlashstep: Speed ${currentLevel + 1}!`);
      } catch {
        system.clearRun(intervalId); // Player disconnected mid-window.
      }
    }
  }, SAMPLE_INTERVAL_TICKS);
}

registerAbility(SHARDS.flash.id, executeFlashstep);
