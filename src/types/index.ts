/**
 * @fileoverview Type definitions for Druta CLI framework
 * @author Druta CLI Team
 */

/**
 * CLI initialization options
 */
export interface CLIOptions {
  /** CLI version */
  version: string;
  /** CLI name */
  name: string;
  /** Performance start time */
  startTime: number;
}

/**
 * CLI execution context
 */
export interface CLIContext {
  /** CLI version */
  version: string;
  /** CLI name */
  name: string;
  /** Performance start time */
  startTime: number;
  /** Current working directory */
  cwd: string;
  /** Environment mode */
  env: string;
}

/**
 * Logger configuration options
 */
export interface LoggerOptions {
  /** Log level */
  level: LogLevel;
  /** Enable colors */
  colors?: boolean;
  /** Enable timestamps */
  timestamps?: boolean;
  /** Output stream */
  stream?: NodeJS.WritableStream;
}

/**
 * Log levels in order of severity
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';

/**
 * Configuration manager options
 */
export interface ConfigOptions {
  /** Configuration file path */
  configPath?: string;
  /** Default configuration values */
  defaults?: Record<string, any>;
  /** Enable file watching */
  watch?: boolean;
}

/**
 * Plugin metadata
 */
export interface PluginMetadata {
  /** Plugin name */
  name: string;
  /** Plugin version */
  version: string;
  /** Plugin description */
  description?: string;
  /** Plugin author */
  author?: string;
  /** Plugin homepage */
  homepage?: string;
  /** Plugin keywords */
  keywords?: string[];
  /** Plugin dependencies */
  dependencies?: Record<string, string>;
}

/**
 * Plugin interface that all plugins must implement
 */
export interface Plugin {
  /** Plugin metadata */
  metadata: PluginMetadata;
  /** Initialize the plugin */
  initialize(context: PluginContext): Promise<void>;
  /** Cleanup plugin resources */
  cleanup?(): Promise<void>;
}

/**
 * Plugin execution context
 */
export interface PluginContext {
  /** CLI context */
  cli: CLIContext;
  /** Logger instance */
  logger: any;
  /** Configuration manager */
  config: any;
  /** Event emitter */
  events: any;
}

/**
 * Event listener function
 */
export type EventListener<T = any> = (data: T) => Promise<void> | void;

/**
 * Template engine interface
 */
export interface TemplateEngine {
  /** Engine name */
  name: string;
  /** Supported file extensions */
  extensions: string[];
  /** Process template with variables */
  process(template: string, variables: Record<string, any>): Promise<string>;
  /** Process template file */
  processFile(filePath: string, variables: Record<string, any>): Promise<string>;
  /** Validate template syntax */
  validate(template: string): Promise<ValidationResult>;
}

/**
 * Template validation result
 */
export interface ValidationResult {
  /** Is template valid */
  valid: boolean;
  /** Validation errors */
  errors: ValidationError[];
  /** Validation warnings */
  warnings: ValidationWarning[];
}

/**
 * Template validation error
 */
export interface ValidationError {
  /** Error message */
  message: string;
  /** Line number */
  line?: number;
  /** Column number */
  column?: number;
  /** Error code */
  code?: string;
}

/**
 * Template validation warning
 */
export interface ValidationWarning {
  /** Warning message */
  message: string;
  /** Line number */
  line?: number;
  /** Column number */
  column?: number;
  /** Warning code */
  code?: string;
}

/**
 * Template processing options
 */
export interface TemplateOptions {
  /** Variable substitution map */
  variables: Record<string, any>;
  /** Enable strict mode */
  strict?: boolean;
  /** Custom delimiters */
  delimiters?: {
    start: string;
    end: string;
  };
  /** Enable caching */
  cache?: boolean;
}

/**
 * File streaming options
 */
export interface StreamOptions {
  /** Chunk size in bytes */
  chunkSize?: number;
  /** Enable compression */
  compress?: boolean;
  /** Encoding */
  encoding?: BufferEncoding;
}

/**
 * Template metadata
 */
export interface TemplateMetadata {
  /** Template name */
  name: string;
  /** Template version */
  version: string;
  /** Template description */
  description?: string;
  /** Template author */
  author?: string;
  /** Template tags */
  tags?: string[];
  /** Required variables */
  variables?: TemplateVariable[];
  /** Template dependencies */
  dependencies?: string[];
}

/**
 * Template variable definition
 */
export interface TemplateVariable {
  /** Variable name */
  name: string;
  /** Variable type */
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  /** Variable description */
  description?: string;
  /** Default value */
  default?: any;
  /** Is required */
  required?: boolean;
  /** Validation pattern */
  pattern?: string;
  /** Allowed values */
  enum?: any[];
}

/**
 * Error with additional context
 */
export interface DrutaError extends Error {
  /** Error code */
  code?: string;
  /** Error context */
  context?: Record<string, any>;
  /** Original error */
  cause?: Error;
}

/**
 * Performance metrics
 */
export interface PerformanceMetrics {
  /** Start time */
  startTime: number;
  /** End time */
  endTime?: number;
  /** Duration in milliseconds */
  duration?: number;
  /** Memory usage */
  memory?: {
    used: number;
    total: number;
  };
}

/**
 * CLI command options
 */
export interface CommandOptions {
  /** Command name */
  name: string;
  /** Command description */
  description: string;
  /** Command aliases */
  aliases?: string[];
  /** Command arguments */
  arguments?: CommandArgument[];
  /** Command options */
  options?: CommandOption[];
  /** Command handler */
  handler: CommandHandler;
}

/**
 * Command argument definition
 */
export interface CommandArgument {
  /** Argument name */
  name: string;
  /** Argument description */
  description: string;
  /** Is required */
  required?: boolean;
  /** Is variadic */
  variadic?: boolean;
}

/**
 * Command option definition
 */
export interface CommandOption {
  /** Option flags */
  flags: string;
  /** Option description */
  description: string;
  /** Default value */
  default?: any;
  /** Option choices */
  choices?: string[];
}

/**
 * Command handler function
 */
export type CommandHandler = (...args: any[]) => Promise<void> | void;
