import { BaseManager } from '@/managers/base/BaseManager';
import { WaveManager } from '@/managers/WaveManager';
import type { Wave } from '@/managers/Wave';
import type { WaveType } from '@/managers/Wave';
import type { SeatManager } from '@/managers/SeatManager';
import type { VendorManager } from '@/managers/VendorManager';
import type { GameStateManager } from '@/managers/GameStateManager';
import type { GridManager } from '@/managers/GridManager';

// Events we bridge outward
const BRIDGED_EVENTS = [
  'waveStrengthChanged',
  'waveBoosterApplied',
  'columnStateRecorded',
  'waveCooldownStarted',
  'waveCreated',
  'waveFinalized',
  'waveStart',
  'waveComplete',
  'sectionWave'
];

/** Wrapper providing logging & unified event surface for WaveManager */
export class WaveManagerWrapper extends BaseManager {
  private inner: WaveManager;

  constructor(gameState: GameStateManager, vendorManager?: VendorManager, seatManager?: SeatManager, gridManager?: GridManager) {
    super({ name: 'Wave', category: 'manager:wave', logLevel: 'info' });
    this.inner = new WaveManager(gameState, vendorManager, seatManager, gridManager);

    BRIDGED_EVENTS.forEach(evt => {
      this.inner.on(evt, async (payload: any) => {
        // IMPORTANT: sectionWave must be awaited to preserve sequential propagation
        if (evt === 'sectionWave') {
          await this.emitAsync(evt, payload);
        } else {
          this.emit(evt, payload);
        }

        switch (evt) {
          case 'waveStart':
            this.log('event', 'Wave started');
            break;
          case 'waveStrengthChanged':
            this.log('debug', `Strength=${payload.strength}`);
            break;
          case 'waveComplete':
            this.log('info', 'Wave complete');
            break;
          case 'waveCreated':
            this.log('info', `Wave created origin=${payload.wave.originSection}`);
            break;
          case 'waveFinalized':
            this.log('info', `Wave finalized success=${payload.success}`);
            break;
        }
      });
    });
  }

  // Proxy core query methods
  isActive(): boolean { return this.inner.isActive(); }
  getCountdown(): number { return this.inner.getCountdown(); }
  getCurrentSection(): number { return this.inner.getCurrentSection(); }
  getScore(): number { return this.inner.getScore(); }
  getMultiplier(): number { return this.inner.getMultiplier(); }
  getWaveResults() { return this.inner.getWaveResults(); }
  getLastBoosterType() { return this.inner.getLastBoosterType(); }
  getWaveBoosterMultiplier() { return this.inner.getWaveBoosterMultiplier(); }
  getCurrentWaveStrength() { return this.inner.getCurrentWaveStrength(); }
  getColumnStateRecords(): Array<{ sectionId: string; columnIndex: number; participation: number; state: 'success'|'sputter'|'death' }> { return this.inner.getColumnStateRecords(); }

  // Proxy mutation / control methods used by scene
  startWave(): void { this.inner.startWave(); }
  createWave(originSectionId: string, type: WaveType = 'NORMAL'): Wave { return this.inner.createWave(originSectionId, type); }
  consumeForcedFlags(): { sputter: boolean; death: boolean } { return this.inner.consumeForcedFlags(); }
  classifyColumn(rate: number) { return this.inner.classifyColumn(rate); }
  recordColumnState(sectionId: string, columnIndex: number, participation: number, state: 'success'|'sputter'|'death') { this.inner.recordColumnState(sectionId, columnIndex, participation, state); }
  pushColumnParticipation(p: number) { this.inner.pushColumnParticipation(p); }
  calculateEnhancedRecovery(prev: 'success'|'sputter'|'death', curr: 'success'|'sputter'|'death') { return this.inner.calculateEnhancedRecovery(prev, curr); }
  setWaveStrength(val: number) { this.inner.setWaveStrength(val); }
  adjustWaveStrength(state: 'success'|'sputter'|'death', participation: number) { this.inner.adjustWaveStrength(state, participation); }
  setLastSectionWaveState(state: 'success'|'sputter'|'death'|null) { this.inner.setLastSectionWaveState(state); }
  updateCountdown(deltaTime: number): Promise<void> { return this.inner.updateCountdown(deltaTime); }
  checkWaveProbability(): string | null { return this.inner.checkWaveProbability(); }
  setForceSputter(flag: boolean): void { this.inner.setForceSputter(flag); }
  setForceDeath(flag: boolean): void { this.inner.setForceDeath(flag); }
  applyWaveBooster(type: 'momentum'|'recovery'|'participation'): void { this.inner.applyWaveBooster(type as any); }

  // Expose active wave & history helpers
  getActiveWave() { return this.inner.getActiveWave(); }
  getWaveHistory() { return this.inner.getWaveHistory(); }
  getMaxPossibleScore() { return this.inner.getMaxPossibleScore(); }

  // Autonomous helpers (if needed later)
  setSessionStartTime(time: number) { this.inner.setSessionStartTime(time); }
  
  // Grid-based wave sprite methods
  spawnWaveSprite(scene: Phaser.Scene, sections: string[]): void { this.inner.spawnWaveSprite(scene, sections); }
  setScene(scene: Phaser.Scene): void { this.inner.setScene(scene); }
}
