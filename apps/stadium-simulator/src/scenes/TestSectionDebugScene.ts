import Phaser from 'phaser';
import { StadiumSection } from '@/sprites/StadiumSection';
import { SectionConfig } from '@/types/GameTypes';
import { SeatManager } from '@/managers/SeatManager';
import { Fan } from '@/sprites/Fan';

/**
 * TestSectionDebugScene displays a single section with per-fan debug stats
 * Shows happiness, thirst, and attention values in bright blue text above each fan
 */
export class TestSectionDebugScene extends Phaser.Scene {
  private section?: StadiumSection;
  private seatManager?: SeatManager;
  private debugTexts: Phaser.GameObjects.Text[] = [];
  private timeElapsed: number = 0;
  private isPaused: boolean = false;
  private waveLine?: Phaser.GameObjects.Line;
  private columnResultTexts: Phaser.GameObjects.Text[] = [];
  private waveLineCreated: boolean = false;

  constructor() {
    super({ key: 'TestSectionDebugScene' });
  }

  create(): void {
    // Title
    this.add.text(this.cameras.main.centerX, 30, 'FAN STATS DEBUG SCENE', {
      fontSize: '32px',
      fontFamily: 'Arial',
      color: '#ffffff',
    }).setOrigin(0.5);

    // Instructions
    this.add.text(this.cameras.main.centerX, 70, 'Press SPACE to pause/resume | Press R to reset stats', {
      fontSize: '16px',
      fontFamily: 'Arial',
      color: '#cccccc',
    }).setOrigin(0.5);

    // Section config with smaller section for easier viewing
    const sectionConfig: SectionConfig = {
      width: 400,
      height: 300,
      rowCount: 4,
      seatsPerRow: 8,
      rowBaseHeightPercent: 0.15,
      startLightness: 62,
      autoPopulate: true,
    };

    // Create section centered on screen
    this.section = new StadiumSection(
      this,
      this.cameras.main.centerX,
      this.cameras.main.centerY + 50,
      sectionConfig,
      'DEBUG'
    );

    // Initialize SeatManager
    this.seatManager = new SeatManager(this);
    this.seatManager.initializeSections([this.section]);
    this.seatManager.populateAllSeats(20); // Smaller fans for debug scene

    // Create debug text for each fan
    this.createDebugTexts();

    // Add keyboard controls
    this.input.keyboard?.on('keydown-SPACE', () => {
      this.isPaused = !this.isPaused;
    });

    this.input.keyboard?.on('keydown-R', () => {
      this.resetFanStats();
    });

    // Add time elapsed display
    this.add.text(20, 100, '', {
      fontSize: '18px',
      fontFamily: 'Arial',
      color: '#ffffff',
    }).setName('timeDisplay');

    // Add aggregate stats display (right side to avoid control overlap)
    this.add.text(this.cameras.main.width - 20, 100, '', {
      fontSize: '16px',
      fontFamily: 'Arial',
      color: '#ffff00',
      align: 'right',
    }).setOrigin(1, 0).setName('aggregateDisplay');

    // Add wave button
    const waveBtn = this.add.text(this.cameras.main.centerX, 110, '[ START WAVE ]', {
      fontSize: '20px',
      fontFamily: 'Arial',
      color: '#00ff99',
      backgroundColor: '#222',
      padding: { x: 8, y: 4 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    waveBtn.on('pointerdown', async () => {
      if (!this.section) return;
      waveBtn.setText('WAVE IN PROGRESS...');
      waveBtn.disableInteractive();
      // Remove previous result texts
      this.columnResultTexts.forEach(t => t.destroy());
      this.columnResultTexts = [];
      // Only create the wave line once
      if (!this.waveLineCreated) {
        const sectionX = this.section.x;
        const sectionY = this.section.y;
        const sectionWidth = this.section['sectionWidth'];
        const sectionHeight = this.section['sectionHeight'];
        const x = sectionX - sectionWidth / 2;
        this.waveLine = this.add.line(0, 0, x, sectionY - sectionHeight / 2, x, sectionY + sectionHeight / 2, 0x00ffff, 1).setLineWidth(3).setDepth(9999);
        this.waveLineCreated = true;
      }
      if (this.waveLine) this.waveLine.setVisible(true);
      // Reset all fans' participation flag
      const fans = this.section.getFans();
      fans.forEach(fan => fan._lastWaveParticipated = false);
      try {
        // Get seat/column layout
        const rows = this.section.getRows();
        const seatCount = rows[0].getSeats().length;
        const rowCount = rows.length;
        const sectionX = this.section.x;
        const sectionY = this.section.y;
        const sectionWidth = this.section['sectionWidth'];
        const sectionHeight = this.section['sectionHeight'];
        const colWidth = sectionWidth / seatCount;
        // For each column, roll participation, animate the line, and show result
        for (let col = 0; col < seatCount; col++) {
          // Roll participation for this column
          let colFans = 0;
          let colParticipants = 0;
          const fanWavePromises: Promise<void>[] = [];
          for (let rowIdx = 0; rowIdx < rowCount; rowIdx++) {
            const row = rows[rowIdx];
            const seats = row.getSeats();
            if (col < seats.length) {
              const seat = seats[col];
              if (!seat.isEmpty()) {
                colFans++;
                const fan = seat.getFan();
                if (fan) {
                  // Only roll if not already set for this wave
                  if (fan._lastWaveParticipated === false) {
                    const sectionBonus = this.section.getSectionWaveBonus();
                    fan._lastWaveParticipated = fan.rollForWaveParticipation(sectionBonus);
                  }
                  if (fan._lastWaveParticipated) {
                    colParticipants++;
                    // Play wave animation for this fan (row delay for realism)
                    fanWavePromises.push(fan.playWave(rowIdx * 10));
                  }
                }
              }
            }
          }
          // Animate vertical line at this column
          const x = sectionX - sectionWidth / 2 + colWidth * (col + 0.5);
          if (this.waveLine) {
            this.waveLine.setTo(x, sectionY - sectionHeight / 2, x, sectionY + sectionHeight / 2);
            this.waveLine.setVisible(true);
          }
          const percent = colFans > 0 ? (colParticipants / colFans) : 0;
          const isSuccess = percent >= 0.4;
          // Show result text above column
          const resultText = this.add.text(x, sectionY - sectionHeight / 2 - 18, isSuccess ? 'success' : 'fail', {
            fontSize: '14px',
            fontFamily: 'Arial',
            color: isSuccess ? '#00ff00' : '#ff3333',
            backgroundColor: '#222',
            padding: { x: 2, y: 1 },
          }).setOrigin(0.5);
          this.columnResultTexts.push(resultText);
          // Wait for column animation and fan wave animations
          await Promise.all([
            new Promise(res => this.time.delayedCall(60, res)),
            ...fanWavePromises
          ]);
        }
        // Hide line after last column
        if (this.waveLine) this.waveLine.setVisible(false);
        // Highlight fans
        fans.forEach((fan, idx) => {
          if (fan._lastWaveParticipated) {
            this.debugTexts[idx].setColor('#00ff00'); // Green for participated
          } else {
            this.debugTexts[idx].setColor('#ff3333'); // Red for skipped
          }
        });
        await new Promise(res => setTimeout(res, 1200));
      } finally {
        // Always reset UI/button
        this.debugTexts.forEach(dt => dt.setColor('#00ddff'));
        this.columnResultTexts.forEach(t => t.destroy());
        this.columnResultTexts = [];
        if (this.waveLine) this.waveLine.setVisible(false);
        waveBtn.setText('[ START WAVE ]');
        waveBtn.setInteractive({ useHandCursor: true });
      }
    });

    // Add environmental controls
    const thirstLabel = this.add.text(20, 180, 'Thirst Growth Rate:', { fontSize: '14px', color: '#fff' });
    const thirstInput = this.add.dom(180, 185, 'input', 'width:40px').setOrigin(0, 0);
    (thirstInput.node as HTMLInputElement).value = String((window as any).Fan?.thirstGrowthRate ?? 2);
    thirstInput.addListener('input');
    thirstInput.on('input', () => {
      const v = parseFloat((thirstInput.node as HTMLInputElement).value);
      if (!isNaN(v)) (window as any).Fan.thirstGrowthRate = v;
    });

    const happyLabel = this.add.text(20, 210, 'Happiness Decay Rate:', { fontSize: '14px', color: '#fff' });
    const happyInput = this.add.dom(180, 215, 'input', 'width:40px').setOrigin(0, 0);
    (happyInput.node as HTMLInputElement).value = String((window as any).Fan?.happinessDecayRate ?? 1.25);
    happyInput.addListener('input');
    happyInput.on('input', () => {
      const v = parseFloat((happyInput.node as HTMLInputElement).value);
      if (!isNaN(v)) (window as any).Fan.happinessDecayRate = v;
    });

    const freezeLabel = this.add.text(20, 240, 'Thirst Freeze (ms):', { fontSize: '14px', color: '#fff' });
    const freezeInput = this.add.dom(180, 245, 'input', 'width:60px').setOrigin(0, 0);
    (freezeInput.node as HTMLInputElement).value = String((window as any).Fan?.thirstFreezeDuration ?? 4000);
    freezeInput.addListener('input');
    freezeInput.on('input', () => {
      const v = parseInt((freezeInput.node as HTMLInputElement).value, 10);
      if (!isNaN(v)) (window as any).Fan.thirstFreezeDuration = v;
    });

    // Make Fan class available for UI controls
    (window as any).Fan = Fan;
  }

  private createDebugTexts(): void {
    if (!this.section) return;

    const fans = this.section.getFans();
    
    fans.forEach((fan) => {
      // Position text above the fan
      const fanWorldPos = fan.getWorldTransformMatrix();
      const x = fanWorldPos.tx;
      const y = fanWorldPos.ty - 20;

      const debugText = this.add.text(x, y, '', {
        fontSize: '10px',
        fontFamily: 'monospace',
        color: '#00ddff', // Bright blue
        backgroundColor: '#000000aa',
        padding: { x: 2, y: 1 },
      }).setOrigin(0.5, 1).setDepth(10000);

      this.debugTexts.push(debugText);
    });
  }

  private resetFanStats(): void {
    if (!this.section) return;

    const fans = this.section.getFans();
    fans.forEach((fan) => {
      // Reset to fresh values
      fan['happiness'] = 50 + (Math.random() * 40 - 20);
      fan['thirst'] = Math.random() * 30;
      fan['attention'] = 70 + (Math.random() * 20 - 10);
    });

    this.timeElapsed = 0;
  }

  update(time: number, delta: number): void {
    if (!this.isPaused && this.section) {
      // Update fan stats
      this.section.updateFanStats(delta);
      
      // Update fan visuals
      this.section.updateFanIntensity();

      // Track time
      this.timeElapsed += delta;
    }

    // Update debug texts
    this.updateDebugTexts();

    // Update time display
    const timeDisplay = this.children.getByName('timeDisplay') as Phaser.GameObjects.Text;
    if (timeDisplay) {
      const seconds = Math.floor(this.timeElapsed / 1000);
      const status = this.isPaused ? '[PAUSED]' : '[RUNNING]';
      timeDisplay.setText(`Time: ${seconds}s ${status}`);
    }

    // Update aggregate stats display
    const aggregateDisplay = this.children.getByName('aggregateDisplay') as Phaser.GameObjects.Text;
    if (aggregateDisplay && this.section) {
      const aggregate = this.section.getAggregateStats();
      const bonus = this.section.getSectionWaveBonus();
      aggregateDisplay.setText(
        `SECTION AGGREGATE:\n` +
        `Happiness: ${Math.round(aggregate.happiness)}\n` +
        `Thirst: ${Math.round(aggregate.thirst)}\n` +
        `Attention: ${Math.round(aggregate.attention)}\n` +
        `Wave Bonus: ${bonus.toFixed(1)}`
      );
    }
  }

  private updateDebugTexts(): void {
    if (!this.section) return;

    const fans = this.section.getFans();
    
    fans.forEach((fan, index) => {
      if (index < this.debugTexts.length) {
        const stats = fan.getStats();
        const waveChance = fan.calculateWaveChance(this.section!.getSectionWaveBonus());
        
        const text = [
          `H:${Math.round(stats.happiness)}`,
          `T:${Math.round(stats.thirst)}`,
          `A:${Math.round(stats.attention)}`,
          `W:${Math.round(waveChance)}%`
        ].join('\n');
        
        this.debugTexts[index].setText(text);
      }
    });
  }
}
