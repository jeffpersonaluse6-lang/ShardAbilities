/**
 * effectManager.js
 *
 * Small defensive wrappers around addEffect/heal, used by the passive
 * items migrated from the Inventory Effect Items addon. The original
 * addon wrapped every one of these calls in try/catch, because some
 * effect ids or entity states can throw (e.g. calling addEffect on an
 * entity that just died this tick). That defensiveness is worth keeping
 * — an SMP server shouldn't have combat logic crash silently because one
 * edge case threw once.
 *
 * NOTE: existing shard ability files call player.addEffect() directly
 * and are intentionally left as-is here — they're already tested and
 * working, and routing them through this wrapper would be a pure style
 * change with no functional benefit, just refactor risk for no reason.
 * This wrapper is for new passive code only.
 */

const DEFAULT_MAX_HEALTH = 20;

/**
 * Applies a status effect, swallowing errors rather than throwing.
 * @param {import("@minecraft/server").Entity} entity
 * @param {string} effectId
 * @param {number} seconds
 * @param {number} amplifier
 * @param {boolean} [showParticles=false]
 */
export function applyEffect(entity, effectId, seconds, amplifier, showParticles = false) {
  try {
    entity.addEffect(effectId, seconds * 20, { amplifier, showParticles });
  } catch {
    // Entity may have died or despawned between the triggering event and
    // this call — safe to no-op rather than crash the whole handler.
  }
}

/**
 * Heals an entity by a flat HP amount, clamped to its max health.
 * @param {import("@minecraft/server").Entity} entity
 * @param {number} amount - HP, where 1 HP = 0.5 hearts.
 */
export function healEntity(entity, amount) {
  try {
    const health = entity.getComponent("minecraft:health");
    if (!health) return;
    const max = health.effectiveMax ?? DEFAULT_MAX_HEALTH;
    health.setCurrentValue(Math.min(max, health.currentValue + amount));
  } catch {
    // As above — entity state can change out from under us between events.
  }
}

/**
 * Reads an entity's current health component safely.
 * @param {import("@minecraft/server").Entity} entity
 * @returns {import("@minecraft/server").EntityHealthComponent | undefined}
 */
export function getHealth(entity) {
  try {
    return entity.getComponent("minecraft:health");
  } catch {
    return undefined;
  }
}
