/**
 * @fileoverview High-performance logger with multiple levels and formatting
 * @author Druta CLI Team
 */

import chalk from 'chalk';
import { performance } from 'node:perf_hooks';
import type { LoggerOptions, LogLevel } from '../types/index.js';

/**
 * Production-grade logger with performance optimization
 * Supports multiple log levels, colors, and timestamps
 */
export class Logger {
  private readonly options: Required<LoggerOptions>;
  private readonly levels: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
    silent: 4
  };

  /**
   * Initialize logger with options
   * @param options - Logger configuration options
   */
  constructor(options: Partial<LoggerOptions> = {}) {
    this.options = {
      level: 'info',
      colors: true,
      timestamps: false,
      stream: process.stdout,
      ...options
    };
  }

  /**
   * Set the current log level
   * @param level - New log level
   */
  public setLevel(level: LogLevel): void {
    (this.options as any).level = level;
  }

  /**
   * Get the current log level
   * @returns Current log level
   */
  public getLevel(): LogLevel {
    return this.options.level;
  }

  /**
   * Check if a log level should be output
   * @param level - Log level to check
   * @returns True if level should be logged
   */
  public shouldLog(level: LogLevel): boolean {
    return this.levels[level] >= this.levels[this.options.level];
  }

  /**
   * Format log message with timestamp and level
   * @param level - Log level
   * @param message - Log message
   * @returns Formatted message
   */
  private formatMessage(level: LogLevel, message: string): string {
    let formatted = '';

    // Add timestamp if enabled
    if (this.options.timestamps) {
      const timestamp = new Date().toISOString();
      formatted += chalk.gray(`[${timestamp}] `);
    }

    // Add level indicator with colors
    if (this.options.colors) {
      const levelColors = {
        debug: chalk.gray,
        info: chalk.blue,
        warn: chalk.yellow,
        error: chalk.red,
        silent: chalk.gray
      };
      formatted += levelColors[level](`[${level.toUpperCase()}] `);
    } else {
      formatted += `[${level.toUpperCase()}] `;
    }

    formatted += message;
    return formatted;
  }

  /**
   * Write message to output stream
   * @param level - Log level
   * @param args - Message arguments
   */
  private write(level: LogLevel, ...args: any[]): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const message = args.map(arg => 
      typeof arg === 'string' ? arg : JSON.stringify(arg, null, 2)
    ).join(' ');

    const formatted = this.formatMessage(level, message);
    
    // Use stderr for errors and warnings
    const stream = (level === 'error' || level === 'warn') ? process.stderr : this.options.stream;
    stream.write(formatted + '\n');
  }

  /**
   * Log debug message
   * @param args - Message arguments
   */
  public debug(...args: any[]): void {
    this.write('debug', ...args);
  }

  /**
   * Log info message
   * @param args - Message arguments
   */
  public info(...args: any[]): void {
    this.write('info', ...args);
  }

  /**
   * Log warning message
   * @param args - Message arguments
   */
  public warn(...args: any[]): void {
    this.write('warn', ...args);
  }

  /**
   * Log error message
   * @param args - Message arguments
   */
  public error(...args: any[]): void {
    this.write('error', ...args);
  }

  /**
   * Log success message (info level with green color)
   * @param args - Message arguments
   */
  public success(...args: any[]): void {
    if (!this.shouldLog('info')) {
      return;
    }

    const message = args.map(arg => 
      typeof arg === 'string' ? arg : JSON.stringify(arg, null, 2)
    ).join(' ');

    let formatted = '';
    if (this.options.timestamps) {
      const timestamp = new Date().toISOString();
      formatted += chalk.gray(`[${timestamp}] `);
    }

    if (this.options.colors) {
      formatted += chalk.green('[SUCCESS] ');
    } else {
      formatted += '[SUCCESS] ';
    }

    formatted += message;
    this.options.stream.write(formatted + '\n');
  }

  /**
   * Log performance timing
   * @param label - Performance label
   * @param startTime - Start time from performance.now()
   */
  public perf(label: string, startTime: number): void {
    if (!this.shouldLog('debug')) {
      return;
    }

    const duration = performance.now() - startTime;
    const message = `${label}: ${duration.toFixed(2)}ms`;
    
    let formatted = '';
    if (this.options.timestamps) {
      const timestamp = new Date().toISOString();
      formatted += chalk.gray(`[${timestamp}] `);
    }

    if (this.options.colors) {
      formatted += chalk.magenta('[PERF] ');
    } else {
      formatted += '[PERF] ';
    }

    formatted += message;
    this.options.stream.write(formatted + '\n');
  }

  /**
   * Create a child logger with additional context
   * @param context - Additional context for child logger
   * @returns Child logger instance
   */
  public child(context: Record<string, any>): Logger {
    const childLogger = new Logger(this.options);
    
    // Override write method to include context
    const originalWrite = childLogger.write.bind(childLogger);
    (childLogger as any).write = (level: LogLevel, ...args: any[]) => {
      const contextStr = Object.entries(context)
        .map(([key, value]) => `${key}=${value}`)
        .join(' ');
      originalWrite(level, `[${contextStr}]`, ...args);
    };

    return childLogger;
  }

  /**
   * Create a spinner-like progress indicator
   * @param message - Progress message
   * @returns Progress controller
   */
  public progress(message: string): ProgressController {
    return new ProgressController(this, message);
  }
}

/**
 * Progress controller for long-running operations
 */
class ProgressController {
  private readonly logger: Logger;
  private readonly message: string;
  private readonly startTime: number;
  private interval?: NodeJS.Timeout | undefined;
  private frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  private frameIndex = 0;

  constructor(logger: Logger, message: string) {
    this.logger = logger;
    this.message = message;
    this.startTime = performance.now();
  }

  /**
   * Start the progress indicator
   */
  public start(): void {
    if (this.logger.shouldLog('info')) {
      this.interval = setInterval(() => {
        const frame = this.frames[this.frameIndex];
        this.frameIndex = (this.frameIndex + 1) % this.frames.length;
        process.stdout.write(`\r${chalk.cyan(frame)} ${this.message}`);
      }, 80);
    }
  }

  /**
   * Stop the progress indicator with success
   * @param finalMessage - Final success message
   */
  public succeed(finalMessage?: string): void {
    this.stop();
    const duration = performance.now() - this.startTime;
    const message = finalMessage || this.message;
    this.logger.success(`${message} (${duration.toFixed(2)}ms)`);
  }

  /**
   * Stop the progress indicator with failure
   * @param finalMessage - Final error message
   */
  public fail(finalMessage?: string): void {
    this.stop();
    const message = finalMessage || this.message;
    this.logger.error(`${message} failed`);
  }

  /**
   * Stop the progress indicator
   */
  public stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = undefined;
      if (this.logger.shouldLog('info')) {
        process.stdout.write('\r\x1b[K'); // Clear line
      }
    }
  }
}
