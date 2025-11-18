# AI Personality Integration Guide

This guide explains how to integrate AI-generated personalities into the Stadium Simulator game.

## Overview

The personality system consists of several components:

1. **AIContentManager** - Loads personalities from IndexedDB/static JSON
2. **DialogueManager** - Manages dialogue selection with cooldowns
3. **PersonalityIntegrationManager** - Coordinates personality loading and entity creation
4. **DialogueDisplayManager** - Displays dialogue on screen
5. **AnnouncerSystem** - Manages announcer commentary
6. **Vendor/Mascot Sprites** - Entity classes with personality support

## Basic Scene Integration

### Step 1: Initialize the Personality System

In your scene's `create()` method:

```typescript
import { PersonalityIntegrationManager } from '@/systems/PersonalityIntegrationManager';
import { DialogueDisplayManager } from '@/systems/DialogueDisplayManager';

export class StadiumScene extends Phaser.Scene {
  private personalityManager!: PersonalityIntegrationManager;
  private dialogueDisplay!: DialogueDisplayManager;

  async create() {
    // Initialize personality manager
    this.personalityManager = PersonalityIntegrationManager.getInstance();
    await this.personalityManager.initialize();

    // Initialize dialogue display
    this.dialogueDisplay = new DialogueDisplayManager(this);

    // ... rest of scene setup
  }
}
```

### Step 2: Create Entities with Personalities

Create vendors and mascots using the personality manager:

```typescript
// Create vendors with personalities
const vendor1 = this.personalityManager.createVendor(this, 100, 400, 0); // First vendor personality
const vendor2 = this.personalityManager.createVendor(this, 200, 400); // Random vendor personality

// Create mascot with personality
const mascot = this.personalityManager.createMascot(this, 500, 450, 0); // First mascot personality
```

### Step 3: Hook Up Event Listeners

Connect game events to dialogue triggers:

```typescript
// Vendor dialogue on service
this.vendorManager.on('serviceComplete', (data: { vendorId: number; section: string }) => {
  const vendor = this.vendors[data.vendorId];
  const dialogue = vendor.triggerDialogue('vendorServe', {
    score: this.waveManager.getScore(),
    waveState: this.waveManager.isActive() ? 'active' : 'inactive',
    sectionStats: this.gameState.getSection(data.section),
  });

  if (dialogue && vendor.getPersonality()) {
    this.dialogueDisplay.showDialogue(vendor.getPersonality()!.name, dialogue);
  }
});

// Announcer commentary on wave complete
this.waveManager.on('waveComplete', (data: { success: boolean; perfectWave?: boolean }) => {
  const announcer = this.personalityManager.getAnnouncerSystem();
  if (!announcer) return;

  const commentary = announcer.getCommentary(
    data.success ? 'waveSuccess' : 'waveFail',
    {
      score: this.waveManager.getScore(),
      waveState: 'inactive',
      perfectWave: data.perfectWave,
      multiplier: this.waveManager.getMultiplier(),
    }
  );

  if (commentary && announcer.getAnnouncerContent()) {
    this.dialogueDisplay.showDialogue(
      announcer.getAnnouncerContent()!.name,
      commentary
    );
  }
});

// Mascot dialogue on activation
mascot.on('activated', () => {
  const dialogue = mascot.triggerDialogue('ultimate', {
    score: this.waveManager.getScore(),
    waveState: this.waveManager.isActive() ? 'active' : 'inactive',
  });

  if (dialogue && mascot.getPersonality()) {
    this.dialogueDisplay.showDialogue(mascot.getPersonality()!.name, dialogue);
  }
});
```

### Step 4: Update Dialogue Display

In your scene's `update()` method:

```typescript
update(time: number, delta: number) {
  // Update dialogue display
  this.dialogueDisplay.update(time, delta);

  // ... rest of update logic
}
```

### Step 5: Cleanup

In your scene's `shutdown()` method:

```typescript
shutdown() {
  // Clean up dialogue display
  if (this.dialogueDisplay) {
    this.dialogueDisplay.destroy();
  }

  // ... rest of cleanup
}
```

## Advanced Usage

### Using Behavior Modifiers

Vendors have personality-driven behavior modifiers:

```typescript
const vendor = this.personalityManager.createVendor(this, 100, 400);

// Get behavior modifiers
const speed = vendor.getMovementSpeed(); // e.g., 120 pixels/second
const pauseDuration = vendor.getPauseDuration(); // e.g., 3000ms
const sectionPreference = vendor.getSectionPreference('A'); // e.g., 1.5x preference
const avoidsWaves = vendor.avoidsActiveWave(); // e.g., true

// Apply to vendor AI
if (vendor.avoidsActiveWave() && this.waveManager.isActive()) {
  // Vendor moves away from active wave
}
```

### Applying Mascot Abilities

Mascots have special abilities that affect game stats:

```typescript
const mascot = this.personalityManager.createMascot(this, 500, 450);

// Activate ability
mascot.activateAbility(0); // Activate first ability

// Get active effects
const effects = mascot.getActiveEffects();
effects.forEach(effect => {
  if (effect.stat === 'happiness' && effect.type === 'add') {
    // Apply +10 happiness to all sections
    this.gameState.modifyHappiness(effect.value, effect.target);
  }
});
```

### Announcer Catchphrases

The announcer system automatically checks for catchphrase triggers:

```typescript
const announcer = this.personalityManager.getAnnouncerSystem();

// Perfect wave triggers special catchphrase
const commentary = announcer.getCommentary('waveSuccess', {
  score: 1000,
  waveState: 'inactive',
  perfectWave: true, // This might trigger "BOOM SHAKALAKA!"
});
```

### Context-Aware Mascot Dialogue

Mascots support 6 different dialogue contexts:

```typescript
// Entrance (when mascot first appears)
mascot.triggerDialogue('entrance', gameContext);

// Hyping (during build-up to wave)
mascot.triggerDialogue('hyping', gameContext);

// Dancing (celebrating successful wave)
mascot.triggerDialogue('dancing', gameContext);

// Disappointed (after failed wave)
mascot.triggerDialogue('disappointed', gameContext);

// Ultimate (during special ability)
mascot.triggerDialogue('ultimate', gameContext);

// Exit (when mascot leaves)
mascot.triggerDialogue('exit', gameContext);
```

## Testing

### Mock Personalities for Tests

```typescript
import type { VendorPersonality } from '@/types/personalities';

const mockVendorPersonality: VendorPersonality = {
  id: 'test-vendor',
  name: 'Test Vendor',
  description: 'A test vendor',
  productType: 'drinks',
  traits: [],
  dialogue: [
    {
      id: 'test-dialogue',
      text: 'Hello!',
      context: { event: 'vendorServe' },
      emotion: 'excited',
      priority: 5,
      cooldown: 30000,
    },
  ],
  movement: {
    speed: 100,
    pauseDuration: 2000,
    sectionPreferences: {},
    avoidsActiveWave: false,
  },
  appearance: {
    spriteSheet: 'test-sprite',
    animations: [],
    colorPalette: ['#FF0000'],
    scale: 1.0,
  },
  metadata: {
    model: 'test',
    temperature: 0.7,
    promptTokens: 100,
    completionTokens: 100,
    cost: 0.01,
    generatedAt: Date.now(),
    epoch: 0,
    usageCount: 0,
  },
};
```

## Architecture Notes

### Event-Driven Design

The system uses an event-driven architecture where:

1. Game events (wave start, vendor serve, etc.) are emitted by managers
2. Scene/systems listen for these events
3. Event handlers trigger dialogue selection
4. DialogueDisplayManager shows the dialogue

This approach is:
- **Decoupled**: Entities don't need to know about UI
- **Extensible**: Easy to add new event types
- **Testable**: Events can be triggered independently

### Dialogue Cooldowns

DialogueManager automatically tracks usage and enforces cooldowns:

```typescript
// First call returns dialogue
const dialogue1 = vendor.triggerDialogue('vendorServe', gameContext);
console.log(dialogue1); // "Get your drinks here!"

// Immediate second call might return same line if no cooldown elapsed
const dialogue2 = vendor.triggerDialogue('vendorServe', gameContext);
console.log(dialogue2); // "Get your drinks here!" (or different line)

// After cooldown period (e.g., 30 seconds), line becomes available again
```

### Performance Considerations

- **O(1)** dialogue usage tracking per character+line
- **< 1ms** dialogue selection target
- Personalities loaded once at scene start
- Static content fallback if IndexedDB unavailable

## Troubleshooting

### No Dialogue Showing

1. Check that PersonalityIntegrationManager is initialized with `await`
2. Verify DialogueDisplayManager is created and updated
3. Ensure entities have personalities assigned
4. Check console for warnings about missing personalities

### Wrong Personality Applied

1. Verify vendor/mascot index passed to `createVendor`/`createMascot`
2. Check that static content file has personalities loaded
3. Use `getContent()` to inspect loaded personalities

### Dialogue Repeating Too Often

1. Increase cooldown values in personality definitions
2. Add more dialogue variations for the same event
3. Check that DialogueManager is being reused (not recreated)

## Example: Complete Integration

See `src/scenes/StadiumScene.ts` for a complete working example of personality integration.
