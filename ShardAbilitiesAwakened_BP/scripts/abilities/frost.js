/**
 * frost.js (renamed from ice.js / "Ice Shard")
 *
 * Frost Shard — "Frostbite"
 *   - Every other entity within ~6 blocks is FULLY FROZEN (cannot move at
 *     all) for 5 seconds, plus a Slowness visual/icon layer
 *   - Cooldown (50s) handled by shardManager
 *
 * WHY THIS IS DIFFERENT FROM A SLOWNESS EFFECT:
 * Slowness, even at max amplifier, only ever REDUCES movement speed — it
 * never reaches exactly zero, so "fully freeze" isn't achievable through
 * status effects alone. True freeze means actively fighting the entity's
 * own movement every tick: we snapshot their position the instant they're
 * frozen, then teleport them back to that exact spot every single tick
 * for the freeze duration. Whatever direction they try to move, they get
 * snapped back before it's visible. This is heavier than a status effect
 * (a running interval per frozen entity instead of one engine-side flag),
 * which is a real, worthwhile trade-off for this specific request — but
 * it does mean a LOT of simultaneously-frozen entities across an SMP
 * would cost more than a normal effect would. Fine for an ability on a
 * 50s cooldown affecting a small radius; worth revisiting if it's ever
 * used at a much larger scale.
 */

import { system } from "@minecraft/server";
import { registerAbility } from "../managers/shardManager.js";
import { sendActionBar, playAbilitySound, spawnAbilityParticle } from "../utils.js";
import { SHARDS } from "../config.js";

const FROST_RADIUS = 6;
const FREEZE_DURATION_TICKS = 5 * 20; // 5 seconds
const SLOWNESS_AMPLIFIER = 6; // extra visual/icon layer on top of the true freeze

/** @type {Map<string, number>} entityId -> active runInterval id */
const activeFreezeIntervals = new Map();

/**
 * Locks one entity in place for FREEZE_DURATION_TICKS by teleporting it
 * back to its frozen position every tick.
 * @param {import("@minecraft/server").Entity} entity
 */
function freezeEntity(entity) {
  // Refreshing an existing freeze (e.g. hit by Frost twice) — clear the
  // old interval first so we don't end up with two competing lock loops.
  const existingIntervalId = activeFreezeIntervals.get(entity.id);
  if (existingIntervalId !== undefined) {
    system.clearRun(existingIntervalId);
  }

  const frozenLocation = entity.location;
  const frozenRotation = entity.getRotation();
  let ticksRemaining = FREEZE_DURATION_TICKS;

  const intervalId = system.runInterval(() => {
    ticksRemaining--;
    if (ticksRemaining <= 0) {
      system.clearRun(intervalId);
      activeFreezeIntervals.delete(entity.id);
      return;
    }

    try {
      entity.teleport(frozenLocation, { rotation: frozenRotation });
    } catch {
      // Entity died/despawned/disconnected mid-freeze — stop trying.
      system.clearRun(intervalId);
      activeFreezeIntervals.delete(entity.id);
    }
  }, 1); // every tick — anything looser leaves a visible window to move

  activeFreezeIntervals.set(entity.id, intervalId);

  entity.addEffect("slowness", FREEZE_DURATION_TICKS, {
    amplifier: SLOWNESS_AMPLIFIER,
    showParticles: true,
  });
}

/**
 * @param {import("@minecraft/server").Player} caster
 */
function executeFrostbite(caster) {
  const nearbyEntities = caster.dimension.getEntities({
    location: caster.location,
    maxDistance: FROST_RADIUS,
  });

  let frozenCount = 0;
  for (const entity of nearbyEntities) {
    if (entity.id === caster.id) continue;
    freezeEntity(entity);
    frozenCount++;
  }

  spawnAbilityParticle(caster, "minecraft:colored_flame_particle", undefined, {
    red: 0.4,
    green: 0.85,
    blue: 0.95,
  });
  playAbilitySound(caster, "shard.ice.activate", { pitch: 1.0 });
  sendActionBar(
    caster,
    frozenCount > 0 ? `§bFrostbite: ${frozenCount} target(s) frozen solid!` : "§bFrostbite!"
  );
}

registerAbility(SHARDS.frost.id, executeFrostbite);
