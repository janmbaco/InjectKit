# InjectKit

Lightweight, type-safe dependency injection container for TypeScript.

## Project Overview

- **Package**: `injectkit` (npm), v1.1.0
- **Author**: Marooned Software
- **License**: MIT
- **Runtime dependency**: `reflect-metadata`
- **Node**: >= 20, ESM-only

## Tech Stack

- TypeScript 5.9+ with `experimentalDecorators` and `emitDecoratorMetadata`
- Build: `tsup` (ESM bundle) + `tsc` (declarations)
- Test: Vitest with `unplugin-swc` for decorator support
- Lint: ESLint + Prettier
- Package manager: pnpm
- CI/CD: GitHub Actions with Changesets for versioning
- Coverage: codecov

## Commands

```bash
pnpm run build        # Build (tsup + tsc declarations)
pnpm run build:ci     # Lint + build
pnpm run test         # Run tests
pnpm run test:ci      # Run tests with coverage
pnpm run lint         # ESLint with auto-fix
pnpm run format       # Prettier
pnpm run changeset    # Create changeset + version bump
```

## Project Structure

```
src/
  index.ts          # Public exports
  injectable.ts     # @Injectable() decorator
  interfaces.ts     # All public types (Container, Registry, Identifier, etc.)
  internal.ts       # Internal Registration<T> type
  registry.ts       # InjectKitRegistry + InjectKitRegistration (fluent builder)
  container.ts      # InjectKitContainer (resolution + lifetime management)
tests/
  setup.ts          # Imports reflect-metadata
  injectable.test.ts
  registry.test.ts
  container.test.ts
```

## Architecture

### Core Flow
1. Create `InjectKitRegistry`
2. Register services with fluent API: `.register(Id).useClass(Impl).asSingleton()`
3. Call `registry.build()` which validates (missing deps, circular deps) then returns `InjectKitContainer`
4. Resolve with `container.get(Id)`

### Registration Methods
- `useClass(ctor)` — Constructor injection via `reflect-metadata`
- `useFactory(fn)` — Factory function receiving `Container`
- `useInstance(obj)` — Pre-built instance (always singleton)
- `useArray(ctor)` — Array collection with `.push()` chaining
- `useMap(ctor)` — Map collection with `.set(key, id)` chaining

### Lifetimes
- **Singleton**: cached in root container
- **Transient**: new instance every `get()` call
- **Scoped**: cached per scoped container, inherits from parent scope

### Key Design Decisions
- `@Injectable()` is an identity decorator — its only purpose is triggering TypeScript's `emitDecoratorMetadata` to emit `design:paramtypes`
- `Container` is auto-registered as a singleton factory so services can resolve it
- Validation runs at build time (DFS for circular deps, missing dep checks)
- Scoped containers form a parent chain; singletons bubble to root

## Coding Conventions

- Strict TypeScript (`strict: true`, `noUncheckedIndexedAccess`)
- ESM-only (`"type": "module"` in package.json)
- `.js` extensions in imports (required for NodeNext resolution)
- Fluent builder pattern for registration API
- All public types in `interfaces.ts`, internal types in `internal.ts`
- Tests use Vitest globals (`describe`, `it`, `expect` without imports)
- Test setup file imports `reflect-metadata`
- ESLint treats all errors as warnings (`eslint-plugin-only-warn`)
- No CommonJS, no UMD

## Important Patterns

When adding new features:
- Public types/interfaces go in `src/interfaces.ts`
- Internal types go in `src/internal.ts`
- Export new public items from `src/index.ts`
- Registration builder logic goes in `InjectKitRegistration` class in `src/registry.ts`
- Resolution logic goes in `InjectKitContainer` class in `src/container.ts`
- Tests go in `tests/` following existing `*.test.ts` naming
- Use `@Injectable()` on any test fixture classes that use constructor injection
