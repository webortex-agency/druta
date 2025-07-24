/**
 * Template Engine Module Exports
 * Enterprise-grade template processing system for Druta CLI
 * @author Druta CLI Team
 */

// Main template engine orchestrator
export { 
  TemplateEngine, 
  createTemplateEngine, 
  createDefaultTemplateEngineConfig,
  type TemplateEngineConfig,
  type TemplateGenerationOptions,
  type TemplateGenerationResult,
  type TemplateEngineMetrics,
  type TemplateValidationResult
} from './engine.js';

// High-performance template parser
export {
  TemplateParser,
  defaultTemplateParserConfig,
  type TemplateParserConfig,
  type TemplateCompilationResult,
  type TemplateMetadata
} from './parser.js';

// Streaming file processor
export {
  StreamingFileProcessor,
  defaultProcessingOptions,
  type ProcessingOptions,
  type ProcessingJob,
  type FileProcessingResult,
  type BatchProcessingResult,
  type ProcessingMetrics,
  type FileFilter
} from './processor.js';

// Template registry system
export {
  TemplateRegistry,
  defaultRegistryConfig,
  type RegistryConfig,
  type TemplateMetadata as RegistryTemplateMetadata,
  type TemplateSearchOptions,
  type TemplateSearchResult,
  type TemplateInstallResult,
  type TemplateDependency,
  type TemplateVariableSchema,
  type TemplateFileConfig,
  type TemplateHooks,
  type SecurityStatus,
  type SecurityIssue
} from './registry.js';

// Variable substitution engine
export {
  VariableSubstitutionEngine,
  defaultVariableConfig,
  type VariableConfig,
  type VariableContext,
  type VariableResolutionOptions,
  type VariableValidationResult,
  type VariableValidationError,
  type VariableTransformer
} from './variables.js';

/**
 * Template engine version and metadata
 */
export const TEMPLATE_ENGINE_VERSION = '1.0.0';
export const TEMPLATE_ENGINE_NAME = 'Druta Template Engine';

/**
 * Performance benchmarks achieved
 */
export const PERFORMANCE_BENCHMARKS = {
  /** Template parsing time target */
  PARSING_TARGET_MS: 20,
  /** Batch processing target for 1000 files */
  BATCH_PROCESSING_TARGET_MS: 3000,
  /** Memory usage optimization */
  MEMORY_COMPLEXITY: 'O(n)',
  /** Cache hit rate target */
  CACHE_HIT_RATE_TARGET: 0.9,
  /** Startup overhead target */
  STARTUP_OVERHEAD_TARGET_MS: 50
} as const;

/**
 * Template engine capabilities
 */
export const CAPABILITIES = {
  /** ETA.js-based compilation */
  ETA_COMPILATION: true,
  /** AST caching system */
  AST_CACHING: true,
  /** Streaming file processing */
  STREAMING_PROCESSING: true,
  /** Worker thread concurrency */
  WORKER_THREADS: true,
  /** Binary file detection */
  BINARY_DETECTION: true,
  /** Permission preservation */
  PERMISSION_PRESERVATION: true,
  /** Template inheritance */
  TEMPLATE_INHERITANCE: true,
  /** Hot-reload support */
  HOT_RELOAD: true,
  /** Security scanning */
  SECURITY_SCANNING: true,
  /** Community templates */
  COMMUNITY_TEMPLATES: true,
  /** Semantic versioning */
  SEMANTIC_VERSIONING: true,
  /** Type-safe variables */
  TYPE_SAFE_VARIABLES: true,
  /** Environment merging */
  ENVIRONMENT_MERGING: true,
  /** Secret management */
  SECRET_MANAGEMENT: true,
  /** Custom transformers */
  CUSTOM_TRANSFORMERS: true,
  /** Variable interpolation */
  VARIABLE_INTERPOLATION: true,
  /** Performance analytics */
  PERFORMANCE_ANALYTICS: true
} as const;
