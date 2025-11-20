import { LoggerService } from '@/services/LoggerService';

export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'event';
export interface LogEvent {
  ts: number;
  level: LogLevel;
  category: string; // e.g. manager:wave
  managerId?: string;
  entityId?: string;
  message: string;
  data?: unknown;
}

export interface ManagerOptions {
  id?: string; // optional explicit id
  name: string; // human readable
  category: string; // manager:wave etc.
  logLevel?: LogLevel; // minimum level
  enabled?: boolean; // master enable/disable
  bufferSize?: number; // ring buffer size
}

/**
 * BaseManager provides unified logging + event emitter semantics for game managers.
 * Concrete managers should be wrapped instead of extending at first; wrapper will delegate.
 */
export class BaseManager {
  public readonly id: string;
  public readonly name: string;
  public readonly category: string;
  private logLevel: LogLevel;
  private enabled: boolean;
  private bufferSize: number;
  private events: Map<string, Array<Function>> = new Map();
  private logBuffer: LogEvent[] = [];
  private logger: LoggerService;

  constructor(opts: ManagerOptions) {
    this.id = opts.id || `manager:${opts.name.toLowerCase()}`;
    this.name = opts.name;
    this.category = opts.category;
    this.logLevel = opts.logLevel || 'info';
    this.enabled = opts.enabled !== undefined ? opts.enabled : true;
    this.bufferSize = opts.bufferSize || 200;
    this.logger = LoggerService.instance();
  }

  // Event API
  on(event: string, cb: Function): void {
    if (!this.events.has(event)) this.events.set(event, []);
    this.events.get(event)!.push(cb);
  }

  off(event: string, cb: Function): void {
    const arr = this.events.get(event);
    if (!arr) return;
    const idx = arr.indexOf(cb);
    if (idx >= 0) arr.splice(idx, 1);
  }

  emit(event: string, payload: any): void {
    const arr = this.events.get(event);
    if (!arr) return;
    for (const cb of arr) {
      try { cb(payload); } catch (e) { this.log('error', `Listener error for ${event}`, e); }
    }
  }

  async emitAsync(event: string, payload: any): Promise<void> {
    const arr = this.events.get(event);
    if (!arr) return;
    await Promise.all(arr.map(async cb => {
      try { await cb(payload); } catch (e) { this.log('error', `Async listener error for ${event}`, e); }
    }));
  }

  // Logging
  setLogLevel(level: LogLevel): void { this.logLevel = level; }
  getLogLevel(): LogLevel { return this.logLevel; }
  setEnabled(flag: boolean): void { this.enabled = flag; }
  isEnabled(): boolean { return this.enabled; }

  /** Determine if a given level passes current filter */
  private levelAllowed(level: LogLevel): boolean {
    const order: LogLevel[] = ['trace','debug','info','warn','error','event'];
    const currentIdx = order.indexOf(this.logLevel);
    const msgIdx = order.indexOf(level);
    if (level === 'event') return true; // always record events
    return msgIdx >= currentIdx;
  }

  log(level: LogLevel, message: string, data?: unknown, entityId?: string): void {
    if (!this.enabled) return;
    if (!this.levelAllowed(level)) return;
    const evt: LogEvent = {
      ts: Date.now(),
      level,
      category: this.category,
      managerId: this.id,
      entityId,
      message,
      data
    };
    this.logBuffer.push(evt);
    if (this.logBuffer.length > this.bufferSize) {
      this.logBuffer.splice(0, this.logBuffer.length - this.bufferSize);
    }
    this.logger.push(evt);
  }

  getLogBuffer(): LogEvent[] { return [...this.logBuffer]; }

  clearLogBuffer(): void { this.logBuffer = []; }
}
