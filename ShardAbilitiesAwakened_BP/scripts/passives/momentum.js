/**
 * momentum.js — Momentum (Legendary, passive)
 *
 *   Every consecutive hit on the SAME enemy increases damage:
 *     Hit 1: +5%   Hit 2: +10%   Hit 3: +15%   Hit 4: +20%   Hit 5+: +25% (cap)
 *
 *   Combo resets if: no hit for 4 seconds, the player switches targets,
 *   or either the player or their target dies.
 * 
 *   SELF-CONTAINED: Uses only entityHitEntity event. Updates combo state
 *   and applies bonus damage immediately from the same event handler.
 */

import { world, system, EntityDamageCause } from "@minecraft/server";
import { sendActionBar, playAbilitySound, spawnAbilityParticle } from "../utils.js";
import { PASSIVE_ITEMS } from "../config.js";
import { getOwnedPassiveIds } from "../managers/inventoryManager.js";

const COMBO_TIMEOUT_TICKS = 4 * 20; // 4 seconds
const PER_HIT_BONUS = 0.05; // +5% per combo stack
const MAX_BONUS = 0.25; // cap at hit 5+

/** @type {Map<string, {targetId: string, count: number, lastHitTick: number}>} */
const comboState = new Map();

/**
 * Called when a player with Momentum hits an entity.
 * Updates combo state and applies bonus damage immediately.
 */
function onHit(event) {
  const attacker = event.damagingEntity;
  const target = event.hitEntity;
  
  if (!attacker || attacker.typeId !== "minecraft:player" || !target) {
    return;
  }

  // Check if attacker owns Momentum
  const owned = getOwnedPassiveIds(attacker);
  if (!owned.has(PASSIVE_ITEMS.momentum.id)) {
    return;
  }

  const now = system.currentTick;
  const attackerId = attacker.id;
  const targetId = target.id;

  // Get existing state for this attacker
  let state = comboState.get(attackerId);

  // Determine if we should reset the combo
  let shouldReset = false;

  if (!state) {
    // No existing state - start fresh
    shouldReset = true;
  } else if (state.targetId !== targetId) {
    // Target changed - reset combo
    shouldReset = true;
  } else if (now - state.lastHitTick > COMBO_TIMEOUT_TICKS) {
    // Timeout expired - reset combo
    shouldReset = true;
  }

  // Update combo state
  if (shouldReset) {
    state = { targetId: targetId, count: 1, lastHitTick: now };
  } else {
    state.count++;
    state.lastHitTick = now;
  }

  // Store updated state
  comboState.set(attackerId, state);

  // Calculate bonus percentage
  const bonusPercent = Math.min(MAX_BONUS, PER_HIT_BONUS * state.count);
  const bonusDisplay = Math.round(bonusPercent * 100);

  // Display combo info
  sendActionBar(attacker, `§6⚔ Combo x${state.count} (+${bonusDisplay}%)`);
  spawnAbilityParticle(attacker, "minecraft:colored_flame_particle", undefined, {
    red: 1.0,
    green: 0.7,
    blue: 0.1,
  });
  playAbilitySound(attacker, "random.orb", { pitch: 1.0 + Math.min(state.count, 5) * 0.08 });

  // Apply bonus damage immediately
  // We need to calculate based on the vanilla damage that was just dealt
  // Since we're in entityHitEntity, we don't have the exact damage value yet
  // We'll apply a small extra damage based on a reasonable estimate
  // The actual damage will be calculated when entityHurt fires, but we need
  // to apply our bonus now. We'll use applyDamage which adds to the current health.
  
  // Get the base damage from the event if available, otherwise estimate
  // Note: entityHitEntity doesn't provide damage directly, so we estimate
  // based on typical player attack values. For accuracy, we read the 
  // target's health before and after would require entityHurt, but since
  // we need immediate application, we apply a fixed extra amount.
  
  // Actually, we need to wait for entityHurt to know the base damage.
  // But the requirement says to apply immediately from entityHitEntity.
  // The solution: store the pending bonus and apply it in entityHurt,
  // OR estimate base damage from the player's equipped weapon.
  
  // For simplicity and reliability, let's estimate base damage from
  // the player's main hand item. Vanilla Bedrock sword damages:
  // wooden: 5, stone: 6, iron: 6, diamond: 7, netherite: 8
  // Default punch (no weapon): 1
  
  const equipment = attacker.getComponent("minecraft:equippable");
  let baseDamage = 1; // default punch
  
  if (equipment) {
    const container = equipment.container;
    if (container && container.size > 0) {
      const mainHandItem = container.getItem(0); // Slot 0 is main hand
      if (mainHandItem) {
        const typeId = mainHandItem.typeId;
        if (typeId.includes("wooden_sword")) baseDamage = 5;
        else if (typeId.includes("stone_sword")) baseDamage = 6;
        else if (typeId.includes("iron_sword")) baseDamage = 6;
        else if (typeId.includes("golden_sword")) baseDamage = 6;
        else if (typeId.includes("diamond_sword")) baseDamage = 7;
        else if (typeId.includes("netherite_sword")) baseDamage = 8;
        else if (typeId.includes("wooden_axe")) baseDamage = 6;
        else if (typeId.includes("stone_axe")) baseDamage = 7;
        else if (typeId.includes("iron_axe")) baseDamage = 7;
        else if (typeId.includes("golden_axe")) baseDamage = 7;
        else if (typeId.includes("diamond_axe")) baseDamage = 8;
        else if (typeId.includes("netherite_axe")) baseDamage = 9;
      }
    }
  }
  
  // Calculate and apply bonus damage
  const bonusDamage = Math.max(1, Math.round(baseDamage * bonusPercent));
  
  // Apply the bonus damage immediately
  try {
    target.applyDamage(bonusDamage, {
      cause: EntityDamageCause.entityAttack,
      damagingEntity: attacker,
    });
  } catch (e) {
    // Target may have died or become invalid - safe to ignore
  }
}

// Subscribe to entityHitEntity - the ONLY event used by Momentum
world.afterEvents.entityHitEntity.subscribe(onHit);

// Cleanup on player leave
world.afterEvents.playerLeave.subscribe((event) => {
  comboState.delete(event.playerId);
});

// Cleanup on entity death (both attacker and target)
world.afterEvents.entityDie.subscribe((event) => {
  const deadId = event.deadEntity.id;
  
  // Remove any combo where this entity was the attacker
  comboState.delete(deadId);
  
  // Remove any combo where this entity was the target
  for (const [attackerId, state] of comboState.entries()) {
    if (state.targetId === deadId) {
      comboState.delete(attackerId);
    }
  }
});
