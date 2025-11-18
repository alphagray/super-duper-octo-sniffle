import Phaser from 'phaser';

/**
 * SpeechBubble Configuration
 */
export interface SpeechBubbleConfig {
  /** Text to display in the bubble */
  text: string;
  /** Duration to display the bubble (milliseconds) */
  duration?: number;
  /** Fade in duration (milliseconds) */
  fadeInDuration?: number;
  /** Fade out duration (milliseconds) */
  fadeOutDuration?: number;
  /** Maximum width of the bubble */
  maxWidth?: number;
  /** Tail position ('bottom-left' | 'bottom-center' | 'bottom-right') */
  tailPosition?: 'bottom-left' | 'bottom-center' | 'bottom-right';
  /** Font size in pixels */
  fontSize?: number;
  /** Padding in pixels */
  padding?: number;
}

/**
 * SpeechBubble - Retro-style speech bubble for character dialogue
 * 
 * Features:
 * - Pixel-art border with tail
 * - Monospace font
 * - Auto-sizing based on text content
 * - Fade in/out animations
 * - Auto-destroy after duration
 * 
 * @example
 * ```typescript
 * const bubble = new SpeechBubble(this, 100, 100, {
 *   text: "Let's get this wave started!",
 *   duration: 3000
 * });
 * this.add.existing(bubble);
 * ```
 */
export class SpeechBubble extends Phaser.GameObjects.Container {
  private config: Required<SpeechBubbleConfig>;
  private background: Phaser.GameObjects.Graphics;
  private border: Phaser.GameObjects.Graphics;
  private tail: Phaser.GameObjects.Graphics;
  private textObject: Phaser.GameObjects.Text;
  private bubbleWidth: number = 0;
  private bubbleHeight: number = 0;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    config: SpeechBubbleConfig
  ) {
    super(scene, x, y);

    // Default configuration
    this.config = {
      text: config.text,
      duration: config.duration ?? 3000,
      fadeInDuration: config.fadeInDuration ?? 200,
      fadeOutDuration: config.fadeOutDuration ?? 200,
      maxWidth: config.maxWidth ?? 200,
      tailPosition: config.tailPosition ?? 'bottom-center',
      fontSize: config.fontSize ?? 12,
      padding: config.padding ?? 8,
    };

    // Create graphics objects
    this.background = scene.add.graphics();
    this.border = scene.add.graphics();
    this.tail = scene.add.graphics();

    // Create text object with monospace font
    this.textObject = scene.add.text(0, 0, '', {
      fontFamily: '"Courier New", monospace',
      fontSize: `${this.config.fontSize}px`,
      color: '#ffffff',
      wordWrap: { width: this.config.maxWidth - this.config.padding * 2 },
      align: 'left',
    });

    // Add all elements to container
    this.add([this.tail, this.background, this.border, this.textObject]);

    // Build the bubble
    this.buildBubble();

    // Set initial alpha to 0 for fade in
    this.setAlpha(0);

    // Start animations
    this.playAnimations();
  }

  /**
   * Build the speech bubble visual elements
   */
  private buildBubble(): void {
    // Set text content
    this.textObject.setText(this.config.text);

    // Calculate bubble dimensions
    const textBounds = this.textObject.getBounds();
    this.bubbleWidth = textBounds.width + this.config.padding * 2;
    this.bubbleHeight = textBounds.height + this.config.padding * 2;

    // Ensure minimum dimensions
    this.bubbleWidth = Math.max(this.bubbleWidth, 40);
    this.bubbleHeight = Math.max(this.bubbleHeight, 24);

    // Position text
    this.textObject.setPosition(this.config.padding, this.config.padding);

    // Draw background (light gray/white)
    this.background.clear();
    this.background.fillStyle(0xf0f0f0, 1);
    this.background.fillRoundedRect(0, 0, this.bubbleWidth, this.bubbleHeight, 4);

    // Draw pixel-art border (dark gray/black)
    this.border.clear();
    this.border.lineStyle(2, 0x333333, 1);
    this.border.strokeRoundedRect(0, 0, this.bubbleWidth, this.bubbleHeight, 4);

    // Draw tail
    this.drawTail();

    // Center the bubble on the position
    this.setSize(this.bubbleWidth, this.bubbleHeight);
  }

  /**
   * Draw the speech bubble tail
   */
  private drawTail(): void {
    this.tail.clear();
    this.tail.fillStyle(0xf0f0f0, 1);
    this.tail.lineStyle(2, 0x333333, 1);

    const tailHeight = 12;
    const tailWidth = 16;
    let tailX = 0;

    // Calculate tail position based on config
    switch (this.config.tailPosition) {
      case 'bottom-left':
        tailX = this.bubbleWidth * 0.25;
        break;
      case 'bottom-center':
        tailX = this.bubbleWidth * 0.5;
        break;
      case 'bottom-right':
        tailX = this.bubbleWidth * 0.75;
        break;
    }

    // Draw triangle tail
    const tailY = this.bubbleHeight;
    
    // Fill
    this.tail.beginPath();
    this.tail.moveTo(tailX - tailWidth / 2, tailY);
    this.tail.lineTo(tailX, tailY + tailHeight);
    this.tail.lineTo(tailX + tailWidth / 2, tailY);
    this.tail.closePath();
    this.tail.fillPath();

    // Stroke (border)
    this.tail.beginPath();
    this.tail.moveTo(tailX - tailWidth / 2, tailY);
    this.tail.lineTo(tailX, tailY + tailHeight);
    this.tail.lineTo(tailX + tailWidth / 2, tailY);
    this.tail.strokePath();
  }

  /**
   * Play fade in/out animations and auto-destroy
   */
  private playAnimations(): void {
    const scene = this.scene;

    // Fade in
    scene.tweens.add({
      targets: this,
      alpha: 1,
      duration: this.config.fadeInDuration,
      ease: 'Power2',
    });

    // Wait for duration, then fade out
    scene.time.delayedCall(this.config.duration, () => {
      scene.tweens.add({
        targets: this,
        alpha: 0,
        duration: this.config.fadeOutDuration,
        ease: 'Power2',
        onComplete: () => {
          this.destroy();
        },
      });
    });
  }

  /**
   * Update the bubble text and rebuild
   */
  public setText(text: string): void {
    this.config.text = text;
    this.buildBubble();
  }

  /**
   * Position the bubble relative to a target (e.g., character sprite)
   * This positions the bubble above the target with the tail pointing down
   */
  public positionAboveTarget(
    target: Phaser.GameObjects.GameObject & { x?: number; y?: number },
    offsetY: number = 20
  ): void {
    const bounds = (target as any).getBounds?.() || { 
      x: target.x ?? 0, 
      y: target.y ?? 0, 
      width: 0, 
      height: 0 
    };
    this.setPosition(
      bounds.x + bounds.width / 2 - this.bubbleWidth / 2,
      bounds.y - this.bubbleHeight - offsetY
    );
  }

  /**
   * Clean up resources
   */
  public destroy(fromScene?: boolean): void {
    this.background.destroy();
    this.border.destroy();
    this.tail.destroy();
    this.textObject.destroy();
    super.destroy(fromScene);
  }
}
