/**
 * @fileoverview Plugin management system with hot-swappable modules
 * @author Druta CLI Team
 */

import { readdir, stat, readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { performance } from 'node:perf_hooks';
import type { Plugin, PluginMetadata, PluginContext } from '../types/index.js';
import type { EventEmitter } from './events.js';
import type { Logger } from './logger.js';

/**
 * Plugin manager with hot-swappable module support
 * Handles plugin lifecycle, dependencies, and isolation
 */
export class PluginManager {
  private readonly plugins: Map<string, LoadedPlugin> = new Map();
  private readonly events: EventEmitter;
  private readonly logger: Logger;
  private readonly pluginDirectories: string[] = [];
  private isInitialized = false;

  /**
   * Initialize plugin manager
   * @param events - Event emitter instance
   * @param logger - Logger instance
   */
  constructor(events: EventEmitter, logger: Logger) {
    this.events = events;
    this.logger = logger;
  }

  /**
   * Add plugin directory to search path
   * @param directory - Plugin directory path
   */
  public addPluginDirectory(directory: string): void {
    if (!this.pluginDirectories.includes(directory)) {
      this.pluginDirectories.push(directory);
      this.logger.debug(`Added plugin directory: ${directory}`);
    }
  }

  /**
   * Load all plugins from registered directories
   */
  public async loadAll(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    const startTime = performance.now();
    this.logger.debug('Loading plugins...');

    try {
      // Discover plugins
      const pluginPaths = await this.discoverPlugins();
      
      // Load plugins in dependency order
      const loadOrder = await this.resolveDependencyOrder(pluginPaths);
      
      for (const pluginPath of loadOrder) {
        try {
          await this.loadPlugin(pluginPath);
        } catch (error: any) {
          this.logger.error(`Failed to load plugin from ${pluginPath}:`, error.message);
        }
      }

      this.isInitialized = true;
      this.logger.perf('Plugin loading', startTime);
      this.logger.info(`Loaded ${this.plugins.size} plugins`);

      // Emit plugins loaded event
      await this.events.emit('plugins:loaded', {
        count: this.plugins.size,
        plugins: Array.from(this.plugins.keys())
      });

    } catch (error: any) {
      this.logger.error('Failed to load plugins:', error.message);
      throw error;
    }
  }

  /**
   * Install a plugin from npm or local path
   * @param nameOrPath - Plugin name or local path
   */
  public async install(nameOrPath: string): Promise<void> {
    try {
      this.logger.info(`Installing plugin: ${nameOrPath}`);
      
      // TODO: Implement plugin installation logic
      // This would typically involve:
      // 1. Resolving plugin from npm registry or local path
      // 2. Downloading and extracting plugin
      // 3. Validating plugin structure and metadata
      // 4. Installing to plugin directory
      // 5. Loading the plugin
      
      await this.events.emit('plugin:install:start', { name: nameOrPath });
      
      // Placeholder implementation
      throw new Error('Plugin installation not yet implemented');
      
    } catch (error: any) {
      await this.events.emit('plugin:install:error', { name: nameOrPath, error });
      throw error;
    }
  }

  /**
   * Uninstall a plugin
   * @param name - Plugin name
   */
  public async uninstall(name: string): Promise<void> {
    const plugin = this.plugins.get(name);
    if (!plugin) {
      throw new Error(`Plugin not found: ${name}`);
    }

    try {
      this.logger.info(`Uninstalling plugin: ${name}`);
      
      // Cleanup plugin
      if (plugin.instance.cleanup) {
        await plugin.instance.cleanup();
      }
      
      // Remove from loaded plugins
      this.plugins.delete(name);
      
      await this.events.emit('plugin:uninstall', { name });
      this.logger.success(`Plugin uninstalled: ${name}`);
      
    } catch (error: any) {
      this.logger.error(`Failed to uninstall plugin ${name}:`, error.message);
      throw error;
    }
  }

  /**
   * Get plugin by name
   * @param name - Plugin name
   * @returns Plugin instance or undefined
   */
  public get(name: string): Plugin | undefined {
    return this.plugins.get(name)?.instance;
  }

  /**
   * Check if plugin is loaded
   * @param name - Plugin name
   * @returns True if plugin is loaded
   */
  public has(name: string): boolean {
    return this.plugins.has(name);
  }

  /**
   * List all loaded plugins
   * @returns Array of plugin metadata
   */
  public async list(): Promise<PluginMetadata[]> {
    return Array.from(this.plugins.values()).map(plugin => plugin.instance.metadata);
  }

  /**
   * Reload a plugin (hot-swapping)
   * @param name - Plugin name
   */
  public async reload(name: string): Promise<void> {
    const loadedPlugin = this.plugins.get(name);
    if (!loadedPlugin) {
      throw new Error(`Plugin not found: ${name}`);
    }

    try {
      this.logger.info(`Reloading plugin: ${name}`);
      
      // Cleanup existing plugin
      if (loadedPlugin.instance.cleanup) {
        await loadedPlugin.instance.cleanup();
      }
      
      // Note: ESM modules don't have a cache API like CommonJS
      // Module reloading in ESM requires different approach
      
      // Reload plugin
      await this.loadPlugin(loadedPlugin.path);
      
      await this.events.emit('plugin:reload', { name });
      this.logger.success(`Plugin reloaded: ${name}`);
      
    } catch (error: any) {
      this.logger.error(`Failed to reload plugin ${name}:`, error.message);
      throw error;
    }
  }

  /**
   * Discover plugins in registered directories
   * @returns Array of plugin paths
   */
  private async discoverPlugins(): Promise<string[]> {
    const pluginPaths: string[] = [];
    
    for (const directory of this.pluginDirectories) {
      try {
        const entries = await readdir(directory);
        
        for (const entry of entries) {
          const entryPath = join(directory, entry);
          const stats = await stat(entryPath);
          
          if (stats.isDirectory()) {
            // Look for package.json or index.js
            const packagePath = join(entryPath, 'package.json');
            const indexPath = join(entryPath, 'index.js');
            
            try {
              await stat(packagePath);
              pluginPaths.push(entryPath);
            } catch {
              try {
                await stat(indexPath);
                pluginPaths.push(entryPath);
              } catch {
                // Not a valid plugin directory
              }
            }
          }
        }
      } catch (error: any) {
        this.logger.debug(`Failed to read plugin directory ${directory}:`, error.message);
      }
    }
    
    return pluginPaths;
  }

  /**
   * Resolve plugin dependency loading order
   * @param pluginPaths - Array of plugin paths
   * @returns Ordered array of plugin paths
   */
  private async resolveDependencyOrder(pluginPaths: string[]): Promise<string[]> {
    const pluginMetadata = new Map<string, { path: string; metadata: PluginMetadata }>();
    
    // Load metadata for all plugins
    for (const path of pluginPaths) {
      try {
        const metadata = await this.loadPluginMetadata(path);
        pluginMetadata.set(metadata.name, { path, metadata });
      } catch (error: any) {
        this.logger.warn(`Failed to load metadata for plugin at ${path}:`, error.message);
      }
    }
    
    // Simple topological sort for dependency resolution
    const visited = new Set<string>();
    const visiting = new Set<string>();
    const result: string[] = [];
    
    const visit = (pluginName: string): void => {
      if (visited.has(pluginName)) return;
      if (visiting.has(pluginName)) {
        throw new Error(`Circular dependency detected: ${pluginName}`);
      }
      
      const plugin = pluginMetadata.get(pluginName);
      if (!plugin) return;
      
      visiting.add(pluginName);
      
      // Visit dependencies first
      if (plugin.metadata.dependencies) {
        for (const dep of Object.keys(plugin.metadata.dependencies)) {
          visit(dep);
        }
      }
      
      visiting.delete(pluginName);
      visited.add(pluginName);
      result.push(plugin.path);
    };
    
    // Visit all plugins
    for (const pluginName of pluginMetadata.keys()) {
      visit(pluginName);
    }
    
    return result;
  }

  /**
   * Load plugin metadata from directory
   * @param pluginPath - Plugin directory path
   * @returns Plugin metadata
   */
  private async loadPluginMetadata(pluginPath: string): Promise<PluginMetadata> {
    const packagePath = join(pluginPath, 'package.json');
    
    try {
      const packageContent = await readFile(packagePath, 'utf8');
      const packageJson = JSON.parse(packageContent);
      
      return {
        name: packageJson.name,
        version: packageJson.version,
        description: packageJson.description,
        author: packageJson.author,
        homepage: packageJson.homepage,
        keywords: packageJson.keywords,
        dependencies: packageJson.dependencies
      };
    } catch {
      // Fallback to basic metadata
      return {
        name: dirname(pluginPath),
        version: '1.0.0'
      };
    }
  }

  /**
   * Load a single plugin
   * @param pluginPath - Plugin directory path
   */
  private async loadPlugin(pluginPath: string): Promise<void> {
    const startTime = performance.now();
    
    try {
      // Load plugin metadata
      const metadata = await this.loadPluginMetadata(pluginPath);
      
      // Import plugin module
      const indexPath = join(pluginPath, 'index.js');
      const moduleUrl = pathToFileURL(indexPath).href;
      const module = await import(moduleUrl);
      
      // Get plugin class or factory
      const PluginClass = module.default || module.Plugin;
      if (!PluginClass) {
        throw new Error('Plugin must export a default class or Plugin class');
      }
      
      // Create plugin instance
      const instance: Plugin = new PluginClass();
      instance.metadata = metadata;
      
      // Create plugin context
      const context: PluginContext = {
        cli: {
          version: '1.0.0', // TODO: Get from actual CLI context
          name: 'druta-cli',
          startTime: Date.now(),
          cwd: process.cwd(),
          env: process.env['NODE_ENV'] || 'production'
        },
        logger: this.logger.child({ plugin: metadata.name }),
        config: null, // TODO: Pass actual config manager
        events: this.events.namespace(metadata.name)
      };
      
      // Initialize plugin
      await instance.initialize(context);
      
      // Store loaded plugin
      this.plugins.set(metadata.name, {
        instance,
        path: pluginPath,
        loadTime: performance.now() - startTime
      });
      
      this.logger.debug(`Loaded plugin: ${metadata.name} (${(performance.now() - startTime).toFixed(2)}ms)`);
      
      await this.events.emit('plugin:loaded', { name: metadata.name, metadata });
      
    } catch (error: any) {
      this.logger.error(`Failed to load plugin from ${pluginPath}:`, error.message);
      throw error;
    }
  }
}

/**
 * Internal loaded plugin representation
 */
interface LoadedPlugin {
  /** Plugin instance */
  instance: Plugin;
  /** Plugin file path */
  path: string;
  /** Load time in milliseconds */
  loadTime: number;
}
