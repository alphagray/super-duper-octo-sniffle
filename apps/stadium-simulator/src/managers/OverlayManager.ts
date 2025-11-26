import type Phaser from 'phaser';
import { BaseOverlay } from '@/ui/overlays/BaseOverlay';
import { WaveCelebrationOverlay } from '@/ui/overlays/WaveCelebrationOverlay';

export type WaveCelebrationState = 'success' | 'fail' | 'neutral';

export interface WaveCelebrationPayload {
  sectionId: string;
  participation: number; // 0-100
  state: WaveCelebrationState;
  reasons: string[];
}

type OverlayQueue = BaseOverlay[];

export class OverlayManager {
  private scene: Phaser.Scene;
  private queues: Map<string, OverlayQueue> = new Map();
  private queueMax = 2;
  private defaultDepth = 75;
  private sectionPositionResolver?: (sectionId: string) => { x: number; y: number };

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  public update(_delta: number): void {
    // Overlays manage their own lifecycle via tweens; manager keeps queues tidy
    for (const [sectionId, queue] of this.queues) {
      // Remove destroyed overlays
      const alive = queue.filter((o) => o.getState() !== 'destroyed');
      if (alive.length !== queue.length) {
        this.queues.set(sectionId, alive);
      }
    }
  }

  /**
   * Provide a resolver function to compute section top world position.
   */
  public setSectionPositionResolver(
    resolver: (sectionId: string) => { x: number; y: number }
  ): void {
    this.sectionPositionResolver = resolver;
  }

  public createWaveCelebration(payload: WaveCelebrationPayload): void {
    const { sectionId, participation, state, reasons } = payload;
    const queue = this.ensureQueue(sectionId);

    // If queue is full, finish the oldest overlay quickly
    if (queue.length >= this.queueMax) {
      const oldest = queue[0];
      oldest.finish();
      queue.shift();
    }

    // Build overlay using WaveCelebrationOverlay
    const { x, y } = this.getSectionTopWorldPosition(sectionId);
    const overlay = new WaveCelebrationOverlay(this.scene, x, y, {
      participation,
      state,
      reasons,
      depth: this.defaultDepth,
      durationMs: 1500,
    });
    queue.push(overlay);
    overlay.start();
  }

  private ensureQueue(sectionId: string): OverlayQueue {
    const existing = this.queues.get(sectionId);
    if (existing) return existing;
    const created: OverlayQueue = [];
    this.queues.set(sectionId, created);
    return created;
  }

  // Placeholder: StadiumScene should provide actual section world positions.
  // For now, position near given section id via a simple mapping or default center.
  private getSectionTopWorldPosition(_sectionId: string): { x: number; y: number } {
    if (this.sectionPositionResolver) {
      return this.sectionPositionResolver(_sectionId);
    }
    const width = this.scene.scale?.width ?? 800;
    const height = this.scene.scale?.height ?? 600;
    return { x: width / 2, y: height / 3 };
  }
}
