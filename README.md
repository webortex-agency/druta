# Druta CLI Framework

A production-grade CLI framework for SaaS application generation, built with TypeScript and designed for extensibility, performance, and developer experience.

## Features

- 🚀 **High Performance**: <200ms startup time, <50MB memory usage
- 🔌 **Plugin System**: Hot-swappable modules with dependency resolution
- 📝 **Template Engine**: Streaming support with conditional rendering
- ⚙️ **Configuration**: JSON/YAML support with validation
- 📊 **Logging**: Multiple levels with performance tracking
- 🎯 **Type Safety**: Full TypeScript support with strict mode
- 🧪 **Well Tested**: >85% test coverage with comprehensive test suite
- 🔒 **Security First**: Input validation and sanitization

## Quick Start

### Installation

```bash
npm install -g druta-cli
```

### Basic Usage

```bash
# Generate a new SaaS application
druta generate my-template -o ./my-app

# List available templates
druta list

# Install a plugin
druta plugin install @druta/auth-plugin

# Configure CLI
druta config --set templates.directory=/path/to/templates
```

## Architecture

### Core Components

- **CLI Entry Point** (`bin/druta.js`): Executable with global error handling
- **Core Framework** (`src/core/`): Plugin system, config, events, logging
- **Template Engine** (`src/engines/`): Abstract processor with streaming
- **Type System** (`src/types/`): Comprehensive TypeScript definitions

### Plugin System

The plugin system supports hot-swappable modules with automatic dependency resolution:

```typescript
import type { Plugin, PluginContext } from 'druta-cli';

export default class MyPlugin implements Plugin {
  metadata = {
    name: 'my-plugin',
    version: '1.0.0',
    description: 'Example plugin'
  };

  async initialize(context: PluginContext): Promise<void> {
    context.events.on('generate:start', this.handleGenerate);
  }

  private async handleGenerate(data: any): Promise<void> {
    context.logger.info('Plugin handling generation...');
  }
}
```

### Template Engine

Simple template syntax with variable substitution and conditionals:

```handlebars
# {{projectName}}

{{#if includeAuth}}
## Authentication
This project includes authentication features.
{{/if}}

## Dependencies
{{#each dependencies}}
- {{name}}: {{version}}
{{/each}}
```

### Configuration

Supports both JSON and YAML formats:

```json
{
  "templates": {
    "directory": "~/.druta/templates",
    "remote": {
      "registry": "https://registry.druta.dev",
      "timeout": 30000
    }
  },
  "plugins": {
    "directory": "~/.druta/plugins",
    "autoUpdate": false
  },
  "logging": {
    "level": "info",
    "colors": true
  }
}
```

## Development

### Prerequisites

- Node.js 18+ or 20+
- TypeScript 5.3+
- Jest for testing

### Setup

```bash
# Clone repository
git clone <repository-url>
cd druta-cli

# Install dependencies
npm install

# Build project
npm run build

# Run tests
npm test

# Run with coverage
npm run test:coverage

# Lint code
npm run lint
```

### Project Structure

```
druta-cli/
├── bin/
│   └── druta.js              # CLI entry point
├── src/
│   ├── core/                 # Core framework
│   │   ├── config.ts         # Configuration management
│   │   ├── events.ts         # Event system
│   │   ├── logger.ts         # Logging system
│   │   └── plugin.ts         # Plugin manager
│   ├── engines/              # Template engines
│   │   └── template.ts       # Template processor
│   ├── types/                # Type definitions
│   │   └── index.ts          # Main types
│   ├── __tests__/            # Test files
│   └── index.ts              # Main CLI class
├── dist/                     # Compiled output
├── package.json              # Package configuration
├── tsconfig.json             # TypeScript config
├── jest.config.js            # Jest configuration
└── README.md                 # This file
```

## API Reference

### DrutaCLI Class

Main CLI orchestrator class:

```typescript
const cli = new DrutaCLI({
  version: '1.0.0',
  name: 'druta-cli',
  startTime: performance.now()
});

await cli.run(process.argv);
```

### Logger

High-performance logger with multiple levels:

```typescript
const logger = new Logger({ level: 'info' });

logger.info('Information message');
logger.warn('Warning message');
logger.error('Error message');
logger.success('Success message');
logger.perf('Operation', startTime);

// Create child logger with context
const child = logger.child({ module: 'auth' });
```

### Configuration Manager

JSON/YAML configuration with validation:

```typescript
const config = new ConfigManager(logger);

await config.loadFromFile('./config.json');
config.set('templates.directory', '/new/path');
await config.save();

const value = config.get('templates.directory', '/default/path');
```

### Event System

High-performance event emitter with middleware:

```typescript
const events = new EventEmitter();

events.on('generate:start', async (data) => {
  console.log('Generation started:', data);
});

await events.emit('generate:start', { template: 'react-app' });
```

### Plugin Manager

Hot-swappable plugin system:

```typescript
const plugins = new PluginManager(events, logger);

plugins.addPluginDirectory('./plugins');
await plugins.loadAll();

const plugin = plugins.get('my-plugin');
await plugins.reload('my-plugin');
```

### Template Engine

Streaming template processor:

```typescript
const engine = new SimpleTemplateEngine();

const result = await engine.process(template, variables);
const validation = await engine.validate(template);
const variables = engine.extractVariables(template);
```

## Performance

The CLI is optimized for performance with the following targets:

- **Startup Time**: <200ms for basic operations
- **Memory Usage**: <50MB for standard workflows
- **Template Processing**: Streaming support for large files
- **Plugin Loading**: Lazy loading with dependency resolution

## Security

Security-first design with:

- Input validation and sanitization
- Safe template variable substitution
- Plugin isolation and sandboxing
- Configuration validation
- Error handling without information leakage

## Testing

Comprehensive test suite with >85% coverage:

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test file
npm test -- logger.test.ts

# Watch mode
npm run test:watch
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

## License

MIT License - see LICENSE file for details.

