/**
 * inventoryManager.js
 *
 * Single-scan inventory check: returns every passive item id a player
 * currently carries in ONE pass over their inventory, instead of a
 * separate full scan per item type.
 */

import { ITEM_ID_TO_PASSIVE } from "../config.js";

/**
 * @param {import("@minecraft/server").Player} player
 * @returns {Set<string>}
 */
export function getOwnedPassiveIds(player) {
  const owned = new Set();
  const inventory = player.getComponent("minecraft:inventory")?.container;
  if (!inventory) return owned;

  for (let slot = 0; slot < inventory.size; slot++) {
    const stack = inventory.getItem(slot);
    if (!stack) continue;
    const passiveId = ITEM_ID_TO_PASSIVE[stack.typeId];
    if (passiveId) owned.add(passiveId);
  }
  return owned;
}
