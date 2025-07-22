/**
 * @fileoverview High-performance event system with hooks and middleware support
 * @author Druta CLI Team
 */

import type { EventListener } from '../types/index.js';

/**
 * Event emitter with middleware and hook support
 * Optimized for CLI plugin architecture
 */
export class EventEmitter {
  private readonly listeners: Map<string, EventListener[]> = new Map();
  private readonly onceListeners: Map<string, EventListener[]> = new Map();
  private readonly middleware: Map<string, EventListener[]> = new Map();
  private readonly maxListeners: number = 100;

  /**
   * Add event listener
   * @param event - Event name
   * @param listener - Event listener function
   */
  public on(event: string, listener: EventListener): void {
    this.addListener(this.listeners, event, listener);
  }

  /**
   * Add one-time event listener
   * @param event - Event name
   * @param listener - Event listener function
   */
  public once(event: string, listener: EventListener): void {
    this.addListener(this.onceListeners, event, listener);
  }

  /**
   * Add middleware for event processing
   * @param event - Event name
   * @param middleware - Middleware function
   */
  public use(event: string, middleware: EventListener): void {
    this.addListener(this.middleware, event, middleware);
  }

  /**
   * Remove event listener
   * @param event - Event name
   * @param listener - Event listener function
   */
  public off(event: string, listener: EventListener): void {
    this.removeListener(this.listeners, event, listener);
    this.removeListener(this.onceListeners, event, listener);
    this.removeListener(this.middleware, event, listener);
  }

  /**
   * Remove all listeners for an event
   * @param event - Event name
   */
  public removeAllListeners(event?: string): void {
    if (event) {
      this.listeners.delete(event);
      this.onceListeners.delete(event);
      this.middleware.delete(event);
    } else {
      this.listeners.clear();
      this.onceListeners.clear();
      this.middleware.clear();
    }
  }

  /**
   * Emit event to all listeners
   * @param event - Event name
   * @param data - Event data
   */
  public async emit(event: string, data?: any): Promise<void> {
    // Process middleware first
    const middlewareList = this.middleware.get(event) || [];
    for (const middleware of middlewareList) {
      try {
        await middleware(data);
      } catch (error) {
        console.error(`Middleware error for event ${event}:`, error);
      }
    }

    // Process regular listeners
    const regularListeners = this.listeners.get(event) || [];
    const promises = regularListeners.map(async (listener) => {
      try {
        await listener(data);
      } catch (error) {
        console.error(`Listener error for event ${event}:`, error);
      }
    });

    // Process once listeners
    const onceListeners = this.onceListeners.get(event) || [];
    if (onceListeners.length > 0) {
      const oncePromises = onceListeners.map(async (listener) => {
        try {
          await listener(data);
        } catch (error) {
          console.error(`Once listener error for event ${event}:`, error);
        }
      });
      promises.push(...oncePromises);
      
      // Clear once listeners after execution
      this.onceListeners.delete(event);
    }

    // Wait for all listeners to complete
    await Promise.all(promises);
  }

  /**
   * Emit event synchronously (for performance-critical paths)
   * @param event - Event name
   * @param data - Event data
   */
  public emitSync(event: string, data?: any): void {
    // Process middleware first
    const middlewareList = this.middleware.get(event) || [];
    for (const middleware of middlewareList) {
      try {
        const result = middleware(data);
        // Handle promises in sync context
        if (result && typeof result.then === 'function') {
          result.catch((error: any) => {
            console.error(`Middleware error for event ${event}:`, error);
          });
        }
      } catch (error) {
        console.error(`Middleware error for event ${event}:`, error);
      }
    }

    // Process regular listeners
    const regularListeners = this.listeners.get(event) || [];
    for (const listener of regularListeners) {
      try {
        const result = listener(data);
        if (result && typeof result.then === 'function') {
          result.catch((error: any) => {
            console.error(`Listener error for event ${event}:`, error);
          });
        }
      } catch (error) {
        console.error(`Listener error for event ${event}:`, error);
      }
    }

    // Process once listeners
    const onceListeners = this.onceListeners.get(event) || [];
    if (onceListeners.length > 0) {
      for (const listener of onceListeners) {
        try {
          const result = listener(data);
          if (result && typeof result.then === 'function') {
            result.catch((error: any) => {
              console.error(`Once listener error for event ${event}:`, error);
            });
          }
        } catch (error) {
          console.error(`Once listener error for event ${event}:`, error);
        }
      }
      
      // Clear once listeners after execution
      this.onceListeners.delete(event);
    }
  }

  /**
   * Get listener count for an event
   * @param event - Event name
   * @returns Number of listeners
   */
  public listenerCount(event: string): number {
    const regular = this.listeners.get(event)?.length || 0;
    const once = this.onceListeners.get(event)?.length || 0;
    const middleware = this.middleware.get(event)?.length || 0;
    return regular + once + middleware;
  }

  /**
   * Get all event names
   * @returns Array of event names
   */
  public eventNames(): string[] {
    const names = new Set<string>();
    
    for (const event of this.listeners.keys()) {
      names.add(event);
    }
    
    for (const event of this.onceListeners.keys()) {
      names.add(event);
    }
    
    for (const event of this.middleware.keys()) {
      names.add(event);
    }
    
    return Array.from(names);
  }

  /**
   * Create a namespaced event emitter
   * @param namespace - Namespace prefix
   * @returns Namespaced event emitter
   */
  public namespace(namespace: string): NamespacedEventEmitter {
    return new NamespacedEventEmitter(this, namespace);
  }

  /**
   * Add listener to a map
   * @param map - Listener map
   * @param event - Event name
   * @param listener - Event listener
   */
  private addListener(map: Map<string, EventListener[]>, event: string, listener: EventListener): void {
    const listeners = map.get(event) || [];
    
    // Check max listeners limit
    if (listeners.length >= this.maxListeners) {
      console.warn(`Maximum listeners (${this.maxListeners}) exceeded for event: ${event}`);
    }
    
    listeners.push(listener);
    map.set(event, listeners);
  }

  /**
   * Remove listener from a map
   * @param map - Listener map
   * @param event - Event name
   * @param listener - Event listener
   */
  private removeListener(map: Map<string, EventListener[]>, event: string, listener: EventListener): void {
    const listeners = map.get(event);
    if (!listeners) return;
    
    const index = listeners.indexOf(listener);
    if (index !== -1) {
      listeners.splice(index, 1);
      
      if (listeners.length === 0) {
        map.delete(event);
      } else {
        map.set(event, listeners);
      }
    }
  }
}

/**
 * Namespaced event emitter for plugin isolation
 */
class NamespacedEventEmitter {
  private readonly emitter: EventEmitter;
  private readonly namespace: string;

  constructor(emitter: EventEmitter, namespace: string) {
    this.emitter = emitter;
    this.namespace = namespace;
  }

  /**
   * Add namespaced event listener
   * @param event - Event name
   * @param listener - Event listener
   */
  public on(event: string, listener: EventListener): void {
    this.emitter.on(this.getNamespacedEvent(event), listener);
  }

  /**
   * Add namespaced one-time event listener
   * @param event - Event name
   * @param listener - Event listener
   */
  public once(event: string, listener: EventListener): void {
    this.emitter.once(this.getNamespacedEvent(event), listener);
  }

  /**
   * Add namespaced middleware
   * @param event - Event name
   * @param middleware - Middleware function
   */
  public use(event: string, middleware: EventListener): void {
    this.emitter.use(this.getNamespacedEvent(event), middleware);
  }

  /**
   * Remove namespaced event listener
   * @param event - Event name
   * @param listener - Event listener
   */
  public off(event: string, listener: EventListener): void {
    this.emitter.off(this.getNamespacedEvent(event), listener);
  }

  /**
   * Emit namespaced event
   * @param event - Event name
   * @param data - Event data
   */
  public async emit(event: string, data?: any): Promise<void> {
    await this.emitter.emit(this.getNamespacedEvent(event), data);
  }

  /**
   * Emit namespaced event synchronously
   * @param event - Event name
   * @param data - Event data
   */
  public emitSync(event: string, data?: any): void {
    this.emitter.emitSync(this.getNamespacedEvent(event), data);
  }

  /**
   * Get namespaced event name
   * @param event - Original event name
   * @returns Namespaced event name
   */
  private getNamespacedEvent(event: string): string {
    return `${this.namespace}:${event}`;
  }
}
