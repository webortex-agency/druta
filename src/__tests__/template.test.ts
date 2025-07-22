/**
 * @fileoverview Tests for Template Engine
 * @author Druta CLI Team
 */

import { SimpleTemplateEngine } from '../engines/template.js';

describe('SimpleTemplateEngine', () => {
  let engine: SimpleTemplateEngine;

  beforeEach(() => {
    engine = new SimpleTemplateEngine();
  });

  describe('basic functionality', () => {
    it('should have correct name and extensions', () => {
      expect(engine.name).toBe('simple');
      expect(engine.extensions).toEqual(['.tpl', '.template', '.txt']);
    });

    it('should support extension checking', () => {
      expect(engine.supportsExtension('.tpl')).toBe(true);
      expect(engine.supportsExtension('.template')).toBe(true);
      expect(engine.supportsExtension('.js')).toBe(false);
    });
  });

  describe('variable substitution', () => {
    it('should substitute simple variables', async () => {
      const template = 'Hello {{name}}!';
      const variables = { name: 'World' };
      
      const result = await engine.process(template, variables);
      expect(result).toBe('Hello World!');
    });

    it('should substitute multiple variables', async () => {
      const template = '{{greeting}} {{name}}, you have {{count}} messages.';
      const variables = { greeting: 'Hello', name: 'John', count: 5 };
      
      const result = await engine.process(template, variables);
      expect(result).toBe('Hello John, you have 5 messages.');
    });

    it('should handle nested object properties', async () => {
      const template = 'User: {{user.name}} ({{user.email}})';
      const variables = { 
        user: { 
          name: 'John Doe', 
          email: 'john@example.com' 
        } 
      };
      
      const result = await engine.process(template, variables);
      expect(result).toBe('User: John Doe (john@example.com)');
    });

    it('should leave undefined variables unchanged', async () => {
      const template = 'Hello {{name}}! Your age is {{age}}.';
      const variables = { name: 'John' };
      
      const result = await engine.process(template, variables);
      expect(result).toBe('Hello John! Your age is {{age}}.');
    });
  });

  describe('conditional rendering', () => {
    it('should render if blocks when condition is truthy', async () => {
      const template = '{{#if showMessage}}Hello World!{{/if}}';
      const variables = { showMessage: true };
      
      const result = await engine.process(template, variables);
      expect(result).toBe('Hello World!');
    });

    it('should not render if blocks when condition is falsy', async () => {
      const template = '{{#if showMessage}}Hello World!{{/if}}';
      const variables = { showMessage: false };
      
      const result = await engine.process(template, variables);
      expect(result).toBe('');
    });

    it('should handle if-else blocks', async () => {
      const template = '{{#if isLoggedIn}}Welcome back!{{else}}Please log in.{{/if}}';
      
      let result = await engine.process(template, { isLoggedIn: true });
      expect(result).toBe('Welcome back!');
      
      result = await engine.process(template, { isLoggedIn: false });
      expect(result).toBe('Please log in.');
    });

    it('should treat empty arrays as falsy', async () => {
      const template = '{{#if items}}Has items{{else}}No items{{/if}}';
      
      let result = await engine.process(template, { items: [] });
      expect(result).toBe('No items');
      
      result = await engine.process(template, { items: [1, 2, 3] });
      expect(result).toBe('Has items');
    });
  });

  describe('loop rendering', () => {
    it('should render each blocks with arrays', async () => {
      const template = '{{#each items}}- {{this}}\n{{/each}}';
      const variables = { items: ['apple', 'banana', 'cherry'] };
      
      const result = await engine.process(template, variables);
      expect(result).toBe('- apple\n- banana\n- cherry\n');
    });

    it('should provide index in loops', async () => {
      const template = '{{#each items}}{{@index}}: {{this}}\n{{/each}}';
      const variables = { items: ['first', 'second'] };
      
      const result = await engine.process(template, variables);
      expect(result).toBe('0: first\n1: second\n');
    });

    it('should handle object arrays', async () => {
      const template = '{{#each users}}Name: {{name}}, Age: {{age}}\n{{/each}}';
      const variables = { 
        users: [
          { name: 'John', age: 30 },
          { name: 'Jane', age: 25 }
        ]
      };
      
      const result = await engine.process(template, variables);
      expect(result).toBe('Name: John, Age: 30\nName: Jane, Age: 25\n');
    });

    it('should handle empty arrays gracefully', async () => {
      const template = '{{#each items}}Item: {{this}}{{/each}}';
      const variables = { items: [] };
      
      const result = await engine.process(template, variables);
      expect(result).toBe('');
    });
  });

  describe('variable extraction', () => {
    it('should extract simple variables', () => {
      const template = 'Hello {{name}}! You have {{count}} messages.';
      const variables = engine.extractVariables(template);
      
      expect(variables).toEqual(expect.arrayContaining(['name', 'count']));
    });

    it('should extract variables from conditionals', () => {
      const template = '{{#if isLoggedIn}}Welcome!{{/if}}';
      const variables = engine.extractVariables(template);
      
      expect(variables).toContain('isLoggedIn');
    });

    it('should extract variables from loops', () => {
      const template = '{{#each items}}{{this}}{{/each}}';
      const variables = engine.extractVariables(template);
      
      expect(variables).toContain('items');
    });

    it('should not extract special variables', () => {
      const template = '{{#each items}}{{@index}}: {{this}}{{/each}}';
      const variables = engine.extractVariables(template);
      
      expect(variables).not.toContain('@index');
      expect(variables).not.toContain('this');
    });
  });

  describe('validation', () => {
    it('should validate correct templates', async () => {
      const template = 'Hello {{name}}! {{#if showAge}}Age: {{age}}{{/if}}';
      const result = await engine.validate(template);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect unmatched braces', async () => {
      const template = 'Hello {{name}! Missing closing brace';
      const result = await engine.validate(template);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ message: 'Unmatched template braces' })
        ])
      );
    });

    it('should detect unmatched if blocks', async () => {
      const template = '{{#if condition}}Content without closing';
      const result = await engine.validate(template);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ message: 'Unmatched if/endif blocks' })
        ])
      );
    });

    it('should detect unmatched each blocks', async () => {
      const template = '{{#each items}}Content without closing';
      const result = await engine.validate(template);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ message: 'Unmatched each/endeach blocks' })
        ])
      );
    });

    it('should warn about nested variables', async () => {
      const template = 'User: {{user.name}}';
      const result = await engine.validate(template);
      
      expect(result.valid).toBe(true);
      expect(result.warnings).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ message: 'Nested variable access: user.name' })
        ])
      );
    });
  });

  describe('metadata extraction', () => {
    it('should extract template metadata', async () => {
      const template = 'Hello {{name}}! {{#if showAge}}Age: {{age}}{{/if}}';
      const metadata = await engine.getMetadata(template);
      
      expect(metadata.name).toBe('simple-template');
      expect(metadata.version).toBe('1.0.0');
      expect(metadata.variables).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: 'name', type: 'string', required: true }),
          expect.objectContaining({ name: 'showAge', type: 'string', required: true }),
          expect.objectContaining({ name: 'age', type: 'string', required: true })
        ])
      );
    });
  });

  describe('performance', () => {
    it('should process large templates efficiently', async () => {
      const template = '{{#each items}}Item {{@index}}: {{name}} - {{description}}\n{{/each}}';
      const items = Array.from({ length: 1000 }, (_, i) => ({
        name: `Item ${i}`,
        description: `Description for item ${i}`
      }));
      
      const startTime = performance.now();
      const result = await engine.process(template, { items });
      const endTime = performance.now();
      
      expect(result).toContain('Item 0: Item 0');
      expect(result).toContain('Item 999: Item 999');
      expect(endTime - startTime).toBeLessThan(100); // Should complete in under 100ms
    });
  });
});
