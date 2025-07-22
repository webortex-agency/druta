#!/usr/bin/env node

/**
 * Druta CLI - Production-grade SaaS generator CLI framework
 * Entry point with global error handling and performance optimization
 */

import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';

// Performance tracking
const startTime = performance.now();

// Global error handlers
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error.message);
  if (process.env.NODE_ENV === 'development') {
    console.error(error.stack);
  }
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  if (process.env.NODE_ENV === 'development') {
    console.error(reason);
  }
  process.exit(1);
});

// Get package info for version
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packagePath = join(__dirname, '..', 'package.json');
const packageInfo = JSON.parse(readFileSync(packagePath, 'utf8'));

// Dynamic import to avoid startup penalty
async function main() {
  try {
    const { DrutaCLI } = await import('../dist/index.js');
    const cli = new DrutaCLI({
      version: packageInfo.version,
      name: packageInfo.name,
      startTime
    });
    
    await cli.run(process.argv);
  } catch (error) {
    console.error('Failed to start Druta CLI:', error.message);
    if (process.env.NODE_ENV === 'development') {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

main();
