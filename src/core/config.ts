/**
 * @fileoverview Configuration management with JSON/YAML support and file watching
 * @author Druta CLI Team
 */

import { readFile, writeFile, access, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import type { ConfigOptions } from '../types/index.js';
import type { Logger } from './logger.js';

/**
 * Configuration manager with support for JSON/YAML formats
 * Provides file watching and validation capabilities
 */
export class ConfigManager {
  private config: Record<string, any> = {};
  private readonly logger: Logger;
  private readonly options: Required<ConfigOptions>;
  private configPath: string;

  /**
   * Initialize configuration manager
   * @param logger - Logger instance
   * @param options - Configuration options
   */
  constructor(logger: Logger, options: Partial<ConfigOptions> = {}) {
    this.logger = logger;
    this.options = {
      configPath: join(homedir(), '.druta', 'config.json'),
      defaults: {
        templates: {
          directory: join(homedir(), '.druta', 'templates'),
          remote: {
            registry: 'https://registry.druta.dev',
            timeout: 30000
          }
        },
        plugins: {
          directory: join(homedir(), '.druta', 'plugins'),
          autoUpdate: false
        },
        logging: {
          level: 'info',
          colors: true,
          timestamps: false
        },
        performance: {
          maxStartupTime: 200,
          maxMemoryUsage: 50 * 1024 * 1024 // 50MB
        }
      },
      watch: false,
      ...options
    };

    this.configPath = this.options.configPath;
  }

  /**
   * Load configuration from file
   * @param filePath - Optional custom file path
   */
  public async loadFromFile(filePath?: string): Promise<void> {
    const targetPath = filePath || this.configPath;
    
    try {
      await access(targetPath);
      const content = await readFile(targetPath, 'utf8');
      
      // Determine file format by extension
      const isYaml = targetPath.endsWith('.yaml') || targetPath.endsWith('.yml');
      
      if (isYaml) {
        this.config = parseYaml(content) || {};
      } else {
        this.config = JSON.parse(content);
      }
      
      this.logger.debug(`Configuration loaded from ${targetPath}`);
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        this.logger.debug(`Configuration file not found: ${targetPath}`);
        await this.loadDefaults();
      } else {
        this.logger.error(`Failed to load configuration from ${targetPath}:`, error.message);
        throw error;
      }
    }
  }

  /**
   * Load default configuration
   */
  public async loadDefaults(): Promise<void> {
    this.config = { ...this.options.defaults };
    this.logger.debug('Default configuration loaded');
  }

  /**
   * Save configuration to file
   * @param filePath - Optional custom file path
   */
  public async save(filePath?: string): Promise<void> {
    const targetPath = filePath || this.configPath;
    
    try {
      // Ensure directory exists
      await mkdir(dirname(targetPath), { recursive: true });
      
      // Determine file format by extension
      const isYaml = targetPath.endsWith('.yaml') || targetPath.endsWith('.yml');
      
      let content: string;
      if (isYaml) {
        content = stringifyYaml(this.config, { indent: 2 });
      } else {
        content = JSON.stringify(this.config, null, 2);
      }
      
      await writeFile(targetPath, content, 'utf8');
      this.logger.debug(`Configuration saved to ${targetPath}`);
    } catch (error: any) {
      this.logger.error(`Failed to save configuration to ${targetPath}:`, error.message);
      throw error;
    }
  }

  /**
   * Get configuration value by key path
   * @param keyPath - Dot-separated key path (e.g., 'templates.directory')
   * @param defaultValue - Default value if key not found
   * @returns Configuration value
   */
  public get<T = any>(keyPath: string, defaultValue?: T): T {
    const keys = keyPath.split('.');
    let current: any = this.config;
    
    for (const key of keys) {
      if (current && typeof current === 'object' && key in current) {
        current = current[key];
      } else {
        return defaultValue as T;
      }
    }
    
    return current as T;
  }

  /**
   * Set configuration value by key path
   * @param keyPath - Dot-separated key path
   * @param value - Value to set
   */
  public set(keyPath: string, value: any): void {
    const keys = keyPath.split('.');
    const lastKey = keys.pop()!;
    let current = this.config;
    
    // Navigate to parent object
    for (const key of keys) {
      if (!(key in current) || typeof current[key] !== 'object') {
        current[key] = {};
      }
      current = current[key];
    }
    
    current[lastKey] = value;
    this.logger.debug(`Configuration updated: ${keyPath} = ${JSON.stringify(value)}`);
  }

  /**
   * Check if configuration key exists
   * @param keyPath - Dot-separated key path
   * @returns True if key exists
   */
  public has(keyPath: string): boolean {
    const keys = keyPath.split('.');
    let current: any = this.config;
    
    for (const key of keys) {
      if (current && typeof current === 'object' && key in current) {
        current = current[key];
      } else {
        return false;
      }
    }
    
    return true;
  }

  /**
   * Delete configuration key
   * @param keyPath - Dot-separated key path
   * @returns True if key was deleted
   */
  public delete(keyPath: string): boolean {
    const keys = keyPath.split('.');
    const lastKey = keys.pop()!;
    let current = this.config;
    
    // Navigate to parent object
    for (const key of keys) {
      if (current && typeof current === 'object' && key in current) {
        current = current[key];
      } else {
        return false;
      }
    }
    
    if (current && typeof current === 'object' && lastKey in current) {
      delete current[lastKey];
      this.logger.debug(`Configuration key deleted: ${keyPath}`);
      return true;
    }
    
    return false;
  }

  /**
   * Get all configuration as object
   * @returns Complete configuration object
   */
  public getAll(): Record<string, any> {
    return { ...this.config };
  }

  /**
   * Merge configuration with provided object
   * @param config - Configuration object to merge
   */
  public merge(config: Record<string, any>): void {
    this.config = this.deepMerge(this.config, config);
    this.logger.debug('Configuration merged');
  }

  /**
   * Reset configuration to defaults
   */
  public reset(): void {
    this.config = { ...this.options.defaults };
    this.logger.debug('Configuration reset to defaults');
  }

  /**
   * Validate configuration against schema
   * @param schema - JSON schema object
   * @returns Validation result
   */
  public validate(schema: any): { valid: boolean; errors: string[] } {
    // Basic validation implementation
    // In production, you might want to use a library like Ajv
    const errors: string[] = [];
    
    try {
      this.validateObject(this.config, schema, '', errors);
    } catch (error: any) {
      errors.push(error.message);
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Get configuration file path
   * @returns Current configuration file path
   */
  public getConfigPath(): string {
    return this.configPath;
  }

  /**
   * Set configuration file path
   * @param path - New configuration file path
   */
  public setConfigPath(path: string): void {
    this.configPath = path;
  }

  /**
   * Deep merge two objects
   * @param target - Target object
   * @param source - Source object
   * @returns Merged object
   */
  private deepMerge(target: any, source: any): any {
    const result = { ...target };
    
    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = this.deepMerge(result[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }
    
    return result;
  }

  /**
   * Validate object against schema (basic implementation)
   * @param obj - Object to validate
   * @param schema - Schema to validate against
   * @param path - Current path for error reporting
   * @param errors - Array to collect errors
   */
  private validateObject(obj: any, schema: any, path: string, errors: string[]): void {
    if (schema.type === 'object' && schema.properties) {
      for (const [key, propSchema] of Object.entries(schema.properties)) {
        const currentPath = path ? `${path}.${key}` : key;
        
        if (schema.required && schema.required.includes(key) && !(key in obj)) {
          errors.push(`Missing required property: ${currentPath}`);
          continue;
        }
        
        if (key in obj) {
          this.validateObject(obj[key], propSchema, currentPath, errors);
        }
      }
    } else if (schema.type && typeof obj !== schema.type) {
      errors.push(`Invalid type at ${path}: expected ${schema.type}, got ${typeof obj}`);
    }
  }
}
