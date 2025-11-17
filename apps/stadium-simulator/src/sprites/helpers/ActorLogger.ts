import { LoggerService } from '@/services/LoggerService';
import type { LogLevel } from '@/managers/helpers/BaseManager';

/**
 * ActorLogger provides lightweight logging for Phaser sprite instances.
 * Unlike managers, actors don't extend BaseManager. This utility allows
 * optional per-instance logging with category `actor:*`.
 */
export class ActorLogger {
  private category: string;
  private instanceId: string;
  private enabled: boolean;

  constructor(actorType: string, instanceId: string | number, enabledByDefault = false) {
    this.category = `actor:${actorType}`;
    this.instanceId = String(instanceId);
    this.enabled = enabledByDefault;
  }

  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  public log(level: LogLevel, message: string): void {
    if (!this.enabled) return;
    const logger = LoggerService.instance();
    logger.push({
      level,
      category: this.category,
      message: `[${this.instanceId}] ${message}`,
      ts: Date.now()
    });
  }

  public trace(message: string): void { this.log('trace', message); }
  public debug(message: string): void { this.log('debug', message); }
  public info(message: string): void { this.log('info', message); }
  public warn(message: string): void { this.log('warn', message); }
  public error(message: string): void { this.log('error', message); }
  public event(message: string): void { this.log('event', message); }
}
