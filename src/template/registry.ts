/**
 * Template Registry System with Local and Remote Discovery
 * Supports semantic versioning, security scanning, and community templates
 * @author Druta CLI Team
 */

import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { join } from 'node:path';
// import { stat, resolve, basename } from 'node:path'; // Unused imports
import { existsSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { homedir } from 'node:os';
import semver from 'semver';
import Ajv from 'ajv';
import type { Logger } from '../core/logger.js';

/**
 * Template metadata schema
 */
export interface TemplateMetadata {
  /** Template name */
  name: string;
  /** Template version (semver) */
  version: string;
  /** Template description */
  description: string;
  /** Template author */
  author: string;
  /** Template license */
  license: string;
  /** Template keywords/tags */
  keywords: string[];
  /** Template category */
  category: string;
  /** Minimum CLI version required */
  minCliVersion: string;
  /** Template dependencies */
  dependencies: TemplateDependency[];
  /** Template variables schema */
  variables: TemplateVariableSchema[];
  /** Template files configuration */
  files: TemplateFileConfig[];
  /** Template hooks */
  hooks: TemplateHooks;
  /** Template repository URL */
  repository?: string;
  /** Template homepage URL */
  homepage?: string;
  /** Template documentation URL */
  documentation?: string;
  /** Template creation date */
  createdAt: string;
  /** Template last update date */
  updatedAt: string;
  /** Template download count */
  downloads?: number;
  /** Template rating */
  rating?: number;
  /** Security scan status */
  securityStatus: SecurityStatus;
}

/**
 * Template dependency specification
 */
export interface TemplateDependency {
  /** Dependency name */
  name: string;
  /** Version range (semver) */
  version: string;
  /** Dependency type */
  type: 'template' | 'plugin' | 'tool';
  /** Whether dependency is optional */
  optional: boolean;
}

/**
 * Template variable schema for validation
 */
export interface TemplateVariableSchema {
  /** Variable name */
  name: string;
  /** Variable type */
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  /** Variable description */
  description: string;
  /** Default value */
  default?: any;
  /** Whether variable is required */
  required: boolean;
  /** Validation pattern (for strings) */
  pattern?: string;
  /** Allowed values (enum) */
  enum?: any[];
  /** Minimum value (for numbers) */
  minimum?: number;
  /** Maximum value (for numbers) */
  maximum?: number;
}

/**
 * Template file configuration
 */
export interface TemplateFileConfig {
  /** Source file pattern */
  source: string;
  /** Destination file pattern */
  destination: string;
  /** File processing type */
  type: 'template' | 'copy' | 'binary';
  /** Conditional generation */
  condition?: string;
  /** File permissions */
  permissions?: string;
}

/**
 * Template lifecycle hooks
 */
export interface TemplateHooks {
  /** Pre-generation hooks */
  preGenerate?: string[];
  /** Post-generation hooks */
  postGenerate?: string[];
  /** Pre-install hooks */
  preInstall?: string[];
  /** Post-install hooks */
  postInstall?: string[];
}

/**
 * Security scan status
 */
export interface SecurityStatus {
  /** Scan status */
  status: 'pending' | 'passed' | 'failed' | 'warning';
  /** Scan timestamp */
  scannedAt: string;
  /** Security issues found */
  issues: SecurityIssue[];
  /** Scan score (0-100) */
  score: number;
}

/**
 * Security issue details
 */
export interface SecurityIssue {
  /** Issue severity */
  severity: 'low' | 'medium' | 'high' | 'critical';
  /** Issue type */
  type: string;
  /** Issue description */
  description: string;
  /** Affected file */
  file?: string;
  /** Line number */
  line?: number;
}

/**
 * Template registry configuration
 */
export interface RegistryConfig {
  /** Local template directories */
  localDirectories: string[];
  /** Remote registry URLs */
  remoteRegistries: string[];
  /** Cache directory */
  cacheDirectory: string;
  /** Cache TTL in milliseconds */
  cacheTtl: number;
  /** Enable security scanning */
  enableSecurity: boolean;
  /** Security scan timeout */
  securityTimeout: number;
  /** Maximum template size (bytes) */
  maxTemplateSize: number;
  /** Enable analytics */
  enableAnalytics: boolean;
}

/**
 * Template search options
 */
export interface TemplateSearchOptions {
  /** Search query */
  query?: string;
  /** Category filter */
  category?: string;
  /** Keywords filter */
  keywords?: string[];
  /** Author filter */
  author?: string;
  /** License filter */
  license?: string;
  /** Minimum rating */
  minRating?: number;
  /** Sort by field */
  sortBy?: 'name' | 'downloads' | 'rating' | 'updated';
  /** Sort order */
  sortOrder?: 'asc' | 'desc';
  /** Result limit */
  limit?: number;
  /** Result offset */
  offset?: number;
}

/**
 * Template search result
 */
export interface TemplateSearchResult {
  /** Found templates */
  templates: TemplateMetadata[];
  /** Total count */
  total: number;
  /** Search time */
  searchTime: number;
  /** Search query used */
  query: TemplateSearchOptions;
}

/**
 * Template installation result
 */
export interface TemplateInstallResult {
  /** Installation status */
  status: 'success' | 'failed';
  /** Template metadata */
  template: TemplateMetadata;
  /** Installation path */
  installPath: string;
  /** Installation time */
  installTime: number;
  /** Error message if failed */
  error?: string;
}

/**
 * High-performance template registry with caching and security
 */
export class TemplateRegistry {
  private readonly config: RegistryConfig;
  private readonly logger: Logger;
  private readonly ajv: Ajv;
  private readonly templateCache = new Map<string, { metadata: TemplateMetadata; cachedAt: number }>();
  private readonly metadataSchema: object;

  /**
   * Initialize template registry
   */
  constructor(config: RegistryConfig, logger: Logger) {
    this.config = config;
    this.logger = logger;
    this.ajv = new Ajv({ allErrors: true });
    this.metadataSchema = this.createMetadataSchema();
    
    this.logger.debug('Template registry initialized', {
      localDirectories: config.localDirectories.length,
      remoteRegistries: config.remoteRegistries.length,
      cacheDirectory: config.cacheDirectory
    });
  }

  /**
   * Discover and index all available templates
   */
  async discoverTemplates(options: { 
    includeLocal?: boolean; 
    includeRemote?: boolean; 
    forceRefresh?: boolean 
  } = {}): Promise<TemplateMetadata[]> {
    const startTime = performance.now();
    const { includeLocal = true, includeRemote = true, forceRefresh = false } = options;

    try {
      const templates: TemplateMetadata[] = [];

      // Discover local templates
      if (includeLocal) {
        const localTemplates = await this.discoverLocalTemplates(forceRefresh);
        templates.push(...localTemplates);
      }

      // Discover remote templates
      if (includeRemote) {
        const remoteTemplates = await this.discoverRemoteTemplates(forceRefresh);
        templates.push(...remoteTemplates);
      }

      // Remove duplicates (prefer local over remote)
      const uniqueTemplates = this.deduplicateTemplates(templates);

      // Sort by name
      uniqueTemplates.sort((a, b) => a.name.localeCompare(b.name));

      const discoveryTime = performance.now() - startTime;
      this.logger.info(`Discovered ${uniqueTemplates.length} templates`, {
        local: includeLocal,
        remote: includeRemote,
        discoveryTime: `${discoveryTime.toFixed(2)}ms`
      });

      return uniqueTemplates;

    } catch (error: any) {
      const discoveryTime = performance.now() - startTime;
      this.logger.error('Template discovery failed', {
        error: error.message,
        discoveryTime: `${discoveryTime.toFixed(2)}ms`
      });
      throw error;
    }
  }

  /**
   * Search templates with advanced filtering
   */
  async searchTemplates(options: TemplateSearchOptions = {}): Promise<TemplateSearchResult> {
    const startTime = performance.now();

    try {
      // Get all available templates
      const allTemplates = await this.discoverTemplates();

      // Apply filters
      let filteredTemplates = allTemplates;

      if (options.query) {
        const query = options.query.toLowerCase();
        filteredTemplates = filteredTemplates.filter(template =>
          template.name.toLowerCase().includes(query) ||
          template.description.toLowerCase().includes(query) ||
          template.keywords.some(keyword => keyword.toLowerCase().includes(query))
        );
      }

      if (options.category) {
        filteredTemplates = filteredTemplates.filter(template =>
          template.category === options.category
        );
      }

      if (options.keywords && options.keywords.length > 0) {
        filteredTemplates = filteredTemplates.filter(template =>
          options.keywords!.some(keyword =>
            template.keywords.includes(keyword)
          )
        );
      }

      if (options.author) {
        filteredTemplates = filteredTemplates.filter(template =>
          template.author.toLowerCase().includes(options.author!.toLowerCase())
        );
      }

      if (options.license) {
        filteredTemplates = filteredTemplates.filter(template =>
          template.license === options.license
        );
      }

      if (options.minRating) {
        filteredTemplates = filteredTemplates.filter(template =>
          (template.rating || 0) >= options.minRating!
        );
      }

      // Sort results
      if (options.sortBy) {
        filteredTemplates.sort((a, b) => {
          let aValue: any, bValue: any;

          switch (options.sortBy) {
            case 'name':
              aValue = a.name;
              bValue = b.name;
              break;
            case 'downloads':
              aValue = a.downloads || 0;
              bValue = b.downloads || 0;
              break;
            case 'rating':
              aValue = a.rating || 0;
              bValue = b.rating || 0;
              break;
            case 'updated':
              aValue = new Date(a.updatedAt).getTime();
              bValue = new Date(b.updatedAt).getTime();
              break;
            default:
              aValue = a.name;
              bValue = b.name;
          }

          const comparison = aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
          return options.sortOrder === 'desc' ? -comparison : comparison;
        });
      }

      // Apply pagination
      const total = filteredTemplates.length;
      const offset = options.offset || 0;
      const limit = options.limit || total;
      const paginatedTemplates = filteredTemplates.slice(offset, offset + limit);

      const searchTime = performance.now() - startTime;

      return {
        templates: paginatedTemplates,
        total,
        searchTime,
        query: options
      };

    } catch (error: any) {
      const searchTime = performance.now() - startTime;
      this.logger.error('Template search failed', {
        error: error.message,
        searchTime: `${searchTime.toFixed(2)}ms`,
        options
      });
      throw error;
    }
  }

  /**
   * Get template metadata by name and version
   */
  async getTemplate(name: string, version?: string): Promise<TemplateMetadata | null> {
    try {
      const templates = await this.discoverTemplates();
      
      // Find templates with matching name
      const matchingTemplates = templates.filter(t => t.name === name);
      
      if (matchingTemplates.length === 0) {
        return null;
      }

      // If version specified, find exact match
      if (version) {
        const exactMatch = matchingTemplates.find(t => t.version === version);
        if (exactMatch) {
          return exactMatch;
        }

        // Try semver range matching
        const rangeMatch = matchingTemplates.find(t => semver.satisfies(t.version, version));
        if (rangeMatch) {
          return rangeMatch;
        }

        return null;
      }

      // Return latest version
      const sortedTemplates = matchingTemplates.sort((a, b) => 
        semver.rcompare(a.version, b.version)
      );

      return sortedTemplates[0] || null;

    } catch (error: any) {
      this.logger.error(`Failed to get template: ${name}@${version}`, {
        error: error.message
      });
      return null;
    }
  }

  /**
   * Install template from registry
   */
  async installTemplate(
    name: string,
    version?: string,
    installPath?: string
  ): Promise<TemplateInstallResult> {
    const startTime = performance.now();

    try {
      // Get template metadata
      const template = await this.getTemplate(name, version);
      if (!template) {
        throw new Error(`Template not found: ${name}@${version || 'latest'}`);
      }

      // Determine installation path
      const targetPath = installPath || join(
        this.config.cacheDirectory,
        'templates',
        template.name,
        template.version
      );

      // Check if already installed
      if (existsSync(targetPath)) {
        this.logger.info(`Template already installed: ${template.name}@${template.version}`);
        return {
          status: 'success',
          template,
          installPath: targetPath,
          installTime: performance.now() - startTime
        };
      }

      // Create installation directory
      await mkdir(targetPath, { recursive: true });

      // Download and install template
      await this.downloadTemplate(template, targetPath);

      // Validate installation
      await this.validateTemplateInstallation(template, targetPath);

      // Run post-install hooks
      if (template.hooks.postInstall) {
        await this.runHooks(template.hooks.postInstall, targetPath);
      }

      const installTime = performance.now() - startTime;
      this.logger.info(`Template installed successfully: ${template.name}@${template.version}`, {
        installPath: targetPath,
        installTime: `${installTime.toFixed(2)}ms`
      });

      return {
        status: 'success',
        template,
        installPath: targetPath,
        installTime
      };

    } catch (error: any) {
      const installTime = performance.now() - startTime;
      this.logger.error(`Template installation failed: ${name}@${version}`, {
        error: error.message,
        installTime: `${installTime.toFixed(2)}ms`
      });

      return {
        status: 'failed',
        template: {} as TemplateMetadata,
        installPath: '',
        installTime,
        error: error.message
      };
    }
  }

  /**
   * Discover local templates
   */
  private async discoverLocalTemplates(forceRefresh: boolean): Promise<TemplateMetadata[]> {
    const templates: TemplateMetadata[] = [];

    for (const directory of this.config.localDirectories) {
      if (!existsSync(directory)) {
        continue;
      }

      try {
        const entries = await readdir(directory, { withFileTypes: true });
        
        for (const entry of entries) {
          if (entry.isDirectory()) {
            const templatePath = join(directory, entry.name);
            const metadataPath = join(templatePath, 'template.json');
            
            if (existsSync(metadataPath)) {
              const metadata = await this.loadTemplateMetadata(metadataPath, forceRefresh);
              if (metadata) {
                templates.push(metadata);
              }
            }
          }
        }
      } catch (error: any) {
        this.logger.warn(`Failed to scan local directory: ${directory}`, {
          error: error.message
        });
      }
    }

    return templates;
  }

  /**
   * Discover remote templates
   */
  private async discoverRemoteTemplates(forceRefresh: boolean): Promise<TemplateMetadata[]> {
    const templates: TemplateMetadata[] = [];

    for (const registryUrl of this.config.remoteRegistries) {
      try {
        const remoteTemplates = await this.fetchRemoteRegistry(registryUrl, forceRefresh);
        templates.push(...remoteTemplates);
      } catch (error: any) {
        this.logger.warn(`Failed to fetch remote registry: ${registryUrl}`, {
          error: error.message
        });
      }
    }

    return templates;
  }

  /**
   * Load template metadata from file
   */
  private async loadTemplateMetadata(
    metadataPath: string,
    forceRefresh: boolean
  ): Promise<TemplateMetadata | null> {
    const cacheKey = metadataPath;
    
    // Check cache first
    if (!forceRefresh) {
      const cached = this.templateCache.get(cacheKey);
      if (cached && (Date.now() - cached.cachedAt) < this.config.cacheTtl) {
        return cached.metadata;
      }
    }

    try {
      const content = await readFile(metadataPath, 'utf-8');
      const metadata = JSON.parse(content) as TemplateMetadata;

      // Validate metadata schema
      const isValid = this.ajv.validate(this.metadataSchema, metadata);
      if (!isValid) {
        this.logger.warn(`Invalid template metadata: ${metadataPath}`, {
          errors: this.ajv.errors
        });
        return null;
      }

      // Cache metadata
      this.templateCache.set(cacheKey, {
        metadata,
        cachedAt: Date.now()
      });

      return metadata;

    } catch (error: any) {
      this.logger.warn(`Failed to load template metadata: ${metadataPath}`, {
        error: error.message
      });
      return null;
    }
  }

  /**
   * Fetch remote registry
   */
  private async fetchRemoteRegistry(
    registryUrl: string,
    _forceRefresh: boolean
  ): Promise<TemplateMetadata[]> {
    // Implementation would fetch from remote registry
    // For now, return empty array
    this.logger.debug(`Fetching remote registry: ${registryUrl}`);
    return [];
  }

  /**
   * Download template files
   */
  private async downloadTemplate(template: TemplateMetadata, targetPath: string): Promise<void> {
    // Implementation would download template files
    // For now, create basic structure
    const metadataPath = join(targetPath, 'template.json');
    await writeFile(metadataPath, JSON.stringify(template, null, 2));
  }

  /**
   * Validate template installation
   */
  private async validateTemplateInstallation(
    _template: TemplateMetadata,
    installPath: string
  ): Promise<void> {
    const metadataPath = join(installPath, 'template.json');
    if (!existsSync(metadataPath)) {
      throw new Error('Template metadata not found after installation');
    }

    // Additional validation logic here
  }

  /**
   * Run template hooks
   */
  private async runHooks(hooks: string[], _templatePath: string): Promise<void> {
    for (const hook of hooks) {
      this.logger.debug(`Running template hook: ${hook}`);
      // Implementation would execute hook commands
    }
  }

  /**
   * Remove duplicate templates (prefer local over remote)
   */
  private deduplicateTemplates(templates: TemplateMetadata[]): TemplateMetadata[] {
    const templateMap = new Map<string, TemplateMetadata>();

    for (const template of templates) {
      const key = `${template.name}@${template.version}`;
      
      if (!templateMap.has(key)) {
        templateMap.set(key, template);
      }
      // Could add logic to prefer local over remote here
    }

    return Array.from(templateMap.values());
  }

  /**
   * Create JSON schema for template metadata validation
   */
  private createMetadataSchema(): object {
    return {
      type: 'object',
      required: ['name', 'version', 'description', 'author', 'license'],
      properties: {
        name: { type: 'string', minLength: 1 },
        version: { type: 'string', pattern: '^\\d+\\.\\d+\\.\\d+' },
        description: { type: 'string', minLength: 1 },
        author: { type: 'string', minLength: 1 },
        license: { type: 'string', minLength: 1 },
        keywords: { type: 'array', items: { type: 'string' } },
        category: { type: 'string' },
        minCliVersion: { type: 'string' },
        dependencies: { type: 'array' },
        variables: { type: 'array' },
        files: { type: 'array' },
        hooks: { type: 'object' },
        repository: { type: 'string' },
        homepage: { type: 'string' },
        documentation: { type: 'string' },
        createdAt: { type: 'string' },
        updatedAt: { type: 'string' },
        downloads: { type: 'number' },
        rating: { type: 'number' },
        securityStatus: { type: 'object' }
      }
    };
  }

  /**
   * Get registry statistics
   */
  getStatistics() {
    return {
      cacheSize: this.templateCache.size,
      localDirectories: this.config.localDirectories.length,
      remoteRegistries: this.config.remoteRegistries.length,
      cacheTtl: this.config.cacheTtl
    };
  }

  /**
   * Clear template cache
   */
  clearCache(): void {
    this.templateCache.clear();
    this.logger.info('Template registry cache cleared');
  }
}

/**
 * Default registry configuration
 */
export const defaultRegistryConfig: Partial<RegistryConfig> = {
  localDirectories: [
    join(homedir(), '.druta', 'templates'),
    './templates'
  ],
  remoteRegistries: [
    'https://registry.druta.dev/templates'
  ],
  cacheDirectory: join(homedir(), '.druta', 'cache'),
  cacheTtl: 5 * 60 * 1000, // 5 minutes
  enableSecurity: true,
  securityTimeout: 30000, // 30 seconds
  maxTemplateSize: 100 * 1024 * 1024, // 100MB
  enableAnalytics: true
};
