/**
 * shadow.js
 *
 * Shadow Shard — "Shadow Cloak"
 *   - Invisibility for 10 seconds (was 6)
 *   - Also clears the player's nametag for the duration — vanilla
 *     Invisibility alone still shows your name floating above your head,
 *     which defeats the point of a stealth ability. Restored when the
 *     effect ends.
 *   - Cooldown (120s) handled by shardManager
 *
 * HONEST UNCERTAINTY: clearing player.nameTag reliably hides a MOB's
 * overhead name, but I'm not fully certain it also hides a PLAYER's
 * nametag the same way on every platform — some Bedrock clients render
 * player nameplates through a separate identity system rather than the
 * scriptable nameTag property. Worth confirming in your own testing;
 * if the name still shows, tell me and we'll look at alternatives (like
 * a scoreboard-based nametag visibility rule instead).
 */

import { system } from "@minecraft/server";
import { registerAbility } from "../managers/shardManager.js";
import {
  sendActionBar,
  playAbilitySound,
  spawnAbilityParticle,
} from "../utils.js";
import { SHARDS } from "../config.js";

const EFFECT_DURATION_TICKS = 10 * 20; // 10 seconds

function executeShadowCloak(player) {
  player.addEffect("invisibility", EFFECT_DURATION_TICKS, {
    amplifier: 0,
    // Deliberately false: showParticles would visually announce "a cloaked
    // player is standing here," undermining the entire point of the ability.
    showParticles: false,
  });

  const originalNameTag = player.nameTag;
  player.nameTag = "";

  spawnAbilityParticle(player, "minecraft:colored_flame_particle", undefined, {
    red: 0.1,
    green: 0.1,
    blue: 0.12,
  });
  playAbilitySound(player, "mob.wither.spawn", { pitch: 1.6, volume: 0.4 });
  sendActionBar(player, "§8Shadow Cloak activated!");

  system.runTimeout(() => {
    try {
      player.nameTag = originalNameTag;
    } catch {
      // Player disconnected before the cloak wore off — nothing to restore.
    }
  }, EFFECT_DURATION_TICKS);
}

registerAbility(SHARDS.shadow.id, executeShadowCloak);
