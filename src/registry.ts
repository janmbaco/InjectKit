import {
  Abstract,
  ArrayType,
  BuildOptions,
  Container,
  Constructor,
  Factory,
  Lifetime,
  MapType,
  Override,
  RegistrationArray,
  RegistrationLifeTime,
  RegistrationMap,
  RegistrationType,
  Registry,
  Token,
} from './interfaces.js';
import { InjectKitContainer } from './container.js';
import { Registration } from './internal.js';
import { getDefaultMetadataRegistry, MetadataRegistry } from './metadata.js';
import { formatToken } from './token.js';

/**
 * Registry implementation for managing service registrations.
 * Allows registration of services with various creation strategies (class, factory, instance)
 * and lifetime management (singleton, transient, scoped).
 */
export class InjectKitRegistry implements Registry {
  private readonly registrations: Map<Token<unknown>, InjectKitRegistration<unknown>> = new Map();

  constructor(private readonly metadataRegistry: MetadataRegistry = getDefaultMetadataRegistry()) {}

  public register<T>(token: Token<T>): RegistrationType<T> {
    if (this.registrations.has(token)) {
      throw new Error(`Registration for ${formatToken(token)} already exists`);
    }

    const registration = new InjectKitRegistration<T>(this.metadataRegistry);
    this.registrations.set(token, registration);
    return registration;
  }

  public registerValue<T>(token: Token<T>, value: T): this {
    this.register(token).useInstance(value);
    return this;
  }

  public registerFactory<T>(token: Token<T>, factory: Factory<T>, lifetime: Lifetime = 'transient'): this {
    const registration = this.register(token).useFactory(factory);
    if (lifetime === 'singleton') {
      registration.asSingleton();
    } else if (lifetime === 'scoped') {
      registration.asScoped();
    } else {
      registration.asTransient();
    }

    return this;
  }

  public remove<T>(token: Token<T>): void {
    if (!this.registrations.delete(token)) {
      throw new Error(`Registration for ${formatToken(token)} not found`);
    }
  }

  public isRegistered<T>(token: Token<T>): boolean {
    return this.registrations.has(token);
  }

  private static verifyRegistrations(registrations: Map<Token<unknown>, Registration<unknown>>) {
    for (const [token, config] of registrations.entries()) {
      const missingDependencies: string[] = [];

      for (const dependency of config.dependencies) {
        if (!registrations.has(dependency)) {
          missingDependencies.push(formatToken(dependency));
        }
      }

      if (missingDependencies.length > 0) {
        throw new Error(
          `Missing dependencies for ${formatToken(token)}: ${missingDependencies.join(', ')}`,
        );
      }
    }
  }

  private static verifyNoCircularDependencies(registrations: Map<Token<unknown>, Registration<unknown>>) {
    const checkCircularDependencies = (
      token: Token<unknown>,
      registration: Registration<unknown>,
      dependencies: string[],
    ) => {
      for (const dependency of registration.dependencies) {
        if (token === dependency) {
          throw new Error(
            `Circular dependency found: ${[
              formatToken(token),
              ...dependencies,
              formatToken(token),
            ].join(' -> ')}`,
          );
        }

        const dependencyRegistration = registrations.get(dependency);
        if (dependencyRegistration && dependencyRegistration.dependencies.length > 0) {
          checkCircularDependencies(token, dependencyRegistration, [
            ...dependencies,
            formatToken(dependency),
          ]);
        }
      }
    };

    for (const [token, config] of registrations.entries()) {
      checkCircularDependencies(token, config, []);
    }
  }

  private createRegistrationFromClass(
    token: Token<unknown>,
    constructor: Constructor<unknown>,
    lifetime?: Lifetime,
  ): Registration<unknown> {
    const registration = new InjectKitRegistration<unknown>(this.metadataRegistry);
    registration.useClass(constructor);

    if (lifetime === 'singleton') {
      registration.asSingleton();
    } else if (lifetime === 'scoped') {
      registration.asScoped();
    } else if (lifetime === 'transient') {
      registration.asTransient();
    }

    return registration.build();
  }

  private createRegistrationFromOverride(override: Override): Registration<unknown> {
    if ('useValue' in override) {
      return {
        constructor: undefined,
        factory: undefined,
        instance: override.useValue,
        lifetime: 'singleton',
        dependencies: [],
        ctorDependencies: [],
        collectionDependencies: undefined,
      };
    }

    if ('useFactory' in override) {
      return {
        constructor: undefined,
        factory: override.useFactory,
        instance: undefined,
        lifetime: override.lifetime ?? 'transient',
        dependencies: [],
        ctorDependencies: [],
        collectionDependencies: undefined,
      };
    }

    return this.createRegistrationFromClass(
      override.token,
      override.useClass,
      override.lifetime,
    );
  }

  private applyDecoratedRegistrations(registrations: Map<Token<unknown>, Registration<unknown>>): void {
    for (const target of this.metadataRegistry.getDecoratedClasses()) {
      const metadata = this.metadataRegistry.getServiceMetadata(target);
      if (!metadata?.injectable) {
        continue;
      }

      const token = metadata.provide ?? target;
      if (registrations.has(token)) {
        continue;
      }

      registrations.set(
        token,
        this.createRegistrationFromClass(token, target as Constructor<unknown>, metadata.lifetime),
      );
    }
  }

  public build(options: BuildOptions = {}): Container {
    const registrations = new Map<Token<unknown>, Registration<unknown>>();

    for (const [token, registration] of this.registrations.entries()) {
      registrations.set(token, registration.build());
    }

    if (options.autoRegisterDecorated) {
      this.applyDecoratedRegistrations(registrations);
    }

    if (!registrations.has(Container)) {
      registrations.set(Container, {
        lifetime: 'singleton',
        dependencies: [],
        ctorDependencies: [],
        collectionDependencies: undefined,
        constructor: undefined,
        factory: (container: Container) => container,
        instance: undefined,
      });
    }

    for (const override of options.overrides ?? []) {
      registrations.set(override.token, this.createRegistrationFromOverride(override));
    }

    InjectKitRegistry.verifyRegistrations(registrations);
    InjectKitRegistry.verifyNoCircularDependencies(registrations);

    return new InjectKitContainer(registrations);
  }
}

/**
 * Creates a registry with the shared metadata registry.
 * @returns A new registry instance.
 */
export const createRegistry = (): InjectKitRegistry => new InjectKitRegistry();

class InjectKitRegistration<T>
  implements RegistrationType<T>, RegistrationLifeTime, RegistrationArray<T>, RegistrationMap<unknown, T>
{
  private ctor: Constructor<T> | undefined = undefined;
  private factory: Factory<T> | undefined = undefined;
  private instance: T | undefined = undefined;
  private collection: Array<Token<T>> | undefined = undefined;
  private map: Map<unknown, Token<T>> | undefined = undefined;
  private lifetime: Lifetime = 'transient';
  private lifetimeConfigured = false;

  constructor(private readonly metadataRegistry: MetadataRegistry) {}

  useClass(constructor: Constructor<T>): RegistrationLifeTime {
    this.ctor = constructor;
    return this;
  }

  useFactory(factory: Factory<T>): RegistrationLifeTime {
    this.factory = factory;
    return this;
  }

  useInstance(instance: T): void {
    this.instance = instance;
    this.lifetime = 'singleton';
    this.lifetimeConfigured = true;
  }

  useArray<U extends ArrayType<T>>(constructor: Constructor<T>): RegistrationArray<U> {
    this.collection = [];
    this.ctor = constructor;
    return this as unknown as RegistrationArray<U>;
  }

  useMap<U extends MapType<T>>(constructor: Constructor<T>): RegistrationMap<U[0], U[1]> {
    this.map = new Map();
    this.ctor = constructor;
    return this as unknown as RegistrationMap<U[0], U[1]>;
  }

  asSingleton(): void {
    this.lifetime = 'singleton';
    this.lifetimeConfigured = true;
  }

  asTransient(): void {
    this.lifetime = 'transient';
    this.lifetimeConfigured = true;
  }

  asScoped(): void {
    this.lifetime = 'scoped';
    this.lifetimeConfigured = true;
  }

  push(token: Token<T>): RegistrationArray<T> {
    this.collection!.push(token);
    return this;
  }

  set(key: unknown, token: Token<T>): RegistrationMap<unknown, T> {
    this.map!.set(key, token);
    return this;
  }

  build(): Registration<T> {
    let ctorDependencies: Token<unknown>[] = [];
    if (this.ctor) {
      ctorDependencies = this.metadataRegistry.getConstructorDependencies(
        this.ctor as unknown as Abstract<unknown>,
      );
    }

    const dependencies = [...ctorDependencies];
    if (this.collection) {
      dependencies.push(...this.collection);
    } else if (this.map) {
      dependencies.push(...Array.from(this.map.values()));
    }

    const lifetime =
      !this.lifetimeConfigured && this.ctor
        ? (this.metadataRegistry.getServiceMetadata(
            this.ctor as unknown as Abstract<unknown>,
          )?.lifetime ?? this.lifetime)
        : this.lifetime;

    return {
      constructor: this.ctor,
      factory: this.factory,
      instance: this.instance,
      lifetime,
      dependencies,
      ctorDependencies,
      collectionDependencies: this.collection ?? this.map,
    };
  }
}
