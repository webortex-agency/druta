/**
 * @fileoverview Main entry point for Druta CLI framework
 * @author Druta CLI Team
 * @version 1.0.0
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { performance } from 'node:perf_hooks';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { Logger } from './core/logger.js';
import { ConfigManager } from './core/config.js';
import { PluginManager } from './core/plugin.js';
import { EventEmitter } from './core/events.js';
import { createTemplateEngine, type TemplateEngine, type TemplateGenerationOptions } from './template/index.js';
import type { CLIOptions, CLIContext } from './types/index.js';

/**
 * Main CLI class that orchestrates all framework components
 * Designed for high performance and extensibility
 */
export class DrutaCLI {
  private readonly program: Command;
  private readonly logger: Logger;
  private readonly config: ConfigManager;
  private readonly plugins: PluginManager;
  private readonly events: EventEmitter;
  private readonly templateEngine: TemplateEngine;
  private readonly context: CLIContext;

  /**
   * Initialize the CLI framework with performance tracking
   * @param options - CLI initialization options
   */
  constructor(options: CLIOptions) {
    this.context = {
      version: options.version,
      name: options.name,
      startTime: options.startTime,
      cwd: process.cwd(),
      env: process.env['NODE_ENV'] || 'production'
    };

    // Initialize core components
    this.logger = new Logger({ level: 'info' });
    this.config = new ConfigManager(this.logger);
    this.events = new EventEmitter();
    this.plugins = new PluginManager(this.events, this.logger);
    this.plugins.addPluginDirectory(join(homedir(), '.druta', 'plugins'));
    this.templateEngine = createTemplateEngine({
      parser: {
        templateRoot: join(process.cwd(), 'templates'),
        cacheSize: 1000,
        enableInheritance: true,
        helpers: {},
        extensions: ['.eta', '.html', '.htm', '.txt', '.md'],
        enableProfiling: true
      },
      registry: {
        localDirectories: [join(process.cwd(), 'templates')],
        remoteRegistries: [],
        cacheDirectory: join(homedir(), '.druta', 'cache'),
        cacheTtl: 300000,
        enableSecurity: true,
        securityTimeout: 30000,
        maxTemplateSize: 104857600,
        enableAnalytics: true
      }
    }, this.logger);
    this.program = new Command();
    this.setupProgram();
    this.registerCommands();
  }

  /**
   * Configure the main program with metadata and global options
   */
  private setupProgram(): void {
    this.program
      .name(this.context.name)
      .version(this.context.version)
      .description('Production-grade CLI framework for Druta SaaS generator')
      .option('-v, --verbose', 'Enable verbose logging')
      .option('-q, --quiet', 'Suppress non-error output')
      .option('--config <path>', 'Path to configuration file')
      .option('--no-plugins', 'Disable plugin loading')
      ['hook']('preAction', async (thisCommand: Command) => {
        await this.preActionHook(thisCommand);
      });
  }

  /**
   * Register all available commands
   */
  private registerCommands(): void {
    // Generate command
    this.program
      .command('generate')
      .alias('g')
      .description('Generate SaaS application from templates')
      ['argument']('<template>', 'Template name or path')
      .option('-o, --output <path>', 'Output directory', './generated')
      .option('-f, --force', 'Overwrite existing files')
      .action(async (template: string, options: any) => {
        await this.handleGenerate(template, options);
      });

    // List templates command
    this.program
      .command('list')
      .alias('ls')
      .description('List available templates')
      .option('--remote', 'Include remote templates')
      .action(async (options) => {
        await this.handleList(options);
      });

    // Plugin management commands
    const pluginCmd = this.program
      .command('plugin')
      .description('Manage CLI plugins');

    pluginCmd
      .command('install <name>')
      .description('Install a plugin')
      .action(async (name) => {
        await this.handlePluginInstall(name);
      });

    pluginCmd
      .command('list')
      .description('List installed plugins')
      .action(async () => {
        await this.handlePluginList();
      });

    // Config management
    this.program
      .command('config')
      .description('Manage CLI configuration')
      .option('--get <key>', 'Get configuration value')
      .option('--set <key=value>', 'Set configuration value')
      .option('--list', 'List all configuration')
      .action(async (options) => {
        await this.handleConfig(options);
      });
  }

  /**
   * Pre-action hook for global setup
   */
  private async preActionHook(command: Command): Promise<void> {
    const opts = command.opts();
    
    // Configure logging level
    if (opts['verbose']) {
      this.logger.setLevel('debug');
    } else if (opts['quiet']) {
      this.logger.setLevel('error');
    }

    // Load configuration
    if (opts['config']) {
      await this.config.loadFromFile(opts['config']);
    } else {
      await this.config.loadDefaults();
    }

    // Load plugins unless disabled
    if (opts['plugins'] !== false) {
      await this.plugins.loadAll();
    }

    // Emit pre-command event
    await this.events.emit('command:before', { command: command.name(), options: opts });
  }

  /**
   * Handle generate command with enterprise-grade template engine
   */
  private async handleGenerate(templateName: string, options: any): Promise<void> {
    try {
      this.logger.info(`Generating SaaS application from template: ${templateName}`);
      
      // Load plugins first
      await this.plugins.loadAll();
      
      // Emit generation start event
      await this.events.emit('generate:start', {
        template: templateName,
        options
      });
      
      // Prepare template generation options
      const generationOptions: TemplateGenerationOptions = {
        template: templateName,
        outputDir: options.output || './generated-app',
        variables: options.variables || {},
        environment: options.environment || 'development',
        force: options.force || false,
        dryRun: options.dryRun || false,
        verbose: options.verbose || false
      };
      
      // Generate using enterprise template engine
      const result = await this.templateEngine.generateFromTemplate(generationOptions);
      
      if (result.status === 'success') {
        this.logger.success('Generation completed successfully!');
        this.logger.info(`Generated ${result.processing.totalFiles} files in ${result.generationTime.toFixed(2)}ms`);
        this.logger.info(`Output directory: ${result.outputDir}`);
        
        // Log performance metrics if verbose
        if (options.verbose) {
          const metrics = result.metrics;
          this.logger.info('Performance Metrics:', {
            templateResolutionTime: `${metrics.templateResolutionTime.toFixed(2)}ms`,
            variableResolutionTime: `${metrics.variableResolutionTime.toFixed(2)}ms`,
            fileProcessingTime: `${metrics.fileProcessingTime.toFixed(2)}ms`,
            throughput: `${result.processing.metrics.throughput.toFixed(2)} files/sec`,
            memoryUsage: `${metrics.memoryUsage.toFixed(2)}MB`
          });
        }
      } else {
        this.logger.error(`Generation failed: ${result.error}`);
        if (result.processing.errorCount > 0) {
          this.logger.warn(`${result.processing.errorCount} files failed to process`);
        }
      }
      
      // Emit generation complete event
      await this.events.emit('generate:complete', {
        template: templateName,
        result,
        options
      });
      
    } catch (error: any) {
      this.logger.error(`Generation failed: ${error.message}`);
      await this.events.emit('generate:error', {
        template: templateName,
        error
      });
      throw error;
    }
  }

  /**
   * Handle list command with enterprise template registry
   */
  private async handleList(options: any): Promise<void> {
    try {
      this.logger.info('Available templates:');
      
      // Load plugins first
      await this.plugins.loadAll();
      
      // Emit list event
      await this.events.emit('list:start', { options });
      
      // Get templates from enterprise registry
      const templates = await this.templateEngine.listTemplates({
        category: options.category,
        author: options.author,
        includeRemote: options.remote || false
      });
      
      if (templates.length === 0) {
        this.logger.info('No templates found. Add templates to get started.');
      } else {
        this.logger.info(`Found ${templates.length} template(s):`);
        
        for (const template of templates) {
          this.logger.info(`  ${template.name}@${template.version} - ${template.description}`);
          if (options.verbose) {
            this.logger.info(`    Author: ${template.author}`);
            this.logger.info(`    Category: ${template.category}`);
            this.logger.info(`    License: ${template.license}`);
            if (template.keywords.length > 0) {
              this.logger.info(`    Keywords: ${template.keywords.join(', ')}`);
            }
            if (template.downloads) {
              this.logger.info(`    Downloads: ${template.downloads}`);
            }
            if (template.rating) {
              this.logger.info(`    Rating: ${template.rating}/5`);
            }
          }
        }
      }
      
      await this.events.emit('list:complete', { templates, options });
    } catch (error: any) {
      this.logger.error(`Failed to list templates: ${error.message}`);
      throw error;
    }
  }

  /**
   * Handle plugin install command
   */
  private async handlePluginInstall(name: string): Promise<void> {
    try {
      this.logger.info(`Installing plugin: ${chalk.cyan(name)}`);
      await this.plugins.install(name);
      this.logger.success(`Plugin ${name} installed successfully!`);
    } catch (error) {
      this.logger.error(`Failed to install plugin ${name}:`, error);
      throw error;
    }
  }

  /**
   * Handle plugin list command
   */
  private async handlePluginList(): Promise<void> {
    try {
      const plugins = await this.plugins.list();
      if (plugins.length === 0) {
        this.logger.info('No plugins installed');
        return;
      }

      this.logger.info('Installed plugins:');
      plugins.forEach((plugin: any) => {
        this.logger.info(`  ${chalk.cyan(plugin.name)} v${plugin.version}`);
      });
    } catch (error) {
      this.logger.error('Failed to list plugins:', error);
      throw error;
    }
  }

  /**
   * Handle config command
   */
  private async handleConfig(options: any): Promise<void> {
    try {
      if (options.get) {
        const value = this.config.get(options.get);
        this.logger.info(`${options.get}: ${value}`);
      } else if (options.set) {
        const [key, value] = options.set.split('=');
        this.config.set(key, value);
        await this.config.save();
        this.logger.success(`Configuration updated: ${key} = ${value}`);
      } else if (options.list) {
        const config = this.config.getAll();
        this.logger.info('Current configuration:');
        Object.entries(config).forEach(([key, value]) => {
          this.logger.info(`  ${chalk.cyan(key)}: ${value}`);
        });
      }
    } catch (error) {
      this.logger.error('Configuration operation failed:', error);
      throw error;
    }
  }

  /**
   * Run the CLI with provided arguments
   * @param argv - Command line arguments
   */
  public async run(argv: string[]): Promise<void> {
    try {
      // Performance tracking
      const parseStart = performance.now();
      
      await this.program.parseAsync(argv);
      
      const totalTime = performance.now() - this.context.startTime;
      const parseTime = performance.now() - parseStart;
      
      this.logger.debug(`CLI startup: ${totalTime.toFixed(2)}ms, Parse: ${parseTime.toFixed(2)}ms`);
      
      // Ensure we stay under 200ms startup time
      if (totalTime > 200) {
        this.logger.warn(`Startup time exceeded target: ${totalTime.toFixed(2)}ms`);
      }
      
    } catch (error) {
      this.logger.error('CLI execution failed:', error);
      process.exit(1);
    }
  }

  /**
   * Get CLI context information
   */
  public getContext(): CLIContext {
    return { ...this.context };
  }

  /**
   * Get logger instance
   */
  public getLogger(): Logger {
    return this.logger;
  }

  /**
   * Get configuration manager
   */
  public getConfig(): ConfigManager {
    return this.config;
  }

  /**
   * Get plugin manager
   */
  public getPlugins(): PluginManager {
    return this.plugins;
  }

  /**
   * Get event emitter
   */
  public getEvents(): EventEmitter {
    return this.events;
  }
}
