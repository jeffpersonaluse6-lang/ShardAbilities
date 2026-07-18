/**
 * config.js
 *
 * Single source of truth for every shard: its item identifier, its ability
 * identifier, and its cooldown length. Everything else in the addon (the
 * cooldown manager, the activation listener, the ability dispatcher) reads
 * from this table instead of hard-coding shard names anywhere else.
 *
 * To add a future shard (Fire, Water, Lightning...) you register it here
 * and write one ability file. Nothing else in the framework needs to change.
 */

// Namespace prefix for every custom item this addon adds.
// Centralizing it means a rename only happens in one place.
export const NAMESPACE = "shard";

/**
 * DEBUG_MODE — when true, enables debug.js's per-hit damage chat readout.
 * TURN THIS OFF before deploying to a live SMP server: it sends a chat
 * message on every single player-caused hit, which is real per-event
 * overhead this addon otherwise goes out of its way to avoid.
 */
export const DEBUG_MODE = true;

/**
 * @typedef {Object} ShardDefinition
 * @property {string} id            - Unique ability id, used as the cooldown key.
 * @property {string} itemId        - Fully-namespaced custom item identifier.
 * @property {number} cooldownSeconds - Cooldown duration in seconds.
 * @property {string} displayName   - Friendly name shown in action bar messages.
 */

/** @type {Object.<string, ShardDefinition>} */
export const SHARDS = {
  void: {
    id: "void",
    itemId: `${NAMESPACE}:void_shard`,
    cooldownSeconds: 180,
    displayName: "Void Shard",
  },
  rage: {
    id: "rage",
    itemId: `${NAMESPACE}:rage_shard`,
    cooldownSeconds: 120,
    displayName: "Rage Shard",
  },
  ender: {
    id: "ender",
    itemId: `${NAMESPACE}:ender_shard`,
    cooldownSeconds: 90,
    displayName: "Ender Shard",
  },
  shadow: {
    id: "shadow",
    itemId: `${NAMESPACE}:shadow_shard`,
    cooldownSeconds: 120,
    displayName: "Shadow Shard",
  },
  sky: {
    id: "sky",
    itemId: `${NAMESPACE}:sky_shard`,
    cooldownSeconds: 30,
    displayName: "Sky Shard",
  },
  vision: {
    id: "vision",
    itemId: `${NAMESPACE}:vision_shard`,
    cooldownSeconds: 45,
    displayName: "Vision Shard",
  },
  fire: {
    id: "fire",
    itemId: `${NAMESPACE}:fire_shard`,
    cooldownSeconds: 60,
    displayName: "Fire Shard",
  },
  water: {
    id: "water",
    itemId: `${NAMESPACE}:water_shard`,
    cooldownSeconds: 60,
    displayName: "Water Shard",
  },
  lightning: {
    id: "lightning",
    itemId: `${NAMESPACE}:lightning_shard`,
    cooldownSeconds: 75,
    displayName: "Lightning Shard",
  },
  ice: {
    id: "ice",
    itemId: `${NAMESPACE}:ice_shard`,
    cooldownSeconds: 50,
    displayName: "Ice Shard",
  },
};

/**
 * PASSIVE_ITEMS — items that grant an ability just by being carried in
 * inventory, no activation required. Structurally simpler than SHARDS
 * (no cooldown, no itemId->ability dispatch on use) but registered the
 * same way: one entry here, one file in scripts/passives/.
 */
export const PASSIVE_ITEMS = {
  blood: { id: "blood", itemId: "invfx:blood", displayName: "Blood" },
  cataclysm: { id: "cataclysm", itemId: "invfx:cataclysm", displayName: "Cataclysm" },
  nightfall: { id: "nightfall", itemId: "invfx:nightfall", displayName: "Nightfall" },
  eclipse: { id: "eclipse", itemId: "invfx:eclipse", displayName: "Eclipse" },
  soul: { id: "soul", itemId: "invfx:soul", displayName: "Soul" },
  abyss: { id: "abyss", itemId: "invfx:abyss", displayName: "Abyss" },
  chaos: { id: "chaos", itemId: "invfx:chaos", displayName: "Chaos" },
  momentum: { id: "momentum", itemId: "invfx:momentum", displayName: "Momentum" },
};

/**
 * Damage-bonus resolution: when multiple sources of bonus melee damage are
 * active on the same player (Rage's Berserk, Momentum's combo), only the
 * LARGER bonus applies rather than stacking. This constant lives here,
 * not in combatManager, so tuning it doesn't require touching logic code.
 */
export const DAMAGE_BONUS_RESOLUTION = "max"; // vs. "additive" — documents the design choice in one place

/**
 * Reverse lookup table: itemId -> ShardDefinition.
 * Built once at load time so the activation listener can find the correct
 * shard in O(1) instead of looping SHARDS on every single item use.
 */
export const ITEM_ID_TO_SHARD = Object.freeze(
  Object.fromEntries(
    Object.values(SHARDS).map((shard) => [shard.itemId, shard])
  )
);

/**
 * Reverse lookup table: itemId -> PassiveItemDefinition.
 * inventoryManager uses this to translate a raw inventory scan into known
 * passive ids without any per-passive-file hardcoding.
 */
export const ITEM_ID_TO_PASSIVE = Object.freeze(
  Object.fromEntries(
    Object.values(PASSIVE_ITEMS).map((item) => [item.itemId, item.id])
  )
);
