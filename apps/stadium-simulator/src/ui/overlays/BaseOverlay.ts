import type Phaser from 'phaser';

export type OverlayLifecycleState = 'created' | 'started' | 'finished' | 'destroyed';

export interface BaseOverlayOptions {
  depth?: number;
  durationMs?: number;
}

export abstract class BaseOverlay {
  protected scene: Phaser.Scene;
  protected container: Phaser.GameObjects.Container;
  protected state: OverlayLifecycleState = 'created';
  protected depth: number;
  protected durationMs: number;

  constructor(scene: Phaser.Scene, x: number, y: number, options: BaseOverlayOptions = {}) {
    this.scene = scene;
    this.depth = options.depth ?? 75;
    this.durationMs = options.durationMs ?? 1500;
    this.container = scene.add.container(x, y);
    this.container.setDepth(this.depth);
    // Derived classes must call build() after setting their properties
  }

  protected abstract build(): void;

  public start(): void {
    if (this.state !== 'created') return;
    this.state = 'started';
    this.onStart();
    // Default animation: drift up 40px and fade out over duration
    const drift = 40;
    this.scene.tweens.add({
      targets: this.container,
      y: this.container.y - drift,
      alpha: 0,
      duration: this.durationMs,
      ease: 'Quad.easeOut',
      onComplete: () => {
        this.finish();
      },
    });
  }

  protected onStart(): void {}

  public finish(): void {
    if (this.state === 'finished' || this.state === 'destroyed') return;
    this.state = 'finished';
    this.onFinish();
    this.destroy();
  }

  protected onFinish(): void {}

  public destroy(): void {
    if (this.state === 'destroyed') return;
    this.state = 'destroyed';
    if (this.container) {
      this.container.destroy(true);
    }
  }

  public setDepth(depth: number): void {
    this.depth = depth;
    this.container.setDepth(depth);
  }

  public getState(): OverlayLifecycleState {
    return this.state;
  }
}
