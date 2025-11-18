/**
 * Personality Demo Scene
 * 
 * Demonstrates AI personality integration with vendors, mascots, and announcer.
 * This scene shows how to:
 * - Load personalities from AIContentManager
 * - Create entities with personalities
 * - Trigger dialogue based on game events
 * - Display dialogue on screen
 */

import Phaser from 'phaser';
import { PersonalityIntegrationManager } from '@/systems/PersonalityIntegrationManager';
import { DialogueDisplayManager } from '@/systems/DialogueDisplayManager';
import { Vendor } from '@/sprites/Vendor';
import { Mascot } from '@/sprites/Mascot';

export class PersonalityDemoScene extends Phaser.Scene {
  private personalityManager!: PersonalityIntegrationManager;
  private dialogueDisplay!: DialogueDisplayManager;
  private vendor!: Vendor;
  private mascot!: Mascot;
  private demoStage: number = 0;
  private stageTimer: number = 0;
  private instructionText!: Phaser.GameObjects.Text;

  constructor() {
    super({ key: 'PersonalityDemoScene' });
  }

  async create() {
    // Title
    this.add.text(512, 50, 'AI Personality Demo', {
      fontSize: '48px',
      fontFamily: 'Arial',
      color: '#ffffff',
    }).setOrigin(0.5);

    // Instructions
    this.instructionText = this.add.text(512, 120, 'Loading personalities...', {
      fontSize: '20px',
      fontFamily: 'Arial',
      color: '#ffff00',
      align: 'center',
    }).setOrigin(0.5);

    // Initialize personality system
    this.personalityManager = PersonalityIntegrationManager.getInstance();
    await this.personalityManager.initialize();

    const content = this.personalityManager.getContent();
    if (!content) {
      this.instructionText.setText('Failed to load personalities!\nCheck console for errors.');
      return;
    }

    this.instructionText.setText(
      `Loaded ${content.vendors.length} vendors, ${content.mascots.length} mascots, ${content.announcers.length} announcers`
    );

    // Initialize dialogue display
    this.dialogueDisplay = new DialogueDisplayManager(this);

    // Create vendor with personality
    this.vendor = this.personalityManager.createVendor(this, 300, 350, 0);
    const vendorPersonality = this.vendor.getPersonality();
    if (vendorPersonality) {
      this.add.text(300, 450, vendorPersonality.name, {
        fontSize: '18px',
        fontFamily: 'Arial',
        color: '#ffffff',
      }).setOrigin(0.5);
    }

    // Create mascot with personality
    this.mascot = this.personalityManager.createMascot(this, 700, 350, 0);
    const mascotPersonality = this.mascot.getPersonality();
    if (mascotPersonality) {
      this.add.text(700, 450, mascotPersonality.name, {
        fontSize: '18px',
        fontFamily: 'Arial',
        color: '#ffffff',
      }).setOrigin(0.5);
    }

    // Demo controls
    this.add.text(512, 550, 'Press SPACE to advance demo', {
      fontSize: '18px',
      fontFamily: 'Arial',
      color: '#00ff00',
    }).setOrigin(0.5);

    // Info panel
    this.add.rectangle(512, 200, 800, 100, 0x000000, 0.7);
    const infoText = this.add.text(512, 180, 'Demo Stages:', {
      fontSize: '16px',
      fontFamily: 'Arial',
      color: '#ffffff',
      align: 'left',
    }).setOrigin(0.5, 0);

    const stages = [
      '1. Vendor serves (dialogue + behavior modifiers)',
      '2. Wave success (announcer commentary)',
      '3. Mascot entrance (dialogue)',
      '4. Mascot ultimate ability (dialogue + effects)',
      '5. Wave fail (announcer commentary)',
    ];

    stages.forEach((stage, i) => {
      this.add.text(120, 200 + i * 20, stage, {
        fontSize: '14px',
        fontFamily: 'Arial',
        color: '#cccccc',
      });
    });

    // Set up space key
    this.input.keyboard?.on('keydown-SPACE', () => {
      this.advanceDemo();
    });

    // Start demo
    this.instructionText.setText('Ready! Press SPACE to start demo');
  }

  private advanceDemo(): void {
    this.demoStage++;

    switch (this.demoStage) {
      case 1:
        this.demoVendorServe();
        break;
      case 2:
        this.demoWaveSuccess();
        break;
      case 3:
        this.demoMascotEntrance();
        break;
      case 4:
        this.demoMascotUltimate();
        break;
      case 5:
        this.demoWaveFail();
        break;
      default:
        this.instructionText.setText('Demo complete! Press R to restart');
        this.input.keyboard?.on('keydown-R', () => {
          this.scene.restart();
        });
    }
  }

  private demoVendorServe(): void {
    this.instructionText.setText('Stage 1: Vendor serving drinks');

    // Trigger vendor dialogue
    const dialogue = this.vendor.triggerDialogue('vendorServe', {
      score: 100,
      waveState: 'inactive',
      sectionStats: {
        happiness: 70,
        thirst: 60,
        attention: 75,
      },
    });

    if (dialogue && this.vendor.getPersonality()) {
      this.dialogueDisplay.showDialogue(this.vendor.getPersonality()!.name, dialogue);
    }

    // Show behavior modifiers
    const speed = this.vendor.getMovementSpeed();
    const pauseDuration = this.vendor.getPauseDuration();
    const avoidsWaves = this.vendor.avoidsActiveWave();

    setTimeout(() => {
      this.instructionText.setText(
        `Vendor Behavior:\nSpeed: ${speed}px/s | Pause: ${pauseDuration}ms | Avoids Waves: ${avoidsWaves}`
      );
    }, 3500);
  }

  private demoWaveSuccess(): void {
    this.instructionText.setText('Stage 2: Wave completed successfully!');

    const announcer = this.personalityManager.getAnnouncerSystem();
    if (!announcer) {
      this.instructionText.setText('No announcer loaded!');
      return;
    }

    const commentary = announcer.getCommentary('waveSuccess', {
      score: 500,
      waveState: 'inactive',
      multiplier: 2.0,
    });

    if (commentary && announcer.getAnnouncerContent()) {
      this.dialogueDisplay.showDialogue(
        announcer.getAnnouncerContent()!.name,
        commentary
      );
    }
  }

  private demoMascotEntrance(): void {
    this.instructionText.setText('Stage 3: Mascot enters the stadium!');

    const dialogue = this.mascot.triggerDialogue('entrance', {
      score: 500,
      waveState: 'inactive',
      aggregateStats: {
        happiness: 70,
        thirst: 50,
        attention: 80,
      },
    });

    if (dialogue && this.mascot.getPersonality()) {
      this.dialogueDisplay.showDialogue(this.mascot.getPersonality()!.name, dialogue);
    }
  }

  private demoMascotUltimate(): void {
    this.instructionText.setText('Stage 4: Mascot activates ultimate ability!');

    // Activate ability
    const activated = this.mascot.activateAbility(0);
    if (!activated) {
      this.instructionText.setText('Mascot ability failed to activate!');
      return;
    }

    // Get effects
    const effects = this.mascot.getActiveEffects();
    const effectText = effects
      .map(e => `${e.stat} ${e.type} ${e.value} (${e.target})`)
      .join(', ');

    // Trigger dialogue
    const dialogue = this.mascot.triggerDialogue('ultimate', {
      score: 800,
      waveState: 'active',
    });

    if (dialogue && this.mascot.getPersonality()) {
      this.dialogueDisplay.showDialogue(this.mascot.getPersonality()!.name, dialogue);
    }

    setTimeout(() => {
      this.instructionText.setText(`Ability Effects: ${effectText}`);
    }, 3500);
  }

  private demoWaveFail(): void {
    this.instructionText.setText('Stage 5: Wave failed!');

    const announcer = this.personalityManager.getAnnouncerSystem();
    if (!announcer) {
      this.instructionText.setText('No announcer loaded!');
      return;
    }

    const commentary = announcer.getCommentary('waveFail', {
      score: 700,
      waveState: 'inactive',
    });

    if (commentary && announcer.getAnnouncerContent()) {
      this.dialogueDisplay.showDialogue(
        announcer.getAnnouncerContent()!.name,
        commentary
      );
    }

    // Also trigger mascot disappointed dialogue
    setTimeout(() => {
      const mascotDialogue = this.mascot.triggerDialogue('disappointed', {
        score: 700,
        waveState: 'inactive',
      });

      if (mascotDialogue && this.mascot.getPersonality()) {
        this.dialogueDisplay.showDialogue(
          this.mascot.getPersonality()!.name,
          mascotDialogue
        );
      }
    }, 3500);
  }

  update(time: number, delta: number): void {
    // Update dialogue display
    this.dialogueDisplay.update(time, delta);

    // Update entities
    this.vendor.update(delta);
    this.mascot.update(delta);
  }

  shutdown(): void {
    // Clean up
    if (this.dialogueDisplay) {
      this.dialogueDisplay.destroy();
    }
  }
}
