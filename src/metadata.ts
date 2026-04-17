import { Abstract, Constructor, Lifetime, Token } from './interfaces.js';

/**
 * Service metadata captured from decorators.
 */
export interface ServiceMetadata {
  /** Whether the class is eligible for metadata-driven registration. */
  injectable: boolean;

  /** Optional default lifetime used when no fluent lifetime is configured. */
  lifetime?: Lifetime;

  /** Optional token that this class provides during auto-registration. */
  provide?: Token<unknown>;

  /** Explicit constructor dependency tokens, in constructor parameter order. */
  deps?: readonly Token<unknown>[];
}

/**
 * Metadata abstraction used by the DI runtime.
 * Implementations own DI metadata directly instead of relying on global
 * reflect-metadata side effects.
 */
export interface MetadataRegistry {
  /**
   * Defines or merges service metadata for a decorated class.
   * @param target The class or abstract class receiving metadata.
   * @param metadata Metadata fields to store.
   */
  defineServiceMetadata(target: Constructor<unknown> | Abstract<unknown>, metadata: Partial<ServiceMetadata>): void;

  /**
   * Reads service metadata for a class.
   * @param target The class or abstract class to inspect.
   * @returns Stored metadata, or undefined if no metadata exists.
   */
  getServiceMetadata(target: Constructor<unknown> | Abstract<unknown>): ServiceMetadata | undefined;

  /**
   * Returns all classes that have received service metadata.
   * @returns Decorated classes known to the registry.
   */
  getDecoratedClasses(): readonly (Constructor<unknown> | Abstract<unknown>)[];

  /**
   * Resolves constructor dependency tokens for a class.
   * @param target The class or abstract class to inspect.
   * @param parents Parent class path used for inherited dependency diagnostics.
   * @returns Constructor dependency tokens in parameter order.
   */
  getConstructorDependencies(target: Constructor<unknown> | Abstract<unknown>, parents?: string[]): Token<unknown>[];
}

/**
 * Default metadata registry implementation for DI metadata and explicit constructor dependencies.
 */
export class DefaultMetadataRegistry implements MetadataRegistry {
  /** Metadata is held weakly so decorated classes can still be garbage-collected. */
  private readonly serviceMetadata = new WeakMap<Constructor<unknown> | Abstract<unknown>, ServiceMetadata>();

  /** Ordered set of decorated classes used by auto-registration. */
  private readonly decoratedClasses = new Set<Constructor<unknown> | Abstract<unknown>>();

  /**
   * Defines or merges service metadata for a decorated class.
   * Repeated decorators cooperate by preserving existing fields that are not
   * supplied by the newer decorator.
   * @param target The class or abstract class receiving metadata.
   * @param metadata Metadata fields to store.
   */
  defineServiceMetadata(target: Constructor<unknown> | Abstract<unknown>, metadata: Partial<ServiceMetadata>): void {
    const current = this.serviceMetadata.get(target) ?? { injectable: false };
    const next: ServiceMetadata = {
      ...current,
      ...metadata,
      deps: metadata.deps ? [...metadata.deps] : current.deps,
      injectable: metadata.injectable ?? current.injectable,
    };

    this.serviceMetadata.set(target, next);
    this.decoratedClasses.add(target);
  }

  /**
   * Reads service metadata for a class.
   * @param target The class or abstract class to inspect.
   * @returns Stored metadata, or undefined if no metadata exists.
   */
  getServiceMetadata(target: Constructor<unknown> | Abstract<unknown>): ServiceMetadata | undefined {
    return this.serviceMetadata.get(target);
  }

  /**
   * Returns decorated classes known to the default metadata registry.
   * @returns A snapshot array of decorated classes.
   */
  getDecoratedClasses(): readonly (Constructor<unknown> | Abstract<unknown>)[] {
    return Array.from(this.decoratedClasses);
  }

  /**
   * Resolves constructor dependency tokens from explicit decorator metadata.
   * If a class has no dependency metadata, its base class is inspected so derived
   * services can inherit dependency declarations from decorated base classes.
   * Array and Map subclasses are treated as collection containers and do not need
   * constructor dependency declarations.
   * @param target The class or abstract class to inspect.
   * @param parents Parent class path used for inherited dependency diagnostics.
   * @returns Constructor dependency tokens in parameter order.
   * @throws {Error} If dependencies are missing for a parameterized constructor.
   */
  getConstructorDependencies(target: Constructor<unknown> | Abstract<unknown>, parents: string[] = []): Token<unknown>[] {
    const metadata = this.getServiceMetadata(target);
    if (metadata?.deps) {
      if (metadata.deps.length < target.length) {
        throw new Error(`Service dependencies incomplete: ${[...parents, target.name].join(' -> ')}`);
      }

      return [...metadata.deps];
    }

    const baseClass = this.getBaseClass(target);
    if (baseClass === Array || baseClass === Map) {
      return [];
    }

    if (baseClass) {
      return this.getConstructorDependencies(baseClass, [...parents, target.name]);
    }

    if (target.length > 0) {
      throw new Error(`Service dependencies not declared: ${[...parents, target.name].join(' -> ')}`);
    }

    return [];
  }

  /**
   * Gets the base class of a given target class by inspecting its prototype chain.
   * @template T The type of the target.
   * @template B The type of the base class.
   * @param target The abstract class or constructor to inspect.
   * @returns The base class constructor, or undefined if the target extends Object directly.
   */
  private getBaseClass<T extends B, B>(target: Abstract<T>) {
    const baseClass = Object.getPrototypeOf(target.prototype).constructor;
    if (baseClass === Object) {
      return undefined;
    }

    return baseClass as Constructor<B> | Abstract<B>;
  }
}

const defaultMetadataRegistry = new DefaultMetadataRegistry();

/**
 * Returns the shared metadata registry used by decorators and default registries.
 * This is global metadata, not a global runtime container.
 * @returns The shared metadata registry.
 */
export const getDefaultMetadataRegistry = (): MetadataRegistry => defaultMetadataRegistry;
