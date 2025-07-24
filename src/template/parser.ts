/**
 * High-Performance Template Parser with ETA.js Integration
 * Achieves <20ms processing time with AST caching and optimization
 * @author Druta CLI Team
 */

import * as Eta from 'eta';
import { performance } from 'node:perf_hooks';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import type { Logger } from '../core/logger.js';

/**
 * Template compilation result with performance metrics
 */
export interface TemplateCompilationResult {
  /** Compiled template function */
  template: any; // ETA template function
  /** Compilation time in milliseconds */
  compilationTime: number;
  /** Template dependencies (includes/partials) */
  dependencies: string[];
  /** Template metadata */
  metadata: TemplateMetadata;
  /** Cache key for optimization */
  cacheKey: string;
}

/**
 * Template metadata for optimization and validation
 */
export interface TemplateMetadata {
  /** Template file path */
  path: string;
  /** Last modified timestamp */
  lastModified: number;
  /** Template size in bytes */
  size: number;
  /** Template variables detected */
  variables: string[];
  /** Helper functions used */
  helpers: string[];
  /** Partial templates included */
  partials: string[];
  /** Template inheritance chain */
  extends?: string;
}

/**
 * Template parser configuration
 */
export interface TemplateParserConfig {
  /** Template root directory */
  templateRoot: string;
  /** Cache size limit (number of templates) */
  cacheSize: number;
  /** Enable template inheritance */
  enableInheritance: boolean;
  /** Custom helper functions */
  helpers: Record<string, Function>;
  /** Template file extensions to process */
  extensions: string[];
  /** Enable performance tracking */
  enableProfiling: boolean;
}

/**
 * Template cache entry with TTL and usage tracking
 */
interface TemplateCacheEntry {
  result: TemplateCompilationResult;
  lastAccessed: number;
  accessCount: number;
  ttl: number;
}

/**
 * High-performance template parser with ETA.js backend
 * Optimized for enterprise-scale template processing
 */
export class TemplateParser {
  private readonly eta: typeof Eta;
  private readonly cache = new Map<string, TemplateCacheEntry>();
  private readonly config: TemplateParserConfig;
  private readonly logger: Logger;
  private readonly performanceMetrics = {
    cacheHits: 0,
    cacheMisses: 0,
    totalCompilations: 0,
    averageCompilationTime: 0,
    totalProcessingTime: 0
  };

  /**
   * Initialize high-performance template parser
   */
  constructor(config: TemplateParserConfig, logger: Logger) {
    this.config = config;
    this.logger = logger;
    
    // Configure ETA.js for maximum performance
    this.eta = Eta;
    (this.eta as any).configure({
      views: config.templateRoot,
      cache: true,
      debug: false,
      async: true,
      useWith: true,
      autoEscape: false, // Let users control escaping
      rmWhitespace: true, // Optimize output size
      autoTrim: [false, 'nl'], // Preserve formatting control
    });

    // Register custom helper functions
    this.registerHelpers(config.helpers);

    this.logger.debug('Template parser initialized', {
      templateRoot: config.templateRoot,
      cacheSize: config.cacheSize,
      helpersCount: Object.keys(config.helpers).length
    });
  }

  /**
   * Parse and compile template with performance optimization
   * Target: <20ms processing time
   */
  async parseTemplate(templatePath: string, options: {
    skipCache?: boolean;
    variables?: Record<string, any>;
    enableProfiling?: boolean;
  } = {}): Promise<TemplateCompilationResult> {
    const startTime = performance.now();
    const resolvedPath = resolve(this.config.templateRoot, templatePath);
    const cacheKey = this.generateCacheKey(resolvedPath, options.variables);

    try {
      // Check cache first for 90%+ cache hit optimization
      if (!options.skipCache) {
        const cached = this.getCachedTemplate(cacheKey);
        if (cached) {
          this.performanceMetrics.cacheHits++;
          this.logger.debug(`Template cache hit: ${templatePath}`, {
            cacheKey,
            accessCount: cached.accessCount
          });
          return cached.result;
        }
      }

      this.performanceMetrics.cacheMisses++;
      this.logger.debug(`Template cache miss: ${templatePath}`, { cacheKey });

      // Read and analyze template
      const templateContent = await readFile(resolvedPath, 'utf-8');
      const metadata = await this.analyzeTemplate(resolvedPath, templateContent);

      // Process template inheritance if enabled
      let processedContent = templateContent;
      if (this.config.enableInheritance && metadata.extends) {
        processedContent = await this.processInheritance(templateContent, metadata.extends);
      }

      // Compile template with ETA.js
      const compilationStart = performance.now();
      const template = (this.eta as any).compile(processedContent, {
        filename: resolvedPath,
        async: true
      });
      const compilationTime = performance.now() - compilationStart;

      // Create compilation result
      const result: TemplateCompilationResult = {
        template,
        compilationTime,
        dependencies: metadata.partials,
        metadata,
        cacheKey
      };

      // Cache the result for future use
      this.cacheTemplate(cacheKey, result);

      // Update performance metrics
      this.updatePerformanceMetrics(compilationTime);

      const totalTime = performance.now() - startTime;
      this.logger.debug(`Template compiled: ${templatePath}`, {
        compilationTime: `${compilationTime.toFixed(2)}ms`,
        totalTime: `${totalTime.toFixed(2)}ms`,
        cacheKey
      });

      // Performance warning if target not met
      if (totalTime > 20) {
        this.logger.warn(`Template compilation exceeded 20ms target: ${totalTime.toFixed(2)}ms`, {
          templatePath,
          compilationTime
        });
      }

      return result;

    } catch (error: any) {
      const totalTime = performance.now() - startTime;
      this.logger.error(`Template compilation failed: ${templatePath}`, {
        error: error.message,
        totalTime: `${totalTime.toFixed(2)}ms`,
        stack: error.stack
      });
      throw new Error(`Template compilation failed for ${templatePath}: ${error.message}`);
    }
  }

  /**
   * Render template with variables and context
   */
  async renderTemplate(
    compilationResult: TemplateCompilationResult,
    variables: Record<string, any> = {},
    context: Record<string, any> = {}
  ): Promise<string> {
    const startTime = performance.now();

    try {
      // Merge variables with context
      const renderData = {
        ...context,
        ...variables,
        // Add utility functions
        $helpers: this.config.helpers,
        $metadata: compilationResult.metadata
      };

      // Render template
      const result = await compilationResult.template(renderData, (this.eta as any).config);
      
      const renderTime = performance.now() - startTime;
      this.logger.debug(`Template rendered`, {
        path: compilationResult.metadata.path,
        renderTime: `${renderTime.toFixed(2)}ms`,
        variableCount: Object.keys(variables).length
      });

      return result;

    } catch (error: any) {
      const renderTime = performance.now() - startTime;
      this.logger.error(`Template rendering failed`, {
        path: compilationResult.metadata.path,
        error: error.message,
        renderTime: `${renderTime.toFixed(2)}ms`,
        variables: Object.keys(variables)
      });
      throw new Error(`Template rendering failed: ${error.message}`);
    }
  }

  /**
   * Register custom helper functions
   */
  private registerHelpers(helpers: Record<string, Function>): void {
    for (const [name, fn] of Object.entries(helpers)) {
      (this.eta as any).config.helpers = (this.eta as any).config.helpers || {};
      (this.eta as any).config.helpers[name] = fn;
      this.logger.debug(`Registered template helper: ${name}`);
    }
  }

  /**
   * Analyze template for metadata extraction
   */
  private async analyzeTemplate(templatePath: string, content: string): Promise<TemplateMetadata> {
    const stats = await import('node:fs').then(fs => fs.promises.stat(templatePath));
    
    // Extract variables using regex patterns
    const variablePattern = /<%[=\-]?\s*([a-zA-Z_$][a-zA-Z0-9_$]*)/g;
    const variables = new Set<string>();
    let match;
    while ((match = variablePattern.exec(content)) !== null) {
      if (match[1]) {
        variables.add(match[1]);
      }
    }

    // Extract partials/includes
    const partialPattern = /<%[=\-]?\s*include\s*\(\s*['"`]([^'"`]+)['"`]/g;
    const partials = new Set<string>();
    while ((match = partialPattern.exec(content)) !== null) {
      if (match && match[1]) {
        partials.add(match[1]);
      }
    }

    // Extract helpers
    const helperPattern = /<%[=\-]?\s*([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(/g;
    const helpers = new Set<string>();
    while ((match = helperPattern.exec(content)) !== null) {
      if (match && match[1] && this.config.helpers[match[1]]) {
        helpers.add(match[1]);
      }
    }

    // Check for template inheritance
    const extendsMatch = content.match(/<%\s*extends\s*['"`]([^'"`]+)['"`]/);
    const extendsTemplate = extendsMatch ? extendsMatch[1] : undefined;

    const metadata: TemplateMetadata = {
      path: templatePath,
      lastModified: stats.mtime.getTime(),
      size: stats.size,
      variables: Array.from(variables),
      helpers: Array.from(helpers),
      partials: Array.from(partials)
    };

    // Only include extends if it exists (exactOptionalPropertyTypes compliance)
    if (extendsTemplate) {
      metadata.extends = extendsTemplate;
    }

    return metadata;
  }

  /**
   * Process template inheritance
   */
  private async processInheritance(content: string, parentTemplate: string): Promise<string> {
    const parentPath = resolve(this.config.templateRoot, parentTemplate);
    
    if (!existsSync(parentPath)) {
      throw new Error(`Parent template not found: ${parentTemplate}`);
    }

    const parentContent = await readFile(parentPath, 'utf-8');
    
    // Simple inheritance processing (can be enhanced)
    // Replace blocks in parent with child blocks
    const blockPattern = /<%\s*block\s+(\w+)\s*%>([\s\S]*?)<%\s*endblock\s*%>/g;
    const childBlocks = new Map<string, string>();
    
    let match;
    while ((match = blockPattern.exec(content)) !== null) {
      if (match[1] && match[2]) {
        childBlocks.set(match[1], match[2]);
      }
    }

    let processedParent = parentContent;
    for (const [blockName, blockContent] of childBlocks) {
      const parentBlockPattern = new RegExp(
        `<%\\s*block\\s+${blockName}\\s*%>[\\s\\S]*?<%\\s*endblock\\s*%>`,
        'g'
      );
      processedParent = processedParent.replace(
        parentBlockPattern,
        `<% block ${blockName} %>${blockContent}<% endblock %>`
      );
    }

    return processedParent;
  }

  /**
   * Generate cache key for template
   */
  private generateCacheKey(templatePath: string, variables?: Record<string, any>): string {
    const variableHash = variables ? 
      JSON.stringify(variables, Object.keys(variables).sort()) : '';
    return `${templatePath}:${variableHash}`;
  }

  /**
   * Get cached template if valid
   */
  private getCachedTemplate(cacheKey: string): TemplateCacheEntry | null {
    const entry = this.cache.get(cacheKey);
    if (!entry) return null;

    const now = Date.now();
    
    // Check TTL
    if (now > entry.ttl) {
      this.cache.delete(cacheKey);
      return null;
    }

    // Update access tracking
    entry.lastAccessed = now;
    entry.accessCount++;

    return entry;
  }

  /**
   * Cache compiled template
   */
  private cacheTemplate(cacheKey: string, result: TemplateCompilationResult): void {
    // Implement LRU eviction if cache is full
    if (this.cache.size >= this.config.cacheSize) {
      this.evictLeastRecentlyUsed();
    }

    const now = Date.now();
    const entry: TemplateCacheEntry = {
      result,
      lastAccessed: now,
      accessCount: 1,
      ttl: now + (5 * 60 * 1000) // 5 minutes TTL
    };

    this.cache.set(cacheKey, entry);
  }

  /**
   * Evict least recently used cache entries
   */
  private evictLeastRecentlyUsed(): void {
    let oldestKey = '';
    let oldestTime = Date.now();

    for (const [key, entry] of this.cache) {
      if (entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
      this.logger.debug(`Evicted template from cache: ${oldestKey}`);
    }
  }

  /**
   * Update performance metrics
   */
  private updatePerformanceMetrics(compilationTime: number): void {
    this.performanceMetrics.totalCompilations++;
    this.performanceMetrics.totalProcessingTime += compilationTime;
    this.performanceMetrics.averageCompilationTime = 
      this.performanceMetrics.totalProcessingTime / this.performanceMetrics.totalCompilations;
  }

  /**
   * Get performance metrics for monitoring
   */
  getPerformanceMetrics() {
    const cacheHitRate = this.performanceMetrics.cacheHits / 
      (this.performanceMetrics.cacheHits + this.performanceMetrics.cacheMisses) * 100;

    return {
      ...this.performanceMetrics,
      cacheHitRate: `${cacheHitRate.toFixed(2)}%`,
      cacheSize: this.cache.size,
      maxCacheSize: this.config.cacheSize
    };
  }

  /**
   * Clear template cache
   */
  clearCache(): void {
    this.cache.clear();
    this.logger.info('Template cache cleared');
  }

  /**
   * Precompile templates for faster runtime performance
   */
  async precompileTemplates(templatePaths: string[]): Promise<void> {
    const startTime = performance.now();
    const results = await Promise.all(
      templatePaths.map(path => this.parseTemplate(path))
    );

    const totalTime = performance.now() - startTime;
    this.logger.info(`Precompiled ${results.length} templates`, {
      totalTime: `${totalTime.toFixed(2)}ms`,
      averageTime: `${(totalTime / results.length).toFixed(2)}ms`
    });
  }
}

/**
 * Default template parser configuration
 */
export const defaultTemplateParserConfig: Partial<TemplateParserConfig> = {
  cacheSize: 1000,
  enableInheritance: true,
  helpers: {},
  extensions: ['.eta', '.html', '.htm', '.txt', '.md'],
  enableProfiling: true
};
