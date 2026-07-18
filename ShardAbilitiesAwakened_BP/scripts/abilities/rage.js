/**
 * rage.js
 *
 * Rage Shard — "Berserk"
 *   - +35% melee damage for 10 seconds
 *   - Cooldown (120s) handled by shardManager, as always.
 *
 * CHANGED from the standalone-addon version: this used to apply the
 * native Strength effect as a stable approximation of a damage boost,
 * specifically to avoid running its own entityHurt listener. Now that
 * combatManager owns a single, shared entityHurt listener for the whole
 * addon (see combatManager.js), that original concern doesn't apply —
 * the risk was never the event itself, it was having multiple independent
 * listeners stepping on each other. With one shared listener, Rage can
 * safely use the same real-percentage mechanism Momentum uses. This
 * matters concretely: "only the bigger of Rage/Momentum's bonus applies"
 * is meaningless unless both are the same kind of number. Strength I's
 * flat damage add and Momentum's percentage aren't comparable — so Rage
 * switching to a real percentage is what makes that rule possible at all.
 */

import { system } from "@minecraft/server";
import { registerAbility } from "../managers/shardManager.js";
import { registerDamageBonusProvider } from "../managers/combatManager.js";
import {
  sendActionBar,
  playAbilitySound,
  spawnAbilityParticle,
} from "../utils.js";
import { SHARDS } from "../config.js";

const BERSERK_DURATION_TICKS = 10 * 20; // 10 seconds
const DAMAGE_BONUS = 0.35; // +35%

/** @type {Map<string, number>} playerId -> tick when Berserk expires */
const activeBerserkPlayers = new Map();

/**
 * Reports Rage's current bonus to combatManager whenever it asks. Returns
 * 0 (meaning "not active") once Berserk's duration has passed — no timer
 * or cleanup needed beyond this check itself expiring naturally.
 * @param {import("@minecraft/server").Player} attacker
 * @returns {number}
 */
function getRageBonus(attacker) {
  const expiryTick = activeBerserkPlayers.get(attacker.id);
  if (expiryTick === undefined) return 0;
  return system.currentTick < expiryTick ? DAMAGE_BONUS : 0;
}

registerDamageBonusProvider("rage", getRageBonus);

/**
 * @param {import("@minecraft/server").Player} player
 */
function executeBerserk(player) {
  activeBerserkPlayers.set(player.id, system.currentTick + BERSERK_DURATION_TICKS);

  spawnAbilityParticle(player, "minecraft:colored_flame_particle", undefined, {
    red: 0.95,
    green: 0.35,
    blue: 0.15,
  });
  playAbilitySound(player, "mob.ravager.roar", { pitch: 0.9 });
  sendActionBar(player, "§cBerserk activated!");
}

registerAbility(SHARDS.rage.id, executeBerserk);
