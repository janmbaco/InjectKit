import { Abstract, Constructor, Lifetime, Token } from './interfaces.js';

const DESIGN_PARAMTYPES = 'design:paramtypes';

type PropertyMetadataKey = string | symbol | undefined;

/**
 * Service metadata captured from decorators.
 */
export interface ServiceMetadata {
  injectable: boolean;
  lifetime?: Lifetime;
  provide?: Token<unknown>;
}

/**
 * Metadata abstraction used by the DI runtime.
 */
export interface MetadataRegistry {
  defineServiceMetadata(target: Constructor<unknown> | Abstract<unknown>, metadata: Partial<ServiceMetadata>): void;
  getServiceMetadata(target: Constructor<unknown> | Abstract<unknown>): ServiceMetadata | undefined;
  getDecoratedClasses(): readonly (Constructor<unknown> | Abstract<unknown>)[];
  getConstructorDependencies(
    target: Constructor<unknown> | Abstract<unknown>,
    parents?: string[],
  ): Token<unknown>[];
}

type ReflectMetadataBucket = Map<PropertyMetadataKey, Map<unknown, unknown>>;

const reflectMetadataStore = new WeakMap<object, ReflectMetadataBucket>();

const ensureReflectMetadataBucket = (target: object): ReflectMetadataBucket => {
  const current = reflectMetadataStore.get(target);
  if (current) {
    return current;
  }

  const created = new Map<PropertyMetadataKey, Map<unknown, unknown>>();
  reflectMetadataStore.set(target, created);
  return created;
};

const defineReflectMetadata = (
  metadataKey: unknown,
  metadataValue: unknown,
  target: object,
  propertyKey?: string | symbol,
): void => {
  const bucket = ensureReflectMetadataBucket(target);
  const memberBucket = bucket.get(propertyKey) ?? new Map<unknown, unknown>();
  memberBucket.set(metadataKey, metadataValue);
  bucket.set(propertyKey, memberBucket);
};

const getOwnReflectMetadata = (
  metadataKey: unknown,
  target: object,
  propertyKey?: string | symbol,
): unknown => {
  const bucket = reflectMetadataStore.get(target);
  return bucket?.get(propertyKey)?.get(metadataKey);
};

const getReflectMetadata = (
  metadataKey: unknown,
  target: object,
  propertyKey?: string | symbol,
): unknown => {
  let current: object | null = target;

  while (current) {
    const metadata = getOwnReflectMetadata(metadataKey, current, propertyKey);
    if (metadata !== undefined) {
      return metadata;
    }

    current = Object.getPrototypeOf(current);
  }

  return undefined;
};

const hasOwnReflectMetadata = (
  metadataKey: unknown,
  target: object,
  propertyKey?: string | symbol,
): boolean => {
  return getOwnReflectMetadata(metadataKey, target, propertyKey) !== undefined;
};

const hasReflectMetadata = (
  metadataKey: unknown,
  target: object,
  propertyKey?: string | symbol,
): boolean => {
  return getReflectMetadata(metadataKey, target, propertyKey) !== undefined;
};

const installReflectMetadata = (): void => {
  const reflectApi = Reflect as typeof Reflect & {
    defineMetadata?: (
      metadataKey: unknown,
      metadataValue: unknown,
      target: object,
      propertyKey?: string | symbol,
    ) => void;
    getOwnMetadata?: (
      metadataKey: unknown,
      target: object,
      propertyKey?: string | symbol,
    ) => unknown;
    getMetadata?: (
      metadataKey: unknown,
      target: object,
      propertyKey?: string | symbol,
    ) => unknown;
    hasOwnMetadata?: (
      metadataKey: unknown,
      target: object,
      propertyKey?: string | symbol,
    ) => boolean;
    hasMetadata?: (
      metadataKey: unknown,
      target: object,
      propertyKey?: string | symbol,
    ) => boolean;
    metadata?: (
      metadataKey: unknown,
      metadataValue: unknown,
    ) => (target: object, propertyKey?: string | symbol) => void;
  };

  reflectApi.defineMetadata ??= defineReflectMetadata;
  reflectApi.getOwnMetadata ??= getOwnReflectMetadata;
  reflectApi.getMetadata ??= getReflectMetadata;
  reflectApi.hasOwnMetadata ??= hasOwnReflectMetadata;
  reflectApi.hasMetadata ??= hasReflectMetadata;
  reflectApi.metadata ??=
    (metadataKey: unknown, metadataValue: unknown) =>
    (target: object, propertyKey?: string | symbol): void => {
      defineReflectMetadata(metadataKey, metadataValue, target, propertyKey);
    };
};

installReflectMetadata();

/**
 * Default metadata registry implementation for DI metadata and constructor metadata.
 */
export class DefaultMetadataRegistry implements MetadataRegistry {
  private readonly serviceMetadata = new WeakMap<
    Constructor<unknown> | Abstract<unknown>,
    ServiceMetadata
  >();

  private readonly decoratedClasses = new Set<Constructor<unknown> | Abstract<unknown>>();

  defineServiceMetadata(
    target: Constructor<unknown> | Abstract<unknown>,
    metadata: Partial<ServiceMetadata>,
  ): void {
    const current = this.serviceMetadata.get(target) ?? { injectable: false };
    const next: ServiceMetadata = {
      ...current,
      ...metadata,
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

  getConstructorDependencies(
    target: Constructor<unknown> | Abstract<unknown>,
    parents: string[] = [],
  ): Token<unknown>[] {
    const dependencies = (
      (Reflect as typeof Reflect & {
        getOwnMetadata?: (
          metadataKey: unknown,
          target: object,
          propertyKey?: string | symbol,
        ) => unknown;
      }).getOwnMetadata?.(DESIGN_PARAMTYPES, target as unknown as object) ?? []
    ) as Token<unknown>[];

    if (dependencies.length < target.length) {
      throw new Error(`Service not decorated: ${[...parents, target.name].join(' -> ')}`);
    }

    if (dependencies.length > 0) {
      return dependencies;
    }

    if (target.length > 0) {
      return [];
    }

    const baseClass = this.getBaseClass(target);
    if (baseClass === Array || baseClass === Map) {
      return [];
    }

    if (baseClass) {
      return this.getConstructorDependencies(baseClass, [...parents, target.name]);
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
