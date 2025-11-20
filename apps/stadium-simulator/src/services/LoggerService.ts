import type { LogEvent, LogLevel } from '@/managers/helpers/BaseManager';

interface LoggerConfig {
  globalLevel: LogLevel;
  categoryLevels: Record<string, LogLevel>; // overrides per category
  instanceLevels: Record<string, LogLevel>; // overrides per manager id
  bufferSize: number;
  consoleEnabled: boolean; // master console toggle
  consoleCategories: Record<string, boolean>; // category-specific console toggles
  panelCategories: Record<string, boolean>; // category-specific panel visibility toggles
}

/** Simple ring-buffer logger service */
export class LoggerService {
  private static _instance: LoggerService;
  private buffer: LogEvent[] = [];
  private config: LoggerConfig = {
    globalLevel: 'info',
    categoryLevels: {},
    instanceLevels: {},
    bufferSize: 1000,
    consoleEnabled: false,
    consoleCategories: {},
    panelCategories: {}
  };

  static instance(): LoggerService {
    if (!LoggerService._instance) {
      LoggerService._instance = new LoggerService();
    }
    return LoggerService._instance;
  }

  configure(partial: Partial<LoggerConfig>): void {
    this.config = { ...this.config, ...partial };
  }

  push(evt: LogEvent): void {
    this.buffer.push(evt);
    if (this.buffer.length > this.config.bufferSize) {
      this.buffer.splice(0, this.buffer.length - this.config.bufferSize);
    }
    // Conditional console output
    if (!this.config.consoleEnabled) return;
    const catFlag = this.config.consoleCategories;
    if (Object.keys(catFlag).length > 0 && catFlag[evt.category] === false) return;
    if (evt.level === 'error') {
      console.error(`[${evt.category}] ${evt.message}`, evt.data || '');
    } else if (evt.level === 'warn') {
      console.warn(`[${evt.category}] ${evt.message}`);
    } else if (evt.level === 'info' || evt.level === 'event') {
      console.log(`[${evt.category}] ${evt.message}`);
    } else if (evt.level === 'debug') {
      console.debug(`[${evt.category}] ${evt.message}`);
    }
  }

  setConsoleEnabled(flag: boolean): void { this.config.consoleEnabled = flag; }
  setConsoleCategory(category: string, flag: boolean): void { this.config.consoleCategories[category] = flag; }
  setPanelCategory(category: string, flag: boolean): void { this.config.panelCategories[category] = flag; }
  getPanelCategories(): Record<string, boolean> { return { ...this.config.panelCategories }; }
  getConsoleCategories(): Record<string, boolean> { return { ...this.config.consoleCategories }; }

  getBuffer(): LogEvent[] {
    return [...this.buffer];
  }

  clear(): void { this.buffer = []; }
}
