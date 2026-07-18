/**
 * combatManager.js
 *
 * Owns every combat-related Script API event listener for the ENTIRE
 * addon — shards' damage bonuses (Rage) and every passive item that
 * reacts to hits, kills, or the passage of time (Blood, Cataclysm,
 * Nightfall, Eclipse, Soul, Abyss, Chaos, Momentum).
 *
 * WHY ONE FILE OWNS ALL OF THIS, instead of each passive subscribing to
 * its own copy of entityHitEntity/entityDie:
 *
 * 1. Performance: Bedrock calls every subscriber for every event. Eight
 *    separate entityHitEntity listeners means eight function calls per
 *    hit, each redoing the same "is this a player, who's the target"
 *    checks. One listener that dispatches internally does that work once.
 *
 * 2. Correctness: the damage-bonus rule you asked for — Rage and Momentum
 *    should NOT stack, only the larger bonus applies — is IMPOSSIBLE to
 *    implement correctly with two independent entityHurt listeners. Two
 *    listeners can't see each other's bonus to compare against; whichever
 *    fires first would add its bonus, then the second would recursively
 *    top up on top of THAT, and now they're stacking by accident. One
 *    listener that asks every registered "bonus provider" for its number
 *    and takes the max is the only way to honor "biggest bonus wins."
 *
 * Every passive/ability file registers into this via small functions
 * below — none of them touch world.afterEvents directly.
 */

import { world, system, EntityDamageCause } from "@minecraft/server";
import { getOwnedPassiveIds } from "./inventoryManager.js";

const TICKS_PER_SECOND = 20;
const SOUL_FALLBACK_WINDOW_TICKS = 10 * TICKS_PER_SECOND; // matches original addon's 10s window

/** @type {Map<string, (attacker, target) => void>} passiveId -> handler */
const hitPassives = new Map();

/** @type {Map<string, (killer, victim) => void>} passiveId -> handler */
const deathPassives = new Map();

/** @type {Map<string, (player) => void>} passiveId -> handler */
const tickPassives = new Map();

/** @type {Map<string, (attacker, target, baseDamage) => number>} sourceId -> bonus fraction provider */
const damageBonusProviders = new Map();

/** @type {Array<(playerId: string) => void>} run on player leave for module-level cleanup */
const leaveCleanupHooks = [];

/** @type {Array<(deadEntityId: string) => void>} run on ANY entity death,
 * regardless of killer — used by Momentum to clear combo state when a
 * target dies mid-combo, independent of who (or what) killed it. */
const deathCleanupHooks = [];

/** Entities currently receiving a deferred bonus-damage top-up. Prevents
 * the top-up's own applyDamage() call from re-triggering ANOTHER bonus
 * top-up on itself — see the entityHurt listener below for why this is
 * required now that bonuses have a guaranteed minimum (no longer relying
 * on rounding-to-zero to naturally stop the recursion). */
const pendingBonusTargets = new Set();

/** Tracks the last player who hit each player, as a PvP-kill-attribution
 * fallback — some server setups don't reliably populate
 * damageSource.damagingEntity by the time entityDie fires. */
const lastPlayerDamager = new Map();

// --- Registration API, called by passives/*.js and abilities/*.js -------

export function registerHitPassive(passiveId, handler) {
  hitPassives.set(passiveId, handler);
}

export function registerDeathPassive(passiveId, handler) {
  deathPassives.set(passiveId, handler);
}

export function registerTickPassive(passiveId, handler) {
  tickPassives.set(passiveId, handler);
}

/**
 * @param {string} sourceId - Unique id for this bonus source, e.g. "rage", "momentum".
 * @param {(attacker: import("@minecraft/server").Player, target: import("@minecraft/server").Entity, baseDamage: number) => number} provider
 *   Returns a fraction (0.35 = +35%) or 0 if this source isn't currently active.
 */
export function registerDamageBonusProvider(sourceId, provider) {
  damageBonusProviders.set(sourceId, provider);
}

export function registerLeaveCleanup(fn) {
  leaveCleanupHooks.push(fn);
}

export function registerDeathCleanup(fn) {
  deathCleanupHooks.push(fn);
}

/** Called once from main.js on player leave. */
export function runLeaveCleanup(playerId) {
  lastPlayerDamager.delete(playerId);
  for (const fn of leaveCleanupHooks) fn(playerId);
}

// --- entityHitEntity: drives Blood, Cataclysm, Abyss, Momentum's combo --

world.afterEvents.entityHitEntity.subscribe((event) => {
  const attacker = event.damagingEntity;
  const target = event.hitEntity;
  if (!attacker || attacker.typeId !== "minecraft:player" || !target) return;

  // Soul's kill-attribution fallback needs this recorded unconditionally,
  // regardless of which passives either player owns.
  if (target.typeId === "minecraft:player" && target.id !== attacker.id) {
    lastPlayerDamager.set(target.id, { attackerId: attacker.id, tick: system.currentTick });
  }

  if (hitPassives.size === 0) return;

  // ONE inventory scan for this attacker, checked against every registered
  // hit passive — not one scan per passive.
  const owned = getOwnedPassiveIds(attacker);
  for (const [passiveId, handler] of hitPassives) {
    if (owned.has(passiveId)) handler(attacker, target);
  }
});

// --- entityDie: drives Soul -----------------------------------------------

world.afterEvents.entityDie.subscribe((event) => {
  const dead = event.deadEntity;
  if (!dead || dead.typeId !== "minecraft:player") return;

  for (const fn of deathCleanupHooks) fn(dead.id);

  let killer = event.damageSource?.damagingEntity;

  // Fallback: use the last player who hit them, if recent enough.
  if (!killer || killer.typeId !== "minecraft:player" || killer.id === dead.id) {
    const info = lastPlayerDamager.get(dead.id);
    if (info && system.currentTick - info.tick <= SOUL_FALLBACK_WINDOW_TICKS) {
      killer = world.getPlayers().find((p) => p.id === info.attackerId);
    }
  }

  lastPlayerDamager.delete(dead.id);

  if (deathPassives.size > 0 && killer && killer.typeId === "minecraft:player" && killer.id !== dead.id) {
    const owned = getOwnedPassiveIds(killer);
    for (const [passiveId, handler] of deathPassives) {
      if (owned.has(passiveId)) handler(killer, dead);
    }
  }
});

// --- tick interval: drives Nightfall, Eclipse, Chaos ----------------------

system.runInterval(() => {
  if (tickPassives.size === 0) return;

  for (const player of world.getPlayers()) {
    // ONE scan per player per second, not one scan per tick-passive per player.
    const owned = getOwnedPassiveIds(player);
    if (owned.size === 0) continue;

    for (const [passiveId, handler] of tickPassives) {
      if (owned.has(passiveId)) handler(player);
    }
  }
}, TICKS_PER_SECOND);

// --- entityHurt: the single damage-bonus resolution point -----------------

world.afterEvents.entityHurt.subscribe((event) => {
  if (damageBonusProviders.size === 0) return;

  const { damageSource, hurtEntity, damage } = event;

  // This hit IS our own deferred top-up landing — do not compute another
  // bonus on top of a bonus. Without this guard, the "minimum +1 damage"
  // floor below would make the top-up recurse forever instead of stopping.
  if (pendingBonusTargets.has(hurtEntity.id)) return;

  const attacker = damageSource.damagingEntity;
  if (!attacker || attacker.typeId !== "minecraft:player") return;
  if (damageSource.cause !== EntityDamageCause.entityAttack) return;

  let bestBonus = 0;
  for (const provider of damageBonusProviders.values()) {
    const bonus = provider(attacker, hurtEntity, damage);
    console.log(`[combatManager DEBUG] entityHurt: provider returned bonus=${bonus}, bestBonus was ${bestBonus}`);
    if (bonus > bestBonus) bestBonus = bonus;
  }
  console.log(`[combatManager DEBUG] entityHurt: final bestBonus=${bestBonus}, damage=${damage}`);
  if (bestBonus <= 0) return;

  // Guarantee at least +1 whenever any bonus is active — see rage.js /
  // this file's history for why rounding alone left small bonuses
  // (particularly Momentum's early combo stacks) completely invisible.
  const bonusDamage = Math.max(1, Math.round(damage * bestBonus));
  console.log(`[combatManager DEBUG] entityHurt: bonusDamage=${bonusDamage} (base=${damage}, bestBonus=${bestBonus})`);

  // Deferred one tick to avoid Bedrock's execution-context restrictions on
  // mutating combat state from inside the event that's still resolving it.
  pendingBonusTargets.add(hurtEntity.id);
  system.run(() => {
    try {
      console.log(`[combatManager DEBUG] applyDamage: applying ${bonusDamage} to ${hurtEntity.id}`);
      hurtEntity.applyDamage(bonusDamage, {
        cause: EntityDamageCause.entityAttack,
        damagingEntity: attacker,
      });
    } catch {
      // Target likely died/despawned in the 1-tick gap — safe to skip.
    } finally {
      pendingBonusTargets.delete(hurtEntity.id);
    }
  });
});
