/**
 * @fileoverview Abstract template engine with streaming and conditional rendering
 * @author Druta CLI Team
 */

import { createReadStream, createWriteStream } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { pipeline } from 'node:stream/promises';
import { Transform } from 'node:stream';
import type { 
  TemplateEngine, 
  ValidationResult, 
  StreamOptions,
  TemplateMetadata,
  TemplateVariable 
} from '../types/index.js';

/**
 * Abstract base class for template engines
 * Provides common functionality for variable substitution and streaming
 */
export abstract class AbstractTemplateEngine implements TemplateEngine {
  public abstract readonly name: string;
  public abstract readonly extensions: string[];

  /**
   * Process template string with variables
   * @param template - Template content
   * @param variables - Variable substitution map
   * @returns Processed template
   */
  public abstract process(template: string, variables: Record<string, any>): Promise<string>;

  /**
   * Validate template syntax
   * @param template - Template content
   * @returns Validation result
   */
  public abstract validate(template: string): Promise<ValidationResult>;

  /**
   * Process template file
   * @param filePath - Template file path
   * @param variables - Variable substitution map
   * @returns Processed template content
   */
  public async processFile(filePath: string, variables: Record<string, any>): Promise<string> {
    const content = await readFile(filePath, 'utf8');
    return this.process(content, variables);
  }

  /**
   * Process template file with streaming for large files
   * @param inputPath - Input template file path
   * @param outputPath - Output file path
   * @param variables - Variable substitution map
   * @param options - Streaming options
   */
  public async processFileStream(
    inputPath: string, 
    outputPath: string, 
    variables: Record<string, any>,
    options: StreamOptions = {}
  ): Promise<void> {
    const { encoding = 'utf8' } = options;
    
    const readStream = createReadStream(inputPath, { encoding });
    const writeStream = createWriteStream(outputPath, { encoding });
    
    const transformStream = new Transform({
      objectMode: false,
      transform: async (chunk: Buffer, _encoding, callback) => {
        try {
          const content = chunk.toString();
          const processed = await this.process(content, variables);
          callback(null, processed);
        } catch (error) {
          callback(error as Error);
        }
      }
    });
    
    await pipeline(readStream, transformStream, writeStream);
  }

  /**
   * Extract variables from template
   * @param template - Template content
   * @returns Array of variable names
   */
  public abstract extractVariables(template: string): string[];

  /**
   * Get template metadata
   * @param template - Template content
   * @returns Template metadata
   */
  public abstract getMetadata(template: string): Promise<TemplateMetadata>;

  /**
   * Check if template engine supports file extension
   * @param extension - File extension
   * @returns True if supported
   */
  public supportsExtension(extension: string): boolean {
    return this.extensions.includes(extension.toLowerCase());
  }

  /**
   * Escape special characters for safe output
   * @param value - Value to escape
   * @returns Escaped value
   */
  protected escapeValue(value: any): string {
    if (typeof value !== 'string') {
      return String(value);
    }
    
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;');
  }

  /**
   * Validate variable types against schema
   * @param variables - Variables to validate
   * @param schema - Variable schema
   * @returns Validation errors
   */
  protected validateVariables(
    variables: Record<string, any>, 
    schema: TemplateVariable[]
  ): string[] {
    const errors: string[] = [];
    
    for (const varDef of schema) {
      const value = variables[varDef.name];
      
      // Check required variables
      if (varDef.required && (value === undefined || value === null)) {
        errors.push(`Required variable missing: ${varDef.name}`);
        continue;
      }
      
      // Skip validation if variable is not provided and not required
      if (value === undefined || value === null) {
        continue;
      }
      
      // Type validation
      if (!this.validateVariableType(value, varDef.type)) {
        errors.push(`Invalid type for variable ${varDef.name}: expected ${varDef.type}, got ${typeof value}`);
      }
      
      // Pattern validation
      if (varDef.pattern && typeof value === 'string') {
        const regex = new RegExp(varDef.pattern);
        if (!regex.test(value)) {
          errors.push(`Variable ${varDef.name} does not match pattern: ${varDef.pattern}`);
        }
      }
      
      // Enum validation
      if (varDef.enum && !varDef.enum.includes(value)) {
        errors.push(`Variable ${varDef.name} must be one of: ${varDef.enum.join(', ')}`);
      }
    }
    
    return errors;
  }

  /**
   * Validate variable type
   * @param value - Variable value
   * @param expectedType - Expected type
   * @returns True if type is valid
   */
  private validateVariableType(value: any, expectedType: string): boolean {
    switch (expectedType) {
      case 'string':
        return typeof value === 'string';
      case 'number':
        return typeof value === 'number' && !isNaN(value);
      case 'boolean':
        return typeof value === 'boolean';
      case 'array':
        return Array.isArray(value);
      case 'object':
        return typeof value === 'object' && value !== null && !Array.isArray(value);
      default:
        return true;
    }
  }
}

/**
 * Simple template engine with mustache-like syntax
 * Supports variable substitution and basic conditionals
 */
export class SimpleTemplateEngine extends AbstractTemplateEngine {
  public readonly name = 'simple';
  public readonly extensions = ['.tpl', '.template', '.txt'];

  /**
   * Process template with simple variable substitution
   * @param template - Template content
   * @param variables - Variable substitution map
   * @returns Processed template
   */
  public async process(template: string, variables: Record<string, any>): Promise<string> {
    let result = template;
    
    // Variable substitution: {{variable}}
    result = result.replace(/\{\{([^}]+)\}\}/g, (match, varName) => {
      const trimmedName = varName.trim();
      const value = this.getNestedValue(variables, trimmedName);
      return value !== undefined ? String(value) : match;
    });
    
    // Conditional blocks: {{#if condition}}...{{/if}}
    result = result.replace(/\{\{#if\s+([^}]+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (_match, condition, content) => {
      const conditionValue = this.evaluateCondition(condition.trim(), variables);
      return conditionValue ? content : '';
    });
    
    // Conditional blocks with else: {{#if condition}}...{{else}}...{{/if}}
    result = result.replace(/\{\{#if\s+([^}]+)\}\}([\s\S]*?)\{\{else\}\}([\s\S]*?)\{\{\/if\}\}/g, 
      (_match, condition, ifContent, elseContent) => {
        const conditionValue = this.evaluateCondition(condition.trim(), variables);
        return conditionValue ? ifContent : elseContent;
      }
    );
    
    // Loop blocks: {{#each array}}...{{/each}}
    result = result.replace(/\{\{#each\s+([^}]+)\}\}([\s\S]*?)\{\{\/each\}\}/g, (_match, arrayName, content) => {
      const array = this.getNestedValue(variables, arrayName.trim());
      if (!Array.isArray(array)) return '';
      
      return array.map((item, index) => {
        let itemContent = content;
        // Replace {{this}} with current item
        itemContent = itemContent.replace(/\{\{this\}\}/g, String(item));
        // Replace {{@index}} with current index
        itemContent = itemContent.replace(/\{\{@index\}\}/g, String(index));
        // Replace {{@key}} with current key (for objects)
        if (typeof item === 'object' && item !== null) {
          for (const [key, value] of Object.entries(item)) {
            itemContent = itemContent.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), String(value));
          }
        }
        return itemContent;
      }).join('');
    });
    
    return result;
  }

  /**
   * Validate template syntax
   * @param template - Template content
   * @returns Validation result
   */
  public async validate(template: string): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    // Check for unmatched braces
    const openBraces = (template.match(/\{\{/g) || []).length;
    const closeBraces = (template.match(/\}\}/g) || []).length;
    
    if (openBraces !== closeBraces) {
      errors.push('Unmatched template braces');
    }
    
    // Check for unmatched conditional blocks
    const ifBlocks = (template.match(/\{\{#if/g) || []).length;
    const endIfBlocks = (template.match(/\{\{\/if\}\}/g) || []).length;
    
    if (ifBlocks !== endIfBlocks) {
      errors.push('Unmatched if/endif blocks');
    }
    
    // Check for unmatched loop blocks
    const eachBlocks = (template.match(/\{\{#each/g) || []).length;
    const endEachBlocks = (template.match(/\{\{\/each\}\}/g) || []).length;
    
    if (eachBlocks !== endEachBlocks) {
      errors.push('Unmatched each/endeach blocks');
    }
    
    // Check for undefined variables (warning only)
    const variables = this.extractVariables(template);
    for (const variable of variables) {
      if (variable.includes('.')) {
        warnings.push(`Nested variable access: ${variable}`);
      }
    }
    
    return {
      valid: errors.length === 0,
      errors: errors.map(msg => ({ message: msg })),
      warnings: warnings.map(msg => ({ message: msg }))
    };
  }

  /**
   * Extract variables from template
   * @param template - Template content
   * @returns Array of variable names
   */
  public extractVariables(template: string): string[] {
    const variables = new Set<string>();
    
    // Extract simple variables
    const simpleVars = template.match(/\{\{([^#\/][^}]*)\}\}/g);
    if (simpleVars) {
      for (const match of simpleVars) {
        const varName = match.replace(/\{\{|\}\}/g, '').trim();
        if (!varName.startsWith('@') && varName !== 'this' && varName !== 'else') {
          variables.add(varName);
        }
      }
    }
    
    // Extract variables from conditionals
    const conditionals = template.match(/\{\{#if\s+([^}]+)\}\}/g);
    if (conditionals) {
      for (const match of conditionals) {
        const condition = match.replace(/\{\{#if\s+|\}\}/g, '').trim();
        variables.add(condition);
      }
    }
    
    // Extract variables from loops
    const loops = template.match(/\{\{#each\s+([^}]+)\}\}/g);
    if (loops) {
      for (const match of loops) {
        const arrayName = match.replace(/\{\{#each\s+|\}\}/g, '').trim();
        variables.add(arrayName);
      }
    }
    
    return Array.from(variables);
  }

  /**
   * Get template metadata
   * @param template - Template content
   * @returns Template metadata
   */
  public async getMetadata(template: string): Promise<TemplateMetadata> {
    const variables = this.extractVariables(template);
    
    return {
      name: 'simple-template',
      version: '1.0.0',
      variables: variables.map(name => ({
        name,
        type: 'string',
        required: true
      }))
    };
  }

  /**
   * Get nested value from object using dot notation
   * @param obj - Object to search
   * @param path - Dot-separated path
   * @returns Value or undefined
   */
  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => {
      return current && typeof current === 'object' ? current[key] : undefined;
    }, obj);
  }

  /**
   * Evaluate condition for if blocks
   * @param condition - Condition string
   * @param variables - Variable context
   * @returns True if condition is truthy
   */
  private evaluateCondition(condition: string, variables: Record<string, any>): boolean {
    const value = this.getNestedValue(variables, condition);
    
    // Truthy evaluation
    if (Array.isArray(value)) {
      return value.length > 0;
    }
    
    return Boolean(value);
  }
}
