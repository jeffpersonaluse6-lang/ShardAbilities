/**
 * combatManager.js
 *
 * Owns every combat-related Script API event listener that a PASSIVE item
 * needs: entityHitEntity (hit tracking), entityDie (kill tracking), a
 * shared tick loop (time/health-based passives), and entityHurt (damage
 * bonus resolution, used by Momentum's combo bonus).
 *
 * Rage no longer participates in the damage-bonus system here — it was
 * rewritten to use native Strength/Speed effects instead, independent of
 * this file. Momentum is currently the only registered damage-bonus
 * provider, but the max()-based resolution below still works correctly
 * even with just one provider; it simply becomes "Momentum's bonus
 * applies, full stop" until/unless another provider registers.
 */

import { world, system, EntityDamageCause } from "@minecraft/server";
import { getOwnedPassiveIds } from "./inventoryManager.js";
import { DEBUG_MODE } from "../config.js";

const TICKS_PER_SECOND = 20;

/** @type {Map<string, (attacker, target) => void>} */
const hitPassives = new Map();
/** @type {Map<string, (killer, victim) => void>} */
const deathPassives = new Map();
/** @type {Map<string, (player) => void>} */
const tickPassives = new Map();
/** @type {Map<string, (attacker, target, baseDamage) => number>} */
const damageBonusProviders = new Map();
/** @type {Array<(playerId: string) => void>} */
const leaveCleanupHooks = [];
/** @type {Array<(deadEntityId: string) => void>} */
const deathCleanupHooks = [];

export function registerHitPassive(passiveId, handler) {
  hitPassives.set(passiveId, handler);
}
export function registerDeathPassive(passiveId, handler) {
  deathPassives.set(passiveId, handler);
}
export function registerTickPassive(passiveId, handler) {
  tickPassives.set(passiveId, handler);
}
export function registerDamageBonusProvider(sourceId, provider) {
  damageBonusProviders.set(sourceId, provider);
}
export function registerLeaveCleanup(fn) {
  leaveCleanupHooks.push(fn);
}
export function registerDeathCleanup(fn) {
  deathCleanupHooks.push(fn);
}
export function runLeaveCleanup(playerId) {
  for (const fn of leaveCleanupHooks) fn(playerId);
}

world.afterEvents.entityHitEntity.subscribe((event) => {
  const attacker = event.damagingEntity;
  const target = event.hitEntity;
  if (!attacker || attacker.typeId !== "minecraft:player" || !target) return;
  if (hitPassives.size === 0) return;

  const owned = getOwnedPassiveIds(attacker);
  for (const [passiveId, handler] of hitPassives) {
    if (owned.has(passiveId)) handler(attacker, target);
  }
});

world.afterEvents.entityDie.subscribe((event) => {
  const dead = event.deadEntity;
  if (!dead) return;

  for (const fn of deathCleanupHooks) fn(dead.id);

  if (dead.typeId !== "minecraft:player") return;
  const killer = event.damageSource?.damagingEntity;
  if (deathPassives.size > 0 && killer && killer.typeId === "minecraft:player" && killer.id !== dead.id) {
    const owned = getOwnedPassiveIds(killer);
    for (const [passiveId, handler] of deathPassives) {
      if (owned.has(passiveId)) handler(killer, dead);
    }
  }
});

system.runInterval(() => {
  if (tickPassives.size === 0) return;
  for (const player of world.getPlayers()) {
    const owned = getOwnedPassiveIds(player);
    if (owned.size === 0) continue;
    for (const [passiveId, handler] of tickPassives) {
      if (owned.has(passiveId)) handler(player);
    }
  }
}, TICKS_PER_SECOND);

world.afterEvents.entityHurt.subscribe((event) => {
  if (damageBonusProviders.size === 0) return;

  const { damageSource, hurtEntity, damage } = event;
  const attacker = damageSource.damagingEntity;
  if (!attacker || attacker.typeId !== "minecraft:player") return;
  if (damageSource.cause !== EntityDamageCause.entityAttack) return;

  let bestBonus = 0;
  for (const provider of damageBonusProviders.values()) {
    const bonus = provider(attacker, hurtEntity, damage);
    if (bonus > bestBonus) bestBonus = bonus;
  }

  if (DEBUG_MODE) {
    attacker.sendMessage(`§b[debug] providers=${damageBonusProviders.size}, bestBonus=${bestBonus}`);
  }

  if (bestBonus <= 0) return;

  const bonusDamage = Math.max(1, Math.round(damage * bestBonus));

  if (DEBUG_MODE) {
    attacker.sendMessage(`§b[debug] applying bonusDamage=${bonusDamage} (base=${damage}, bonus=${bestBonus})`);
  }

  // FIX (learned the hard way): applyDamage() routes through Minecraft's
  // normal damage pipeline, including a brief post-hit invulnerability
  // window where a SMALLER follow-up damage instance is silently absorbed
  // — the call reports success but does nothing. Directly reducing the
  // health component bypasses that pipeline entirely.
  try {
    const health = hurtEntity.getComponent("minecraft:health");
    if (health) {
      const newValue = Math.max(0, health.currentValue - bonusDamage);
      health.setCurrentValue(newValue);
      if (DEBUG_MODE) attacker.sendMessage(`§b[debug] health reduced to ${newValue}`);
    }
  } catch (e) {
    if (DEBUG_MODE) attacker.sendMessage(`§c[debug] health reduction FAILED: ${e.message}`);
  }
});
