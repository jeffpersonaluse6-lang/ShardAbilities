/**
 * shadow.js
 *
 * Shadow Shard — "Shadow Cloak"
 *   - Invisibility for 6 seconds
 *   - Cooldown (120s) handled by shardManager
 *
 * The simplest ability in the addon — a good reminder that the framework
 * shouldn't force complexity where none is needed. Not every shard needs
 * a dash, a teleport, or an area query.
 */

import { registerAbility } from "../managers/shardManager.js";
import {
  sendActionBar,
  playAbilitySound,
  spawnAbilityParticle,
} from "../utils.js";
import { SHARDS } from "../config.js";

const EFFECT_DURATION_TICKS = 6 * 20; // 6 seconds

function executeShadowCloak(player) {
  player.addEffect("invisibility", EFFECT_DURATION_TICKS, {
    amplifier: 0,
    // Deliberately false: showParticles would visually announce "a cloaked
    // player is standing here," undermining the entire point of the ability.
    showParticles: false,
  });

  spawnAbilityParticle(player, "minecraft:colored_flame_particle", undefined, {
    red: 0.1,
    green: 0.1,
    blue: 0.12,
  });
  playAbilitySound(player, "mob.wither.spawn", { pitch: 1.6, volume: 0.4 });
  sendActionBar(player, "§8Shadow Cloak activated!");
}

registerAbility(SHARDS.shadow.id, executeShadowCloak);
