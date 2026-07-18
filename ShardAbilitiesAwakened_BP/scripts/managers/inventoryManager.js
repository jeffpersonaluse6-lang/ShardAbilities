/**
 * inventoryManager.js
 *
 * THE PROBLEM THIS FILE FIXES:
 * The original Inventory Effect Items addon checked ownership with a
 * function like `hasItem(player, "invfx:blood")` — a full linear scan of
 * the player's inventory container. That's fine called once. It was
 * called up to 6 SEPARATE times per hit event (once per passive item) and
 * 3 more times per player, every second, in a tick interval. On an SMP
 * with many simultaneous fights, that's dozens of redundant full-inventory
 * scans doing the exact same container iteration over and over.
 *
 * THE FIX:
 * Scan the inventory ONCE, collect every passive item id the player
 * currently owns into a Set, and hand that Set to whoever needs it.
 * Checking Set membership afterward is O(1) per passive instead of
 * O(inventory size) per passive.
 *
 * WHY NOT CACHE THIS ACROSS TICKS?
 * Bedrock's stable Script API has no reliable "inventory contents
 * changed" event to invalidate a cache against — a player could pick up
 * or drop a passive item at any moment. Caching stale ownership data
 * would mean an ability keeps working for a few ticks after a player
 * drops the item, which is a worse bug than the scan cost. So this scans
 * fresh every time it's called — the win here is de-duplicating the SCAN
 * COUNT per event, not skipping scans altogether.
 */

import { ITEM_ID_TO_PASSIVE } from "../config.js";

/**
 * Scans a player's inventory once and returns the set of passive item ids
 * (e.g. "blood", "momentum") they currently carry.
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
