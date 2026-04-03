# InjectKit - Cursor Rules

## Project Overview

InjectKit is a lightweight, type-safe DI container for TypeScript, published as `@janmbaco/injectkit`.

Core direction:

- no static runtime container
- explicit composition root
- useful decorators
- build-time validation
- tokens support `class | abstract class | string | symbol`

## Architecture

### Core Components

- **Registry** (`InjectKitRegistry`): registration and composition phase
- **Container** (`InjectKitContainer`): runtime resolution phase
- **MetadataRegistry**: shared metadata backend used by decorators and `build()`
- **Token**: runtime key for service registration and resolution
- **Registration**: internal normalized definition for service construction and lifetime

### File Structure

```
src/
├── index.ts
├── injectable.ts
├── interfaces.ts
├── metadata.ts
├── token.ts
├── registry.ts
├── container.ts
└── internal.ts
```

## API Model

Use this mental model consistently:

- decorators describe
- registry composes
- `build()` materializes and validates

That means:

- decorators do not register directly into a runtime container
- registry decides what enters the system explicitly
- `build()` merges explicit registrations, metadata-driven registrations, and overrides

## Public API Expectations

Preferred patterns:

```ts
registry.register(Service).useClass(Service).asSingleton();
registry.registerValue(CONFIG, value);
registry.registerFactory(TOKEN, container => new Service(), 'singleton');
```

Decorator-driven patterns are valid:

```ts
@Singleton()
class Logger {}

@Injectable()
class UserService {
  constructor(private readonly logger: Logger) {}
}

const container = createRegistry().build({
  autoRegisterDecorated: true,
});
```

Token-driven contracts are first-class:

```ts
const LOGGER = Symbol('LOGGER');

@Singleton()
@Provides(LOGGER)
class ConsoleLogger {}
```

Overrides belong in `build()`:

```ts
const container = createRegistry().build({
  autoRegisterDecorated: true,
  overrides: [{ token: LOGGER, useClass: TestLogger, lifetime: 'singleton' }],
});
```

## Code Conventions

- Use strict TypeScript with `strict: true`
- Use decorators with `experimentalDecorators` and `emitDecoratorMetadata`
- Use ES modules with `.js` extensions in imports
- Prefer explicit, readable APIs over clever overloads
- Keep the runtime small and predictable
- Avoid `any` when possible
- Prefer early returns and small helper functions

## Lifetimes

Only these lifetimes are supported:

- `singleton`
- `transient`
- `scoped`

Do not introduce new lifetimes to solve strategy-selection problems.
Multiple implementations of the same abstraction must be modeled with:

- tokens
- collections
- factories
- explicit composition root wiring

## Dependency Resolution

- Constructor dependencies are read through the library metadata layer
- Decorated classes participate in metadata-driven auto-registration
- Explicit registrations override metadata-driven registrations
- Build overrides override both
- `Container` is auto-registered unless explicitly replaced

## Testing

- Use Vitest
- Test files live in `tests/` and use `.test.ts`
- Prefer testing through public APIs
- Cover:
  - explicit registration
  - decorator-driven registration
  - string/symbol tokens
  - overrides
  - missing dependency validation
  - circular dependency validation

## Design Guardrails

- No global runtime container
- No filesystem scanning
- No module auto-loading
- No name-matching dependency resolution
- Keep explicit registration available at all times
- Keep build-time validation as a core feature
