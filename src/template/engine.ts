/**
 * Main Template Engine Orchestrator
 * Integrates parser, processor, registry, and variable engine for enterprise-grade template processing
 * @author Druta CLI Team
 */

import { performance } from 'node:perf_hooks';
import { join } from 'node:path';
import { mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import type { Logger } from '../core/logger.js';
import { TemplateParser, defaultTemplateParserConfig, type TemplateParserConfig } from './parser.js';
import { StreamingFileProcessor, defaultProcessingOptions, type ProcessingOptions, type BatchProcessingResult } from './processor.js';
import { TemplateRegistry, defaultRegistryConfig, type RegistryConfig, type TemplateMetadata } from './registry.js';
import { VariableSubstitutionEngine, defaultVariableConfig, type VariableConfig, type VariableContext } from './variables.js';

/**
 * Template engine configuration
 */
export interface TemplateEngineConfig {
  /** Template parser configuration */
  parser: TemplateParserConfig;
  /** File processor configuration */
  processor: ProcessingOptions;
  /** Template registry configuration */
  registry: RegistryConfig;
  /** Variable engine configuration */
  variables: VariableConfig;
  /** Enable hot-reload for development */
  enableHotReload: boolean;
  /** Enable performance analytics */
  enableAnalytics: boolean;
  /** Maximum concurrent operations */
  maxConcurrency: number;
}

/**
 * Template generation options
 */
export interface TemplateGenerationOptions {
  /** Template name or path */
  template: string;
  /** Template version (for registry templates) */
  version?: string;
  /** Output directory */
  outputDir: string;
  /** Template variables */
  variables?: Record<string, any>;
  /** Target environment */
  environment?: string;
  /** Force overwrite existing files */
  force?: boolean;
  /** Dry run (don't write files) */
  dryRun?: boolean;
  /** Enable verbose logging */
  verbose?: boolean;
  /** Custom processing options */
  processingOptions?: Partial<ProcessingOptions>;
}

/**
 * Template generation result
 */
export interface TemplateGenerationResult {
  /** Generation status */
  status: 'success' | 'failed' | 'partial';
  /** Template metadata */
  template: TemplateMetadata;
  /** Variable context used */
  variables: VariableContext;
  /** File processing result */
  processing: BatchProcessingResult;
  /** Generation time in milliseconds */
  generationTime: number;
  /** Output directory */
  outputDir: string;
  /** Error message if failed */
  error?: string;
  /** Performance metrics */
  metrics: TemplateEngineMetrics;
}

/**
 * Template engine performance metrics
 */
export interface TemplateEngineMetrics {
  /** Template resolution time */
  templateResolutionTime: number;
  /** Variable resolution time */
  variableResolutionTime: number;
  /** File processing time */
  fileProcessingTime: number;
  /** Total generation time */
  totalGenerationTime: number;
  /** Files processed */
  filesProcessed: number;
  /** Templates cached */
  templatesCached: number;
  /** Variables cached */
  variablesCached: number;
  /** Memory usage (MB) */
  memoryUsage: number;
}

/**
 * Template validation result
 */
export interface TemplateValidationResult {
  /** Validation status */
  valid: boolean;
  /** Validation errors */
  errors: string[];
  /** Validation warnings */
  warnings: string[];
  /** Template metadata */
  metadata?: TemplateMetadata;
}

/**
 * Enterprise-grade template engine orchestrator
 * Coordinates all template processing components for optimal performance
 */
export class TemplateEngine {
  private readonly config: TemplateEngineConfig;
  private readonly logger: Logger;
  private readonly parser: TemplateParser;
  private readonly processor: StreamingFileProcessor;
  private readonly registry: TemplateRegistry;
  private readonly variables: VariableSubstitutionEngine;
  private readonly metrics: TemplateEngineMetrics = {
    templateResolutionTime: 0,
    variableResolutionTime: 0,
    fileProcessingTime: 0,
    totalGenerationTime: 0,
    filesProcessed: 0,
    templatesCached: 0,
    variablesCached: 0,
    memoryUsage: 0
  };

  /**
   * Initialize template engine with all components
   */
  constructor(config: TemplateEngineConfig, logger: Logger) {
    this.config = config;
    this.logger = logger;

    // Initialize all components
    this.parser = new TemplateParser(config.parser, logger);
    this.registry = new TemplateRegistry(config.registry, logger);
    this.variables = new VariableSubstitutionEngine(config.variables, logger);
    this.processor = new StreamingFileProcessor(this.parser, logger, config.maxConcurrency);

    this.logger.info('Template engine initialized', {
      enableHotReload: config.enableHotReload,
      enableAnalytics: config.enableAnalytics,
      maxConcurrency: config.maxConcurrency
    });
  }

  /**
   * Generate SaaS application from template
   * Main entry point for template processing
   */
  async generateFromTemplate(options: TemplateGenerationOptions): Promise<TemplateGenerationResult> {
    const startTime = performance.now();
    
    try {
      this.logger.info(`Starting template generation: ${options.template}`, {
        outputDir: options.outputDir,
        environment: options.environment,
        dryRun: options.dryRun
      });

      // Step 1: Resolve template metadata
      const templateStartTime = performance.now();
      const template = await this.resolveTemplate(options.template, options.version);
      const templateResolutionTime = performance.now() - templateStartTime;

      if (!template) {
        throw new Error(`Template not found: ${options.template}${options.version ? `@${options.version}` : ''}`);
      }

      // Step 2: Validate template
      const validation = await this.validateTemplate(template);
      if (!validation.valid) {
        throw new Error(`Template validation failed: ${validation.errors.join(', ')}`);
      }

      // Step 3: Resolve variables
      const variableStartTime = performance.now();
      const variableContext = await this.variables.resolveVariables(
        options.variables || {},
        {
          ...(options.environment && { environment: options.environment }),
          includeSystem: true,
          includeEnv: true,
          enableInterpolation: true
        }
      );
      const variableResolutionTime = performance.now() - variableStartTime;

      // Step 4: Prepare output directory
      if (!options.dryRun) {
        await this.prepareOutputDirectory(options.outputDir, options.force || false);
      }

      // Step 5: Process template files
      const processingStartTime = performance.now();
      const templatePath = await this.getTemplatePath(template);
      const processingOptions = {
        ...defaultProcessingOptions,
        ...options.processingOptions
      };

      let processingResult: BatchProcessingResult;
      
      if (options.dryRun) {
        // Simulate processing for dry run
        processingResult = await this.simulateProcessing(templatePath, options.outputDir, variableContext, processingOptions);
      } else {
        // Actual file processing
        processingResult = await this.processor.processBatch(
          templatePath,
          options.outputDir,
          this.flattenVariableContext(variableContext),
          processingOptions
        );
      }
      
      const fileProcessingTime = performance.now() - processingStartTime;

      // Step 6: Run post-generation hooks
      if (!options.dryRun && template.hooks.postGenerate) {
        await this.runPostGenerationHooks(template.hooks.postGenerate, options.outputDir, variableContext);
      }

      // Step 7: Update metrics
      const totalGenerationTime = performance.now() - startTime;
      this.updateMetrics({
        templateResolutionTime,
        variableResolutionTime,
        fileProcessingTime,
        totalGenerationTime,
        filesProcessed: processingResult.totalFiles,
        templatesCached: 0, // Would get from parser
        variablesCached: 0, // Would get from variables engine
        memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024
      });

      const result: TemplateGenerationResult = {
        status: processingResult.errorCount > 0 ? 'partial' : 'success',
        template,
        variables: variableContext,
        processing: processingResult,
        generationTime: totalGenerationTime,
        outputDir: options.outputDir,
        metrics: { ...this.metrics }
      };

      this.logger.info(`Template generation completed: ${options.template}`, {
        status: result.status,
        filesProcessed: processingResult.totalFiles,
        successCount: processingResult.successCount,
        errorCount: processingResult.errorCount,
        totalTime: `${totalGenerationTime.toFixed(2)}ms`,
        throughput: `${processingResult.metrics.throughput.toFixed(2)} files/sec`
      });

      // Performance warning if targets not met
      if (processingResult.totalFiles >= 1000 && totalGenerationTime > 3000) {
        this.logger.warn(`Generation exceeded 3s target for 1000+ files: ${totalGenerationTime.toFixed(2)}ms`);
      }

      return result;

    } catch (error: any) {
      const totalGenerationTime = performance.now() - startTime;
      
      this.logger.error(`Template generation failed: ${options.template}`, {
        error: error.message,
        totalTime: `${totalGenerationTime.toFixed(2)}ms`,
        outputDir: options.outputDir
      });

      return {
        status: 'failed',
        template: {} as TemplateMetadata,
        variables: {} as VariableContext,
        processing: {} as BatchProcessingResult,
        generationTime: totalGenerationTime,
        outputDir: options.outputDir,
        error: error.message,
        metrics: { ...this.metrics }
      };
    }
  }

  /**
   * List available templates
   */
  async listTemplates(options: {
    category?: string;
    author?: string;
    includeRemote?: boolean;
  } = {}): Promise<TemplateMetadata[]> {
    try {
      const searchResult = await this.registry.searchTemplates({
        ...(options.category && { category: options.category }),
        ...(options.author && { author: options.author }),
        sortBy: 'name',
        sortOrder: 'asc'
      });

      return searchResult.templates;
    } catch (error: any) {
      this.logger.error('Failed to list templates', { error: error.message });
      return [];
    }
  }

  /**
   * Validate template structure and metadata
   */
  async validateTemplate(template: TemplateMetadata): Promise<TemplateValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Validate basic metadata
      if (!template.name || template.name.trim().length === 0) {
        errors.push('Template name is required');
      }

      if (!template.version || !this.isValidSemver(template.version)) {
        errors.push('Valid semver version is required');
      }

      if (!template.description || template.description.trim().length === 0) {
        warnings.push('Template description is missing');
      }

      // Validate dependencies
      for (const dep of template.dependencies || []) {
        if (!dep.name || !dep.version) {
          errors.push(`Invalid dependency: ${JSON.stringify(dep)}`);
        }
      }

      // Validate variable schemas
      for (const variable of template.variables || []) {
        if (!variable.name || !variable.type) {
          errors.push(`Invalid variable schema: ${JSON.stringify(variable)}`);
        }
      }

      // Validate file configurations
      for (const file of template.files || []) {
        if (!file.source || !file.destination) {
          errors.push(`Invalid file configuration: ${JSON.stringify(file)}`);
        }
      }

      // Security validation
      if (template.securityStatus.status === 'failed') {
        errors.push('Template failed security scan');
      } else if (template.securityStatus.status === 'warning') {
        warnings.push('Template has security warnings');
      }

      return {
        valid: errors.length === 0,
        errors,
        warnings,
        metadata: template
      };

    } catch (error: any) {
      return {
        valid: false,
        errors: [`Template validation error: ${error.message}`],
        warnings,
        metadata: template
      };
    }
  }

  /**
   * Install template from registry
   */
  async installTemplate(name: string, version?: string): Promise<void> {
    try {
      const result = await this.registry.installTemplate(name, version);
      
      if (result.status === 'success') {
        this.logger.info(`Template installed: ${name}@${result.template.version}`, {
          installPath: result.installPath,
          installTime: `${result.installTime.toFixed(2)}ms`
        });
      } else {
        throw new Error(result.error || 'Installation failed');
      }
    } catch (error: any) {
      this.logger.error(`Template installation failed: ${name}@${version}`, {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get template engine performance metrics
   */
  getMetrics(): TemplateEngineMetrics {
    return { ...this.metrics };
  }

  /**
   * Clear all caches
   */
  clearCaches(): void {
    this.parser.clearCache();
    this.registry.clearCache();
    this.variables.clearCache();
    this.logger.info('All template engine caches cleared');
  }

  /**
   * Resolve template from registry or local path
   */
  private async resolveTemplate(templateName: string, version?: string): Promise<TemplateMetadata | null> {
    // Try registry first
    const registryTemplate = await this.registry.getTemplate(templateName, version);
    if (registryTemplate) {
      return registryTemplate;
    }

    // Try local path
    if (existsSync(templateName)) {
      // Load local template metadata
      const metadataPath = join(templateName, 'template.json');
      if (existsSync(metadataPath)) {
        try {
          const content = await import('node:fs').then(fs => fs.promises.readFile(metadataPath, 'utf-8'));
          return JSON.parse(content) as TemplateMetadata;
        } catch (error: any) {
          this.logger.warn(`Failed to load local template metadata: ${metadataPath}`, {
            error: error.message
          });
        }
      }
    }

    return null;
  }

  /**
   * Get template file path
   */
  private async getTemplatePath(template: TemplateMetadata): Promise<string> {
    // For registry templates, get installation path
    if (template.repository) {
      return join(this.config.registry.cacheDirectory, 'templates', template.name, template.version);
    }

    // For local templates, use the path directly
    return template.name;
  }

  /**
   * Prepare output directory
   */
  private async prepareOutputDirectory(outputDir: string, force: boolean): Promise<void> {
    if (existsSync(outputDir)) {
      if (!force) {
        throw new Error(`Output directory already exists: ${outputDir}. Use --force to overwrite.`);
      }
      this.logger.warn(`Overwriting existing directory: ${outputDir}`);
    }

    await mkdir(outputDir, { recursive: true });
  }

  /**
   * Simulate processing for dry run
   */
  private async simulateProcessing(
    _templatePath: string,
    _outputDir: string,
    _variables: VariableContext,
    _options: ProcessingOptions
  ): Promise<BatchProcessingResult> {
    // Implementation would simulate file discovery and processing
    // For now, return mock result
    return {
      totalFiles: 0,
      successCount: 0,
      skippedCount: 0,
      errorCount: 0,
      totalTime: 0,
      results: [],
      metrics: {
        throughput: 0,
        averageProcessingTime: 0,
        peakMemoryUsage: 0,
        cpuUtilization: 0,
        cacheHitRate: 0
      }
    };
  }

  /**
   * Run post-generation hooks
   */
  private async runPostGenerationHooks(
    hooks: string[],
    _outputDir: string,
    _variables: VariableContext
  ): Promise<void> {
    for (const hook of hooks) {
      try {
        this.logger.debug(`Running post-generation hook: ${hook}`);
        // Implementation would execute hook commands
        // For now, just log
      } catch (error: any) {
        this.logger.warn(`Post-generation hook failed: ${hook}`, {
          error: error.message
        });
      }
    }
  }

  /**
   * Flatten variable context for template processing
   */
  private flattenVariableContext(context: VariableContext): Record<string, any> {
    return {
      ...context.env,
      ...context.system,
      ...context.user,
      ...context.computed
      // Note: secrets are handled separately for security
    };
  }

  /**
   * Update performance metrics
   */
  private updateMetrics(newMetrics: Partial<TemplateEngineMetrics>): void {
    Object.assign(this.metrics, newMetrics);
  }

  /**
   * Validate semver version
   */
  private isValidSemver(version: string): boolean {
    const semverRegex = /^\d+\.\d+\.\d+(-[a-zA-Z0-9.-]+)?(\+[a-zA-Z0-9.-]+)?$/;
    return semverRegex.test(version);
  }
}

/**
 * Create default template engine configuration
 */
export function createDefaultTemplateEngineConfig(templateRoot: string): TemplateEngineConfig {
  return {
    parser: {
      ...defaultTemplateParserConfig,
      templateRoot
    } as TemplateParserConfig,
    processor: defaultProcessingOptions,
    registry: {
      ...defaultRegistryConfig,
      localDirectories: [templateRoot, ...defaultRegistryConfig.localDirectories!]
    } as RegistryConfig,
    variables: defaultVariableConfig as VariableConfig,
    enableHotReload: false,
    enableAnalytics: true,
    maxConcurrency: 8
  };
}

/**
 * Template engine factory function
 */
export function createTemplateEngine(
  config: Partial<TemplateEngineConfig>,
  logger: Logger
): TemplateEngine {
  const defaultConfig = createDefaultTemplateEngineConfig('./templates');
  const mergedConfig = {
    ...defaultConfig,
    ...config,
    parser: { ...defaultConfig.parser, ...config.parser },
    processor: { ...defaultConfig.processor, ...config.processor },
    registry: { ...defaultConfig.registry, ...config.registry },
    variables: { ...defaultConfig.variables, ...config.variables }
  };

  return new TemplateEngine(mergedConfig, logger);
}
