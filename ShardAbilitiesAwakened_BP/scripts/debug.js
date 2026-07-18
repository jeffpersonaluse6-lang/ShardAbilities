/**
 * debug.js
 *
 * DEV/TESTING TOOL ONLY — not part of the addon's actual gameplay.
 *
 * Prints the exact damage number of every player-caused hit to the
 * attacker's action bar, e.g. "6 dmg -> Zombie". This is what lets you
 * SEE the bonus damage top-up land as its own visible number, rather
 * than eyeballing a mob's health bar and doing subtraction.
 *
 * Gated entirely behind DEBUG_MODE in config.js. Turn that to false (or
 * just remove the import in main.js) before running this on a live SMP —
 * this fires a chat-adjacent message on every single hit, which is exactly
 * the kind of "constant per-event overhead" the rest of this addon goes
 * out of its way to avoid. It's fine for solo testing, not for production.
 */

import { world, EntityDamageCause } from "@minecraft/server";
import { DEBUG_MODE } from "./config.js";

if (DEBUG_MODE) {
  world.afterEvents.entityHurt.subscribe((event) => {
    const { damageSource, hurtEntity, damage } = event;
    const attacker = damageSource.damagingEntity;

    if (!attacker || attacker.typeId !== "minecraft:player") return;
    if (damageSource.cause !== EntityDamageCause.entityAttack) return;

    const targetName = hurtEntity.typeId.replace("minecraft:", "");
    attacker.sendMessage(`§e[debug] ${damage} dmg -> ${targetName}`);
    
    // Also log to console for server-side visibility
    console.log(`[debug] ${damage} dmg -> ${targetName}`);
  });

  console.log("[ShardAbilities: Awakened] DEBUG_MODE is ON — damage readout active. Turn off before deploying to a live server.");
}
