/**
 * shadow.js
 *
 * Shadow Shard — "Shadow Cloak"
 *   - Invisibility for 10 seconds
 *   - Nametag cleared for the duration
 *   - NEW: armor is temporarily UNEQUIPPED (not just hidden) for the
 *     duration, then restored
 *   - Cooldown (120s) handled by shardManager
 *
 * IMPORTANT GAMEPLAY TRADE-OFF, NOT JUST A VISUAL ONE: Bedrock's Script
 * API has no way to make worn armor invisible while it's still equipped
 * and providing protection — the only way to make it visually disappear
 * is to actually remove it. That means for these 10 seconds, the player
 * is ACTUALLY UNARMORED, not just invisible-looking. If that's not the
 * trade-off you want, the alternative is leaving armor equipped and
 * visible (which is how most games' invisibility effects actually work —
 * gear staying visible is the norm, not the exception). Worth confirming
 * this is really what you want after testing it once.
 */

import { system, EquipmentSlot } from "@minecraft/server";
import { registerAbility } from "../managers/shardManager.js";
import {
  sendActionBar,
  playAbilitySound,
  spawnAbilityParticle,
  spawnParticleRing,
} from "../utils.js";
import { SHARDS } from "../config.js";

const EFFECT_DURATION_TICKS = 10 * 20; // 10 seconds
const ARMOR_SLOTS = [EquipmentSlot.Head, EquipmentSlot.Chest, EquipmentSlot.Legs, EquipmentSlot.Feet];

function executeShadowCloak(player) {
  player.addEffect("invisibility", EFFECT_DURATION_TICKS, {
    amplifier: 0,
    showParticles: false,
  });

  const originalNameTag = player.nameTag;
  player.nameTag = "";

  const equippable = player.getComponent("minecraft:equippable");
  /** @type {Array<{slot: string, item: import("@minecraft/server").ItemStack | undefined}>} */
  const removedArmor = [];

  if (equippable) {
    for (const slot of ARMOR_SLOTS) {
      try {
        const item = equippable.getEquipment(slot);
        if (item) {
          removedArmor.push({ slot, item });
          equippable.setEquipment(slot, undefined);
        }
      } catch {
        // A specific slot failed to read/clear — skip it rather than
        // abort the whole cloak over one slot.
      }
    }
  }

  spawnParticleRing(player.dimension, player.location, "minecraft:colored_flame_particle", 1.5, 10, {
    red: 0.1, green: 0.1, blue: 0.12,
  });
  spawnAbilityParticle(player, "minecraft:colored_flame_particle", undefined, {
    red: 0.1, green: 0.1, blue: 0.12,
  });
  playAbilitySound(player, "mob.wither.spawn", { pitch: 1.6, volume: 0.4 });
  sendActionBar(player, "§8Shadow Cloak activated! (armor unequipped while cloaked)");

  system.runTimeout(() => {
    try {
      player.nameTag = originalNameTag;
    } catch {
      // Disconnected — nothing to restore.
    }

    const equippableNow = player.getComponent("minecraft:equippable");
    if (equippableNow) {
      for (const { slot, item } of removedArmor) {
        try {
          equippableNow.setEquipment(slot, item);
        } catch {
          // Player disconnected or slot changed — best effort restore only.
        }
      }
    }
  }, EFFECT_DURATION_TICKS);
}

registerAbility(SHARDS.shadow.id, executeShadowCloak);
