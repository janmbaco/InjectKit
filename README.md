# InjectKit

[![Repository](https://img.shields.io/badge/github-janmbaco%2FInjectKit-181717?logo=github)](https://github.com/janmbaco/InjectKit)

---

<p align="center">
  <strong>A lightweight, type-safe dependency injection container for TypeScript</strong>
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#installation">Installation</a> •
  <a href="#quick-start">Quick Start</a> •
  <a href="#core-concepts">Core Concepts</a> •
  <a href="#api-reference">API Reference</a> •
  <a href="#license">License</a>
</p>

---

## Features

- 🎯 **Type-safe** — Full TypeScript support with strong typing throughout
- 🪶 **Lightweight** — Minimal footprint with zero runtime dependencies
- 🔄 **Multiple lifetimes** — Singleton, transient, and scoped instance management
- 🏭 **Flexible registration** — Classes, factories, or existing instances
- 📦 **Collection support** — Register arrays and maps of implementations
- 🔍 **Validation** — Automatic detection of missing and circular dependencies
- 🧪 **Test-friendly** — Easy mocking with scoped container overrides

## Installation

```bash
npm install @janmbaco/injectkit
```

```bash
pnpm add @janmbaco/injectkit
```

```bash
yarn add @janmbaco/injectkit
```

## Requirements

- **Node.js** >= 20
- **TypeScript** with the following compiler options enabled:

```json
{
  "compilerOptions": {
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true
  }
}
```

- No `reflect-metadata` import is required at application entry point.

## Quick Start

```typescript
import { Injectable, InjectKitRegistry, Container } from '@janmbaco/injectkit';

// 1. Decorate your classes with @Injectable()
@Injectable()
class Logger {
  log(message: string) {
    console.log(`[LOG] ${message}`);
  }
}

@Injectable()
class UserService {
  constructor(private logger: Logger) {}

  createUser(name: string) {
    this.logger.log(`Creating user: ${name}`);
    return { id: crypto.randomUUID(), name };
  }
}

// 2. Create a registry and register your services
const registry = new InjectKitRegistry();
registry.register(Logger).useClass(Logger).asSingleton();
registry.register(UserService).useClass(UserService).asSingleton();

// 3. Build the container
const container = registry.build();

// 4. Resolve and use your services
const userService = container.get(UserService);
userService.createUser('Alice');
```

## Core Concepts

### Registry

The **Registry** is where you configure your services before runtime. It validates all registrations when building the container.

```typescript
const registry = new InjectKitRegistry();

// Register services
registry.register(MyService).useClass(MyService).asSingleton();

// Check if registered
registry.isRegistered(MyService); // true

// Remove if needed
registry.remove(MyService);

// Build the container when ready
const container = registry.build();
```

### Container

The **Container** resolves and manages service instances at runtime. It automatically injects dependencies declared in constructors.

```typescript
// Resolve a service (dependencies are injected automatically)
const service = container.get(MyService);

// The Container itself can be resolved for factory patterns
const container = container.get(Container);
```

### Token

A **Token** is a class constructor, abstract class, string, or symbol used to register and resolve services. This enables programming to abstractions and nominal contracts:

```typescript
// Abstract class as identifier
abstract class Repository {
  abstract find(id: string): Promise<Entity>;
}

// Concrete implementation
@Injectable()
class PostgresRepository extends Repository {
  async find(id: string) {
    /* ... */
  }
}

// Register abstract → concrete mapping
registry.register(Repository).useClass(PostgresRepository).asSingleton();

// Resolve using the abstract class
const repo = container.get(Repository); // Returns PostgresRepository
```

### Lifetimes

InjectKit supports three lifetime strategies:

| Lifetime      | Behavior                                          |
| ------------- | ------------------------------------------------- |
| **Singleton** | One instance shared across the entire application |
| **Transient** | New instance created on every `get()` call        |
| **Scoped**    | One instance per scope, shared within that scope  |

```typescript
registry.register(ConfigService).useClass(ConfigService).asSingleton();
registry.register(RequestId).useClass(RequestId).asScoped();
registry.register(TempCalculation).useClass(TempCalculation).asTransient();
```

## API Reference

### Registration Methods

#### `useClass(constructor)`

Register a service using its constructor. Dependencies are automatically resolved from constructor parameters.

```typescript
@Injectable()
class EmailService {
  constructor(
    private config: ConfigService,
    private logger: Logger,
  ) {}
}

registry.register(EmailService).useClass(EmailService).asSingleton();
```

#### `useFactory(factory)`

Register a service using a factory function. Useful for complex initialization or third-party libraries.

```typescript
registry
  .register(DatabaseConnection)
  .useFactory(container => {
    const config = container.get(ConfigService);
    return new DatabaseConnection({
      host: config.dbHost,
      port: config.dbPort,
    });
  })
  .asSingleton();
```

#### `useInstance(instance)`

Register an existing instance directly. Always behaves as a singleton.

```typescript
const config = new ConfigService({ env: 'production' });
registry.register(ConfigService).useInstance(config);
```

#### `useArray(constructor)`

Register a collection of implementations. Useful for plugin systems or strategy patterns.

```typescript
// Handler implementations
@Injectable()
class JsonHandler extends Handler {
  /* ... */
}

@Injectable()
class XmlHandler extends Handler {
  /* ... */
}

// Array container
@Injectable()
class Handlers extends Array<Handler> {}

// Registration
registry.register(JsonHandler).useClass(JsonHandler).asSingleton();
registry.register(XmlHandler).useClass(XmlHandler).asSingleton();
registry.register(Handlers).useArray(Handlers).push(JsonHandler).push(XmlHandler);

// Usage
const handlers = container.get(Handlers);
handlers.forEach(h => h.handle(data));
```

#### `useMap(constructor)`

Register a keyed collection of implementations.

```typescript
@Injectable()
class ProcessorMap extends Map<string, Processor> {}

registry.register(ProcessorMap).useMap(ProcessorMap).set('fast', FastProcessor).set('accurate', AccurateProcessor);

// Usage
const processors = container.get(ProcessorMap);
const processor = processors.get('fast');
```

### Container Methods

#### `get<T>(identifier): T`

Resolves an instance of the specified type.

```typescript
const service = container.get(MyService);
```

#### `hasRegistration<T>(identifier): boolean`

Checks if a service has a registration with the container.

```typescript
container.hasRegistration(MyService); // true
container.hasRegistration(UnregisteredService); // false
```

#### `createScopedContainer(): ScopedContainer`

Creates a child container for scoped instance management.

```typescript
const requestScope = container.createScopedContainer();
const requestService = requestScope.get(RequestScopedService);
```

#### `override<T>(identifier, instance): void`

Overrides a registration within a scoped container. Perfect for testing.

```typescript
const testScope = container.createScopedContainer();

// Override with a mock
testScope.override(EmailService, {
  send: vi.fn().mockResolvedValue(true),
} as EmailService);

// Tests use the mock
const service = testScope.get(NotificationService);
```

### Registry Methods

#### `register<T>(identifier): RegistrationType<T>`

Starts a registration chain for a service.

#### `remove<T>(identifier): void`

Removes a registration from the registry.

#### `isRegistered<T>(identifier): boolean`

Checks if a service is already registered.

#### `build(): Container`

Builds the container, validating all registrations.

## Scoped Containers

Scoped containers enable request-scoped or unit-of-work patterns:

```typescript
@Injectable()
class RequestContext {
  readonly requestId = crypto.randomUUID();
  readonly startTime = Date.now();
}

registry.register(RequestContext).useClass(RequestContext).asScoped();

// Per-request handling
app.use((req, res, next) => {
  const scope = container.createScopedContainer();

  // Same RequestContext instance throughout this request
  const ctx = scope.get(RequestContext);
  req.scope = scope;

  next();
});
```

### Scope Hierarchy

Scoped containers inherit instances from parent scopes:

```typescript
const root = registry.build();
const scope1 = root.createScopedContainer();
const scope2 = scope1.createScopedContainer();

// Instance created in scope1 is visible in scope2
const instance1 = scope1.get(ScopedService);
const instance2 = scope2.get(ScopedService);
console.log(instance1 === instance2); // true
```

## Validation

InjectKit validates your dependency graph when calling `build()`:

### Missing Dependencies

```typescript
@Injectable()
class UserService {
  constructor(private db: DatabaseService) {} // Not registered!
}

registry.register(UserService).useClass(UserService).asSingleton();
registry.build(); // ❌ Error: Missing dependencies for UserService: DatabaseService
```

### Circular Dependencies

```typescript
@Injectable()
class ServiceA {
  constructor(private b: ServiceB) {}
}

@Injectable()
class ServiceB {
  constructor(private a: ServiceA) {}
}

registry.register(ServiceA).useClass(ServiceA).asSingleton();
registry.register(ServiceB).useClass(ServiceB).asSingleton();
registry.build(); // ❌ Error: Circular dependency found: ServiceA -> ServiceB -> ServiceA
```

### Missing Decorator

```typescript
class ForgotDecorator {
  constructor(private dep: SomeDependency) {}
}

registry.register(ForgotDecorator).useClass(ForgotDecorator).asSingleton();
registry.build(); // ❌ Error: Service not decorated: ForgotDecorator
```

## Testing

InjectKit makes testing easy with scoped overrides:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';

describe('UserService', () => {
  let scope: ScopedContainer;
  let mockDb: DatabaseService;

  beforeEach(() => {
    scope = container.createScopedContainer();

    mockDb = {
      query: vi.fn().mockResolvedValue([{ id: '1', name: 'Test' }]),
    } as unknown as DatabaseService;

    scope.override(DatabaseService, mockDb);
  });

  it('should fetch users', async () => {
    const userService = scope.get(UserService);
    const users = await userService.getUsers();

    expect(users).toHaveLength(1);
    expect(mockDb.query).toHaveBeenCalled();
  });
});
```

## TypeScript Configuration

Recommended `tsconfig.json` settings:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
    "strict": true
  }
}
```

## License

MIT
