/**
 * vision.js
 *
 * Vision Shard — "Hunter's Sight"
 *   - Every OTHER player within ~30 blocks is highlighted for 8 seconds
 *   - Cooldown (45s) handled by shardManager
 *
 * IMPORTANT BEDROCK LIMITATION:
 * Minecraft Bedrock Edition does NOT have a native "glowing" effect like Java Edition.
 * The "glowing" effect ID exists in the API but has NO visual effect in Bedrock.
 * 
 * ALTERNATIVE IMPLEMENTATION:
 * We use continuous particle effects on revealed players to make them visible
 * through walls. Particles spawn above each revealed player every few ticks,
 * creating a visible beacon that marks their location even through obstacles.
 * This is the closest working alternative to the glowing effect in Bedrock.
 */

import { system, MolangVariableMap } from "@minecraft/server";
import { registerAbility } from "../managers/shardManager.js";
import { sendActionBar, playAbilitySound, spawnAbilityParticle, spawnParticleRing } from "../utils.js";
import { SHARDS } from "../config.js";

const HIGHLIGHT_RADIUS = 30;
const HIGHLIGHT_DURATION_TICKS = 8 * 20; // 8 seconds
const VISION_COLOR = { red: 0.9, green: 0.7, blue: 0.1 };
const PARTICLE_INTERVAL_TICKS = 10; // Spawn particles every 10 ticks (0.5 seconds)

/**
 * Spawns highlight particles above a target player's location
 * @param {import("@minecraft/server").Dimension} dimension
 * @param {import("@minecraft/server").Vector3} location
 */
function spawnHighlightParticles(dimension, location) {
  // Spawn particles above the player's head (visible through walls)
  const particlePos = {
    x: location.x,
    y: location.y + 2.5,
    z: location.z,
  };
  
  // Ring of particles around the target
  spawnParticleRing(dimension, particlePos, "minecraft:colored_flame_particle", 1.5, 8, VISION_COLOR);
  
  // Additional burst at center for extra visibility
  const molangVars = new MolangVariableMap();
  molangVars.setColorRGB("variable.color", VISION_COLOR);
  dimension.spawnParticle("minecraft:colored_flame_particle", particlePos, molangVars);
}

/**
 * @param {import("@minecraft/server").Player} caster
 */
function executeHuntersSight(caster) {
  const nearbyPlayers = caster.dimension.getPlayers({
    location: caster.location,
    maxDistance: HIGHLIGHT_RADIUS,
  });

  let highlightedCount = 0;
  const currentTick = system.currentTick;
  
  for (const target of nearbyPlayers) {
    if (target.id === caster.id) continue; // Don't highlight yourself.

    // NOTE: The "glowing" effect has no visual impact in Bedrock Edition.
    // We use continuous particle effects instead to mark revealed players.
    target.addEffect("glowing", HIGHLIGHT_DURATION_TICKS, {
      amplifier: 0,
      showParticles: false,
    });
    
    // Initial ring at the target's feet
    spawnParticleRing(target.dimension, target.location, "minecraft:colored_flame_particle", 1, 8, VISION_COLOR);
    
    // Set up recurring particle spawns above the target for the duration
    // This creates a visible beacon marking their location through walls
    const endTimeTick = currentTick + HIGHLIGHT_DURATION_TICKS;
    let nextParticleTick = currentTick + PARTICLE_INTERVAL_TICKS;
    
    const intervalId = system.runInterval(() => {
      if (system.currentTick >= endTimeTick) {
        system.clearRun(intervalId);
        return;
      }
      
      if (system.currentTick >= nextParticleTick) {
        const targetLocation = target.location;
        if (target.isValid()) {
          spawnHighlightParticles(target.dimension, targetLocation);
        }
        nextParticleTick += PARTICLE_INTERVAL_TICKS;
      }
    }, 1);
    
    highlightedCount++;
  }

  spawnAbilityParticle(caster, "minecraft:colored_flame_particle", undefined, VISION_COLOR);
  playAbilitySound(caster, "mob.enderman.stare", { pitch: 1.3 });
  sendActionBar(
    caster,
    highlightedCount > 0
      ? `§eHunter's Sight: ${highlightedCount} target(s) revealed!`
      : "§eHunter's Sight: no targets nearby."
  );
}

registerAbility(SHARDS.vision.id, executeHuntersSight);
