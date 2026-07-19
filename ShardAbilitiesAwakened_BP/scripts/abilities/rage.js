/**
 * rage.js
 *
 * Rage Shard — "Berserk"
 *   - Strength III + Speed III for 10 seconds
 *   - When the buff ends, the backlash hits: Poison
 *   - Cooldown (120s) handled by shardManager, as always.
 *
 * CHANGED AGAIN: this used to apply a scripted +35% damage bonus through
 * combatManager's shared entityHurt listener (comparing against Momentum's
 * combo bonus, taking whichever was larger). That mechanism turned out to
 * be fragile in a way that had nothing to do with our code being wrong —
 * Minecraft's own post-hit invulnerability window was silently absorbing
 * bonus damage smaller than the hit that triggered it. Native status
 * effects don't have that problem: they're applied directly by the
 * engine's own effect system, not routed through the damage pipeline at
 * all, so there's nothing for invulnerability frames to interfere with.
 *
 * This also means Rage no longer registers a damage-bonus provider with
 * combatManager — Momentum is the only one left using that system now.
 * That's fine; the provider system was built to let MULTIPLE sources
 * resolve fairly against each other, and it still does exactly that for
 * however many sources actually use it, one or several.
 */

import { system } from "@minecraft/server";
import { registerAbility } from "../managers/shardManager.js";
import {
  sendActionBar,
  playAbilitySound,
  spawnAbilityParticle,
} from "../utils.js";
import { SHARDS } from "../config.js";

const BUFF_DURATION_SECONDS = 10;
const STRENGTH_AMPLIFIER = 2; // Strength III
const SPEED_AMPLIFIER = 2; // Speed III

const POISON_DURATION_SECONDS = 4;
const POISON_AMPLIFIER = 0; // Poison I

/**
 * @param {import("@minecraft/server").Player} player
 */
function executeBerserk(player) {
  player.addEffect("strength", BUFF_DURATION_SECONDS * 20, {
    amplifier: STRENGTH_AMPLIFIER,
    showParticles: true,
  });
  player.addEffect("speed", BUFF_DURATION_SECONDS * 20, {
    amplifier: SPEED_AMPLIFIER,
    showParticles: true,
  });

  spawnAbilityParticle(player, "minecraft:colored_flame_particle", undefined, {
    red: 0.95,
    green: 0.35,
    blue: 0.15,
  });
  playAbilitySound(player, "mob.ravager.roar", { pitch: 0.9 });
  sendActionBar(player, "§cBerserk activated! §7(the rage will cost you...)");

  // Scheduled for exactly when the buff wears off. Wrapped in try/catch —
  // the player may have logged off in the 10 seconds since activation,
  // and addEffect on a stale/disconnected player reference would throw.
  system.runTimeout(() => {
    try {
      player.addEffect("poison", POISON_DURATION_SECONDS * 20, {
        amplifier: POISON_AMPLIFIER,
        showParticles: true,
      });
      sendActionBar(player, "§2The rage fades... and poisons your blood.");
    } catch {
      // Player disconnected before the backlash landed — nothing to do.
    }
  }, BUFF_DURATION_SECONDS * 20);
}

registerAbility(SHARDS.rage.id, executeBerserk);
