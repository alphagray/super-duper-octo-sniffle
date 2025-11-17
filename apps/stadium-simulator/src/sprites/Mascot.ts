import Phaser from 'phaser';
import { BaseActorSprite } from './helpers/BaseActor';

export class Mascot extends BaseActorSprite {
  private cooldown: number;
  private isActive: boolean;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'mascot', 'mascot', false); // texture key, actorType, logging disabled
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.cooldown = 0;
    this.isActive = false;
    this.logger.debug('Mascot created');

    // TODO: Add animation setup
  }

  public activate(): void {
    // TODO: Implement mascot activation logic
    // Trigger special ability
    if (this.cooldown <= 0) {
      this.isActive = true;
      this.cooldown = 300; // 5 second cooldown at 60 FPS
      this.logger.event('Activated special ability');
    } else {
      this.logger.debug(`Cannot activate (cooldown: ${Math.round(this.cooldown)}ms)`);
    }
  }

  public update(delta: number): void {
    // TODO: Update cooldown timer and active state
    if (this.cooldown > 0) {
      this.cooldown -= delta;
    }

    if (this.isActive && this.cooldown < 240) {
      // Active for 1 second
      this.isActive = false;
    }
  }

  public getBody(): Phaser.Physics.Arcade.Body {
    return this.body as Phaser.Physics.Arcade.Body;
  }
}
