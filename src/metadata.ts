import { Abstract, Constructor, Lifetime, Token } from './interfaces.js';

/**
 * Service metadata captured from decorators.
 */
export interface ServiceMetadata {
  injectable: boolean;
  lifetime?: Lifetime;
  provide?: Token<unknown>;
  deps?: readonly Token<unknown>[];
}

/**
 * Metadata abstraction used by the DI runtime.
 */
export interface MetadataRegistry {
  defineServiceMetadata(target: Constructor<unknown> | Abstract<unknown>, metadata: Partial<ServiceMetadata>): void;
  getServiceMetadata(target: Constructor<unknown> | Abstract<unknown>): ServiceMetadata | undefined;
  getDecoratedClasses(): readonly (Constructor<unknown> | Abstract<unknown>)[];
  getConstructorDependencies(target: Constructor<unknown> | Abstract<unknown>, parents?: string[]): Token<unknown>[];
}

/**
 * Default metadata registry implementation for DI metadata and explicit constructor dependencies.
 */
export class DefaultMetadataRegistry implements MetadataRegistry {
  private readonly serviceMetadata = new WeakMap<Constructor<unknown> | Abstract<unknown>, ServiceMetadata>();

  private readonly decoratedClasses = new Set<Constructor<unknown> | Abstract<unknown>>();

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

  getServiceMetadata(target: Constructor<unknown> | Abstract<unknown>): ServiceMetadata | undefined {
    return this.serviceMetadata.get(target);
  }

  getDecoratedClasses(): readonly (Constructor<unknown> | Abstract<unknown>)[] {
    return Array.from(this.decoratedClasses);
  }

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
