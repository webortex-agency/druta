/**
 * @fileoverview Tests for Logger class
 * @author Druta CLI Team
 */

import { Logger } from '../core/logger.js';
import { Writable } from 'node:stream';

describe('Logger', () => {
  let mockStream: Writable;
  let output: string[];

  beforeEach(() => {
    output = [];
    mockStream = new Writable({
      write(chunk: any, encoding: any, callback: any) {
        output.push(chunk.toString());
        callback();
      }
    });
  });

  describe('constructor', () => {
    it('should create logger with default options', () => {
      const logger = new Logger();
      expect(logger.getLevel()).toBe('info');
    });

    it('should create logger with custom options', () => {
      const logger = new Logger({
        level: 'debug',
        colors: false,
        timestamps: true,
        stream: mockStream
      });
      expect(logger.getLevel()).toBe('debug');
    });
  });

  describe('log levels', () => {
    it('should respect log level hierarchy', () => {
      const logger = new Logger({ level: 'warn', stream: mockStream });
      
      logger.debug('debug message');
      logger.info('info message');
      logger.warn('warn message');
      logger.error('error message');
      
      expect(output).toHaveLength(2);
      expect(output[0]).toContain('warn message');
      expect(output[1]).toContain('error message');
    });

    it('should allow changing log level', () => {
      const logger = new Logger({ level: 'error', stream: mockStream });
      
      logger.info('should not appear');
      expect(output).toHaveLength(0);
      
      logger.setLevel('info');
      logger.info('should appear');
      expect(output).toHaveLength(1);
    });
  });

  describe('formatting', () => {
    it('should format messages with level indicators', () => {
      const logger = new Logger({ level: 'debug', stream: mockStream, colors: false });
      
      logger.info('test message');
      expect(output[0]).toContain('[INFO]');
      expect(output[0]).toContain('test message');
    });

    it('should include timestamps when enabled', () => {
      const logger = new Logger({ 
        level: 'debug', 
        stream: mockStream, 
        timestamps: true,
        colors: false 
      });
      
      logger.info('test message');
      expect(output[0]).toMatch(/\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\]/);
    });
  });

  describe('success logging', () => {
    it('should log success messages', () => {
      const logger = new Logger({ level: 'info', stream: mockStream, colors: false });
      
      logger.success('operation completed');
      expect(output[0]).toContain('[SUCCESS]');
      expect(output[0]).toContain('operation completed');
    });
  });

  describe('performance logging', () => {
    it('should log performance metrics', () => {
      const logger = new Logger({ level: 'debug', stream: mockStream, colors: false });
      const startTime = performance.now();
      
      // Simulate some work
      const endTime = startTime + 100;
      jest.spyOn(performance, 'now').mockReturnValue(endTime);
      
      logger.perf('test operation', startTime);
      expect(output[0]).toContain('[PERF]');
      expect(output[0]).toContain('test operation: 100.00ms');
    });
  });

  describe('child logger', () => {
    it('should create child logger with context', () => {
      const logger = new Logger({ level: 'info', stream: mockStream, colors: false });
      const child = logger.child({ module: 'test', id: 123 });
      
      child.info('child message');
      expect(output[0]).toContain('[module=test id=123]');
      expect(output[0]).toContain('child message');
    });
  });

  describe('progress controller', () => {
    it('should create progress controller', () => {
      const logger = new Logger({ level: 'info', stream: mockStream });
      const progress = logger.progress('loading...');
      
      expect(progress).toBeDefined();
      expect(typeof progress.start).toBe('function');
      expect(typeof progress.succeed).toBe('function');
      expect(typeof progress.fail).toBe('function');
      expect(typeof progress.stop).toBe('function');
    });
  });

  describe('silent mode', () => {
    it('should not output anything in silent mode', () => {
      const logger = new Logger({ level: 'silent', stream: mockStream });
      
      logger.debug('debug');
      logger.info('info');
      logger.warn('warn');
      logger.error('error');
      logger.success('success');
      
      expect(output).toHaveLength(0);
    });
  });
});
