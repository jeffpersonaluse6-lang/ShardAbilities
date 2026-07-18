/**
 * cataclysm.js — Cataclysm (passive)
 *   Every 5th hit causes a small explosion at the target's location.
 * breaksBlocks:false, causesFire:false — matches the original addon
 * exactly, keeping this a combat effect rather than a griefing tool.
 */

import { registerHitPassive, registerLeaveCleanup } from "../managers/combatManager.js";
import { PASSIVE_ITEMS } from "../config.js";

const EXPLODE_EVERY_N_HITS = 5;
const EXPLOSION_RADIUS = 1.8;

/** @type {Map<string, number>} playerId -> hit count */
const hitCounts = new Map();

function onHit(attacker, target) {
  const count = (hitCounts.get(attacker.id) ?? 0) + 1;
  hitCounts.set(attacker.id, count);

  if (count % EXPLODE_EVERY_N_HITS === 0) {
    try {
      attacker.dimension.createExplosion(target.location, EXPLOSION_RADIUS, {
        breaksBlocks: false,
        causesFire: false,
        source: attacker,
      });
    } catch {
      // Target location may be invalid this tick (e.g. entity just
      // despawned) — safe to skip rather than crash the hit handler.
    }
  }
}

registerHitPassive(PASSIVE_ITEMS.cataclysm.id, onHit);
registerLeaveCleanup((playerId) => hitCounts.delete(playerId));
