import Phaser from 'phaser';
import { SpeechBubble } from '@/ui/SpeechBubble';

/**
 * SpeechBubbleDemo Scene
 * 
 * Demonstrates the SpeechBubble component with various characters and configurations.
 * Access via URL parameter: ?demo=speech
 */
export class SpeechBubbleDemoScene extends Phaser.Scene {
  private character1?: Phaser.GameObjects.Rectangle;
  private character2?: Phaser.GameObjects.Rectangle;
  private character3?: Phaser.GameObjects.Rectangle;

  constructor() {
    super({ key: 'SpeechBubbleDemoScene' });
  }

  create(): void {
    // Background
    this.cameras.main.setBackgroundColor('#2d2d2d');

    // Title
    this.add.text(this.cameras.main.centerX, 50, 'SPEECH BUBBLE DEMO', {
      fontFamily: '"Courier New", monospace',
      fontSize: '24px',
      color: '#4a90e2',
    }).setOrigin(0.5);

    // Instructions
    const instructions = [
      'Press 1-6 to show different speech bubbles',
      'Press Ctrl+Shift+D to toggle Dev Panel',
      '',
      '1: Vendor greeting',
      '2: Mascot catchphrase',
      '3: Long multi-line text',
      '4: Short exclamation',
      '5: Different tail positions',
      '6: Custom styling',
    ];

    let y = 100;
    instructions.forEach((line) => {
      this.add.text(20, y, line, {
        fontFamily: '"Courier New", monospace',
        fontSize: '12px',
        color: '#f0f0f0',
      });
      y += 20;
    });

    // Create demo characters
    this.createDemoCharacters();

    // Set up keyboard controls
    this.setupKeyboardControls();

    // Show initial bubble after a delay
    this.time.delayedCall(1000, () => {
      this.showBubble1();
    });
  }

  private createDemoCharacters(): void {
    // Character 1 (Vendor-like)
    this.character1 = this.add.rectangle(200, 400, 60, 80, 0x50c878);
    
    this.add.text(200, 450, 'Vendor', {
      fontFamily: '"Courier New", monospace',
      fontSize: '12px',
      color: '#50c878',
    }).setOrigin(0.5);

    // Character 2 (Mascot-like)
    this.character2 = this.add.rectangle(400, 400, 70, 90, 0xffd700);

    this.add.text(400, 450, 'Mascot', {
      fontFamily: '"Courier New", monospace',
      fontSize: '12px',
      color: '#ffd700',
    }).setOrigin(0.5);

    // Character 3 (Generic)
    this.character3 = this.add.rectangle(600, 400, 60, 80, 0x9b59b6);
    
    this.add.text(600, 450, 'Character', {
      fontFamily: '"Courier New", monospace',
      fontSize: '12px',
      color: '#9b59b6',
    }).setOrigin(0.5);
  }

  private setupKeyboardControls(): void {
    this.input.keyboard?.on('keydown', (event: KeyboardEvent) => {
      switch (event.key) {
        case '1':
          this.showBubble1();
          break;
        case '2':
          this.showBubble2();
          break;
        case '3':
          this.showBubble3();
          break;
        case '4':
          this.showBubble4();
          break;
        case '5':
          this.showBubble5();
          break;
        case '6':
          this.showBubble6();
          break;
      }
    });
  }

  private showBubble1(): void {
    if (!this.character1) return;

    const bubble = new SpeechBubble(this, 0, 0, {
      text: "Hot dogs! Get your hot dogs here! 🌭",
      duration: 3000,
    });
    
    bubble.positionAboveTarget(this.character1, 20);
    this.add.existing(bubble);
  }

  private showBubble2(): void {
    if (!this.character2) return;

    const bubble = new SpeechBubble(this, 0, 0, {
      text: "LET'S GO TEAM! 🎉",
      duration: 3000,
      fontSize: 14,
    });
    
    bubble.positionAboveTarget(this.character2, 20);
    this.add.existing(bubble);
  }

  private showBubble3(): void {
    if (!this.character3) return;

    const bubble = new SpeechBubble(this, 0, 0, {
      text: "This is a longer message that demonstrates how the speech bubble handles multi-line text with word wrapping!",
      duration: 5000,
      maxWidth: 250,
    });
    
    bubble.positionAboveTarget(this.character3, 20);
    this.add.existing(bubble);
  }

  private showBubble4(): void {
    if (!this.character1) return;

    const bubble = new SpeechBubble(this, 0, 0, {
      text: "WOW!",
      duration: 2000,
      fontSize: 16,
      padding: 12,
    });
    
    bubble.positionAboveTarget(this.character1, 20);
    this.add.existing(bubble);
  }

  private showBubble5(): void {
    // Show three bubbles with different tail positions
    if (!this.character1) return;
    if (!this.character2) return;
    if (!this.character3) return;

    const bubble1 = new SpeechBubble(this, 0, 0, {
      text: "Left tail",
      duration: 3000,
      tailPosition: 'bottom-left',
    });
    bubble1.positionAboveTarget(this.character1, 20);
    this.add.existing(bubble1);

    const bubble2 = new SpeechBubble(this, 0, 0, {
      text: "Center tail",
      duration: 3000,
      tailPosition: 'bottom-center',
    });
    bubble2.positionAboveTarget(this.character2, 20);
    this.add.existing(bubble2);

    const bubble3 = new SpeechBubble(this, 0, 0, {
      text: "Right tail",
      duration: 3000,
      tailPosition: 'bottom-right',
    });
    bubble3.positionAboveTarget(this.character3, 20);
    this.add.existing(bubble3);
  }

  private showBubble6(): void {
    if (!this.character2) return;

    const bubble = new SpeechBubble(this, 0, 0, {
      text: "Custom fade times! ✨",
      duration: 4000,
      fadeInDuration: 500,
      fadeOutDuration: 500,
      fontSize: 14,
      padding: 10,
    });
    
    bubble.positionAboveTarget(this.character2, 20);
    this.add.existing(bubble);
  }
}
