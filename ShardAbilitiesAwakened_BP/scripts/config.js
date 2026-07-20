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
  flash: {
    id: "flash",
    itemId: `${NAMESPACE}:flash_shard`,
    cooldownSeconds: 60,
    displayName: "Flash Shard",
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
  frost: {
    id: "frost",
    itemId: `${NAMESPACE}:frost_shard`,
    cooldownSeconds: 50,
    displayName: "Frost Shard",
  },
};

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
 * PASSIVE_ITEMS — items that grant an ability just by being carried in
 * inventory, no activation required. Currently just Momentum; the other
 * passives from the fused Inventory Effect Items addon (Blood, Cataclysm,
 * Nightfall, Eclipse, Soul, Abyss, Chaos) were removed per request.
 */
export const PASSIVE_ITEMS = {
  momentum: { id: "momentum", itemId: "invfx:momentum", displayName: "Momentum" },
};

export const ITEM_ID_TO_PASSIVE = Object.freeze(
  Object.fromEntries(
    Object.values(PASSIVE_ITEMS).map((item) => [item.itemId, item.id])
  )
);
