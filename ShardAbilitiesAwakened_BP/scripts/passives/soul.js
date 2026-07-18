/**
 * soul.js — Soul (passive)
 *   Killing another player grants Speed III + Strength III for 20 seconds.
 * The tricky part of this ability — correctly attributing a PvP kill when
 * damageSource.damagingEntity doesn't reliably resolve — is handled once,
 * centrally, in combatManager's entityDie listener (the lastPlayerDamager
 * fallback). This file only needs to react once combatManager has already
 * confirmed a valid player killer.
 */

import { registerDeathPassive } from "../managers/combatManager.js";
import { applyEffect } from "../managers/effectManager.js";
import { PASSIVE_ITEMS } from "../config.js";

const BUFF_DURATION_SECONDS = 20;
const SPEED_AMPLIFIER = 2; // Speed III
const STRENGTH_AMPLIFIER = 2; // Strength III

function onKill(killer) {
  applyEffect(killer, "speed", BUFF_DURATION_SECONDS, SPEED_AMPLIFIER);
  applyEffect(killer, "strength", BUFF_DURATION_SECONDS, STRENGTH_AMPLIFIER);
}

registerDeathPassive(PASSIVE_ITEMS.soul.id, onKill);
