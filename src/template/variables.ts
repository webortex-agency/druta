/**
 * Variable Substitution Engine with Type-Safe Injection
 * Supports environment-aware configuration merging and secret management
 * @author Druta CLI Team
 */

// import { readFile, writeFile } from 'node:fs/promises'; // Unused imports
// import { join, resolve } from 'node:path'; // Unused imports
// import { existsSync } from 'node:fs'; // Unused import
import { performance } from 'node:perf_hooks';
import { createHash } from 'node:crypto';
// import { randomBytes, createCipheriv, createDecipheriv } from 'node:crypto'; // Commented out - crypto methods are placeholders
import Ajv from 'ajv';
import type { Logger } from '../core/logger.js';
import type { TemplateVariableSchema } from './registry.js';

/**
 * Variable context for template processing
 */
export interface VariableContext {
  /** Environment variables */
  env: Record<string, string>;
  /** User-provided variables */
  user: Record<string, any>;
  /** System variables */
  system: Record<string, any>;
  /** Computed variables */
  computed: Record<string, any>;
  /** Secret variables (encrypted) */
  secrets: Record<string, string>;
}

/**
 * Variable transformation function
 */
export type VariableTransformer = (value: any, context: VariableContext) => any;

/**
 * Variable validation result
 */
export interface VariableValidationResult {
  /** Validation status */
  valid: boolean;
  /** Validation errors */
  errors: VariableValidationError[];
  /** Sanitized variables */
  sanitized: Record<string, any>;
}

/**
 * Variable validation error
 */
export interface VariableValidationError {
  /** Variable name */
  variable: string;
  /** Error message */
  message: string;
  /** Error code */
  code: string;
  /** Expected type/format */
  expected?: string;
  /** Actual value */
  actual?: any;
}

/**
 * Variable configuration
 */
export interface VariableConfig {
  /** Environment-specific configurations */
  environments: Record<string, Record<string, any>>;
  /** Default variable values */
  defaults: Record<string, any>;
  /** Variable transformations */
  transformers: Record<string, VariableTransformer>;
  /** Secret encryption key */
  encryptionKey?: string;
  /** Variable validation schemas */
  schemas: Record<string, TemplateVariableSchema>;
  /** Enable variable caching */
  enableCaching: boolean;
  /** Cache TTL in milliseconds */
  cacheTtl: number;
}

/**
 * Variable resolution options
 */
export interface VariableResolutionOptions {
  /** Target environment */
  environment?: string;
  /** Include system variables */
  includeSystem?: boolean;
  /** Include environment variables */
  includeEnv?: boolean;
  /** Variable overrides */
  overrides?: Record<string, any>;
  /** Skip validation */
  skipValidation?: boolean;
  /** Enable variable interpolation */
  enableInterpolation?: boolean;
}

/**
 * Variable cache entry
 */
interface VariableCacheEntry {
  context: VariableContext;
  cachedAt: number;
  ttl: number;
  hash: string;
}

/**
 * High-performance variable substitution engine
 * Optimized for type-safe injection and environment management
 */
export class VariableSubstitutionEngine {
  private readonly config: VariableConfig;
  private readonly logger: Logger;
  private readonly ajv: Ajv;
  private readonly cache = new Map<string, VariableCacheEntry>();
  // Encryption key for secrets (placeholder for future implementation)
  // private readonly encryptionKey: string;

  /**
   * Initialize variable substitution engine
   */
  constructor(config: VariableConfig, logger: Logger) {
    this.config = config;
    this.logger = logger;
    this.ajv = new Ajv({ allErrors: true, coerceTypes: true });
    // this.encryptionKey = config.encryptionKey || this.generateEncryptionKey();

    // Compile validation schemas
    for (const [name, schema] of Object.entries(config.schemas)) {
      this.ajv.addSchema(this.convertToJsonSchema(schema), name);
    }

    this.logger.debug('Variable substitution engine initialized', {
      environments: Object.keys(config.environments).length,
      defaults: Object.keys(config.defaults).length,
      transformers: Object.keys(config.transformers).length,
      schemas: Object.keys(config.schemas).length
    });
  }

  /**
   * Resolve variables with environment-aware configuration merging
   */
  async resolveVariables(
    userVariables: Record<string, any> = {},
    options: VariableResolutionOptions = {}
  ): Promise<VariableContext> {
    const startTime = performance.now();
    const cacheKey = this.generateCacheKey(userVariables, options);

    try {
      // Check cache first
      if (this.config.enableCaching) {
        const cached = this.getCachedContext(cacheKey);
        if (cached) {
          this.logger.debug('Variable context cache hit', { cacheKey });
          return cached.context;
        }
      }

      // Build variable context
      const context: VariableContext = {
        env: {},
        user: {},
        system: {},
        computed: {},
        secrets: {}
      };

      // Load environment variables
      if (options.includeEnv !== false) {
        context.env = this.loadEnvironmentVariables();
      }

      // Load system variables
      if (options.includeSystem !== false) {
        context.system = await this.loadSystemVariables();
      }

      // Merge environment-specific configuration
      if (options.environment) {
        const envConfig = this.config.environments[options.environment] || {};
        Object.assign(context.user, envConfig);
      }

      // Merge default values
      Object.assign(context.user, this.config.defaults);

      // Merge user variables
      Object.assign(context.user, userVariables);

      // Apply overrides
      if (options.overrides) {
        Object.assign(context.user, options.overrides);
      }

      // Validate variables
      if (!options.skipValidation) {
        const validation = await this.validateVariables(context.user);
        if (!validation.valid) {
          throw new Error(`Variable validation failed: ${validation.errors.map(e => e.message).join(', ')}`);
        }
        context.user = validation.sanitized;
      }

      // Apply transformations
      context.user = await this.applyTransformations(context.user, context);

      // Compute derived variables
      context.computed = await this.computeVariables(context);

      // Handle variable interpolation
      if (options.enableInterpolation !== false) {
        context.user = this.interpolateVariables(context.user, context);
        context.computed = this.interpolateVariables(context.computed, context);
      }

      // Load and decrypt secrets
      context.secrets = await this.loadSecrets(context);

      // Cache the result
      if (this.config.enableCaching) {
        this.cacheContext(cacheKey, context);
      }

      const resolutionTime = performance.now() - startTime;
      this.logger.debug('Variables resolved', {
        environment: options.environment,
        userVariables: Object.keys(userVariables).length,
        totalVariables: Object.keys(context.user).length + Object.keys(context.computed).length,
        resolutionTime: `${resolutionTime.toFixed(2)}ms`
      });

      return context;

    } catch (error: any) {
      const resolutionTime = performance.now() - startTime;
      this.logger.error('Variable resolution failed', {
        error: error.message,
        resolutionTime: `${resolutionTime.toFixed(2)}ms`,
        options
      });
      throw error;
    }
  }

  /**
   * Validate variables against schemas
   */
  async validateVariables(variables: Record<string, any>): Promise<VariableValidationResult> {
    const errors: VariableValidationError[] = [];
    const sanitized: Record<string, any> = {};

    for (const [name, value] of Object.entries(variables)) {
      const schema = this.config.schemas[name];
      
      if (!schema) {
        // No schema defined, pass through
        sanitized[name] = value;
        continue;
      }

      try {
        // Type coercion and validation
        const coercedValue = this.coerceValue(value, schema);
        const isValid = this.ajv.validate(name, coercedValue);

        if (isValid) {
          sanitized[name] = coercedValue;
        } else {
          const ajvErrors = this.ajv.errors || [];
          for (const ajvError of ajvErrors) {
            errors.push({
              variable: name,
              message: `${ajvError.instancePath} ${ajvError.message}`,
              code: ajvError.keyword || 'validation_error',
              expected: schema.type,
              actual: value
            });
          }
        }
      } catch (error: any) {
        errors.push({
          variable: name,
          message: error.message,
          code: 'coercion_error',
          expected: schema.type,
          actual: value
        });
      }
    }

    // Check for required variables
    for (const [name, schema] of Object.entries(this.config.schemas)) {
      if (schema.required && !(name in variables)) {
        if (schema.default !== undefined) {
          sanitized[name] = schema.default;
        } else {
          errors.push({
            variable: name,
            message: `Required variable '${name}' is missing`,
            code: 'required_missing'
          });
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      sanitized
    };
  }

  /**
   * Apply variable transformations
   */
  private async applyTransformations(
    variables: Record<string, any>,
    context: VariableContext
  ): Promise<Record<string, any>> {
    const transformed: Record<string, any> = { ...variables };

    for (const [name, transformer] of Object.entries(this.config.transformers)) {
      if (name in transformed) {
        try {
          transformed[name] = await transformer(transformed[name], context);
        } catch (error: any) {
          this.logger.warn(`Variable transformation failed: ${name}`, {
            error: error.message
          });
        }
      }
    }

    return transformed;
  }

  /**
   * Compute derived variables
   */
  private async computeVariables(context: VariableContext): Promise<Record<string, any>> {
    const computed: Record<string, any> = {};

    // Add common computed variables
    computed['timestamp'] = new Date().toISOString();
    computed['date'] = new Date().toISOString().split('T')[0];
    computed['time'] = new Date().toTimeString().split(' ')[0];
    computed['year'] = new Date().getFullYear();
    computed['month'] = new Date().getMonth() + 1;
    computed['day'] = new Date().getDate();

    // Add system information
    computed['platform'] = process.platform;
    computed['arch'] = process.arch;
    computed['nodeVersion'] = process.version;
    computed['cwd'] = process.cwd();

    // Add user-specific computed variables
    if (context.user['projectName']) {
      computed['projectNameKebab'] = this.toKebabCase(context.user['projectName']);
      computed['projectNameCamel'] = this.toCamelCase(context.user['projectName']);
      computed['projectNamePascal'] = this.toPascalCase(context.user['projectName']);
      computed['projectNameSnake'] = this.toSnakeCase(context.user['projectName']);
    }

    return computed;
  }

  /**
   * Interpolate variables within strings
   */
  private interpolateVariables(
    variables: Record<string, any>,
    context: VariableContext
  ): Record<string, any> {
    const interpolated: Record<string, any> = {};
    const allVariables = {
      ...context.env,
      ...context.system,
      ...context.user,
      ...context.computed
    };

    for (const [key, value] of Object.entries(variables)) {
      if (typeof value === 'string') {
        interpolated[key] = this.interpolateString(value, allVariables);
      } else if (Array.isArray(value)) {
        interpolated[key] = value.map(item =>
          typeof item === 'string' ? this.interpolateString(item, allVariables) : item
        );
      } else if (typeof value === 'object' && value !== null) {
        interpolated[key] = this.interpolateObject(value, allVariables);
      } else {
        interpolated[key] = value;
      }
    }

    return interpolated;
  }

  /**
   * Interpolate string with variable substitution
   */
  private interpolateString(str: string, variables: Record<string, any>): string {
    return str.replace(/\$\{([^}]+)\}/g, (match, varName) => {
      const value = this.getNestedValue(variables, varName.trim());
      return value !== undefined ? String(value) : match;
    });
  }

  /**
   * Interpolate object recursively
   */
  private interpolateObject(obj: any, variables: Record<string, any>): any {
    if (Array.isArray(obj)) {
      return obj.map(item => this.interpolateObject(item, variables));
    }

    if (typeof obj === 'object' && obj !== null) {
      const result: any = {};
      for (const [key, value] of Object.entries(obj)) {
        result[key] = this.interpolateObject(value, variables);
      }
      return result;
    }

    if (typeof obj === 'string') {
      return this.interpolateString(obj, variables);
    }

    return obj;
  }

  /**
   * Get nested value from object using dot notation
   */
  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  /**
   * Load environment variables
   */
  private loadEnvironmentVariables(): Record<string, string> {
    const env: Record<string, string> = {};
    
    // Filter and include relevant environment variables
    for (const [key, value] of Object.entries(process.env)) {
      if (value !== undefined) {
        env[key] = value;
      }
    }

    return env;
  }

  /**
   * Load system variables
   */
  private async loadSystemVariables(): Promise<Record<string, any>> {
    const system: Record<string, any> = {};

    // Add system information
    system['hostname'] = require('node:os').hostname();
    system['username'] = require('node:os').userInfo().username;
    system['homedir'] = require('node:os').homedir();
    system['tmpdir'] = require('node:os').tmpdir();
    system['platform'] = process.platform;
    system['arch'] = process.arch;
    system['nodeVersion'] = process.version;
    system['pid'] = process.pid;

    return system;
  }

  /**
   * Load and decrypt secrets
   */
  private async loadSecrets(_context: VariableContext): Promise<Record<string, string>> {
    const secrets: Record<string, string> = {};

    // Implementation would load encrypted secrets from secure storage
    // For now, return empty object
    return secrets;
  }

  // Crypto methods commented out - placeholders for future implementation
  // /**
  //  * Encrypt secret value
  //  */
  // private encryptSecret(value: string, key: string): string {
  //   const iv = randomBytes(16);
  //   const cipher = createCipheriv('aes-256-cbc', Buffer.from(key.padEnd(32, '0').slice(0, 32)), iv);
  //   let encrypted = cipher.update(value, 'utf8', 'hex');
  //   encrypted += cipher.final('hex');
  //   return iv.toString('hex') + ':' + encrypted;
  // }

  // /**
  //  * Decrypt secret value
  //  */
  // private decryptSecret(encryptedValue: string, key: string): string {
  //   const parts = encryptedValue.split(':');
  //   if (parts.length !== 2) {
  //     throw new Error('Invalid encrypted value format');
  //   }
  //   const [ivHex, encrypted] = parts;
  //   const iv = Buffer.from(ivHex, 'hex');
  //   const decipher = createDecipheriv('aes-256-cbc', Buffer.from(key.padEnd(32, '0').slice(0, 32)), iv);
  //   let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  //   decrypted += decipher.final('utf8');
  //   return decrypted;
  // }

  // Crypto methods commented out - placeholders for future implementation
  // /**
  //  * Generate encryption key
  //  */
  // private generateEncryptionKey(): string {
  //   return randomBytes(32).toString('hex');
  // }

  /**
   * Coerce value to expected type
   */
  private coerceValue(value: any, schema: TemplateVariableSchema): any {
    switch (schema.type) {
      case 'string':
        return String(value);
      case 'number':
        const num = Number(value);
        if (isNaN(num)) {
          throw new Error(`Cannot convert '${value}' to number`);
        }
        return num;
      case 'boolean':
        if (typeof value === 'boolean') return value;
        if (typeof value === 'string') {
          const lower = value.toLowerCase();
          if (lower === 'true' || lower === '1' || lower === 'yes') return true;
          if (lower === 'false' || lower === '0' || lower === 'no') return false;
        }
        return Boolean(value);
      case 'array':
        return Array.isArray(value) ? value : [value];
      case 'object':
        return typeof value === 'object' ? value : {};
      default:
        return value;
    }
  }

  /**
   * Convert template variable schema to JSON schema
   */
  private convertToJsonSchema(schema: TemplateVariableSchema): object {
    const jsonSchema: any = {
      type: schema.type
    };

    if (schema.pattern) jsonSchema.pattern = schema.pattern;
    if (schema.enum) jsonSchema.enum = schema.enum;
    if (schema.minimum !== undefined) jsonSchema.minimum = schema.minimum;
    if (schema.maximum !== undefined) jsonSchema.maximum = schema.maximum;
    if (schema.default !== undefined) jsonSchema.default = schema.default;

    return jsonSchema;
  }

  /**
   * Generate cache key for variable context
   */
  private generateCacheKey(
    userVariables: Record<string, any>,
    options: VariableResolutionOptions
  ): string {
    const data = JSON.stringify({ userVariables, options }, Object.keys({ ...userVariables, ...options }).sort());
    return createHash('sha256').update(data).digest('hex');
  }

  /**
   * Get cached variable context
   */
  private getCachedContext(cacheKey: string): VariableCacheEntry | null {
    const entry = this.cache.get(cacheKey);
    if (!entry) return null;

    const now = Date.now();
    if (now > entry.ttl) {
      this.cache.delete(cacheKey);
      return null;
    }

    return entry;
  }

  /**
   * Cache variable context
   */
  private cacheContext(cacheKey: string, context: VariableContext): void {
    const now = Date.now();
    const entry: VariableCacheEntry = {
      context,
      cachedAt: now,
      ttl: now + this.config.cacheTtl,
      hash: cacheKey
    };

    this.cache.set(cacheKey, entry);
  }

  // /**
  //  * Generate encryption key
  //  */
  // private generateEncryptionKey(): string {
  //   return randomBytes(32).toString('hex');
  // }

  // String transformation utilities
  private toKebabCase(str: string): string {
    return str.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
  }

  private toCamelCase(str: string): string {
    return str.replace(/[-_\s]+(.)?/g, (_, char) => char ? char.toUpperCase() : '');
  }

  private toPascalCase(str: string): string {
    const camel = this.toCamelCase(str);
    return camel.charAt(0).toUpperCase() + camel.slice(1);
  }

  private toSnakeCase(str: string): string {
    return str.replace(/([a-z])([A-Z])/g, '$1_$2').toLowerCase();
  }

  /**
   * Clear variable cache
   */
  clearCache(): void {
    this.cache.clear();
    this.logger.info('Variable substitution cache cleared');
  }

  /**
   * Get engine statistics
   */
  getStatistics() {
    return {
      cacheSize: this.cache.size,
      environments: Object.keys(this.config.environments).length,
      transformers: Object.keys(this.config.transformers).length,
      schemas: Object.keys(this.config.schemas).length
    };
  }
}

/**
 * Default variable configuration
 */
export const defaultVariableConfig: Partial<VariableConfig> = {
  environments: {
    development: {
      debug: true,
      logLevel: 'debug'
    },
    production: {
      debug: false,
      logLevel: 'info'
    }
  },
  defaults: {
    author: 'Anonymous',
    license: 'MIT',
    version: '1.0.0'
  },
  transformers: {},
  schemas: {},
  enableCaching: true,
  cacheTtl: 5 * 60 * 1000 // 5 minutes
};
