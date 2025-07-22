/**
 * @fileoverview Test setup and utilities for Druta CLI framework
 * @author Druta CLI Team
 */

import { jest, beforeEach, afterEach, expect } from '@jest/globals';

// Global test timeout
jest.setTimeout(30000);

// Mock console methods to avoid noise in tests
const originalConsole = { ...console };

beforeEach(() => {
  // Reset console mocks
  console.log = jest.fn();
  console.info = jest.fn();
  console.warn = jest.fn();
  console.error = jest.fn();
});

afterEach(() => {
  // Restore console
  Object.assign(console, originalConsole);
  
  // Clear all mocks
  jest.clearAllMocks();
});

// Global test utilities
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeWithinRange(floor: number, ceiling: number): R;
    }
  }
}

// Custom matchers
expect.extend({
  toBeWithinRange(received: number, floor: number, ceiling: number) {
    const pass = received >= floor && received <= ceiling;
    if (pass) {
      return {
        message: () => `expected ${received} not to be within range ${floor} - ${ceiling}`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be within range ${floor} - ${ceiling}`,
        pass: false,
      };
    }
  },
});

// Test helpers
export const createMockLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  success: jest.fn(),
  perf: jest.fn(),
  setLevel: jest.fn(),
  getLevel: jest.fn(() => 'info'),
  child: jest.fn(() => createMockLogger()),
  progress: jest.fn(() => ({
    start: jest.fn(),
    succeed: jest.fn(),
    fail: jest.fn(),
    stop: jest.fn()
  }))
});

export const createMockConfig = () => ({
  get: jest.fn(),
  set: jest.fn(),
  has: jest.fn(),
  delete: jest.fn(),
  getAll: jest.fn(() => ({})),
  merge: jest.fn(),
  reset: jest.fn(),
  save: jest.fn(),
  loadFromFile: jest.fn(),
  loadDefaults: jest.fn(),
  validate: jest.fn(() => ({ valid: true, errors: [] })),
  getConfigPath: jest.fn(),
  setConfigPath: jest.fn()
});

export const createMockEvents = () => ({
  on: jest.fn(),
  once: jest.fn(),
  off: jest.fn(),
  emit: jest.fn(),
  emitSync: jest.fn(),
  removeAllListeners: jest.fn(),
  listenerCount: jest.fn(() => 0),
  eventNames: jest.fn(() => []),
  namespace: jest.fn(() => createMockEvents())
});

export const sleep = (ms: number): Promise<void> => 
  new Promise(resolve => setTimeout(resolve, ms));
