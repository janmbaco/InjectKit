/**
 * Represents a constructor function that can be instantiated with the `new` operator.
 * @template T The type of instance that this constructor creates.
 */
export interface Constructor<T> extends Function {
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  new (...args: any[]): T;
}

/**
 * Represents an abstract class that cannot be directly instantiated.
 * @template T The type of the prototype.
 */
export interface Abstract<T> extends Function {
  prototype: T;
}

/**
 * Runtime token used to register and resolve dependencies.
 * Supports constructors, abstract classes and nominal tokens.
 * @template T The type represented by the token.
 */
export type Token<T> = Constructor<T> | Abstract<T> | string | symbol;

/**
 * Backwards-compatible alias for previous API consumers.
 * @template T The type represented by the token.
 */
export type Identifier<T> = Token<T>;

/**
 * Extracts the element type from an array type.
 * @template T The array type to extract the element type from.
 */
export type ArrayType<T> = T extends Array<infer I> ? I : never;

/**
 * Extracts the key and value types from a map type.
 * @template T The map type to extract the key and value types from.
 */
export type MapType<T> = T extends Map<infer I, infer O> ? [I, O] : never;

/**
 * Defines the lifetime management strategy for a registered service.
 * - 'singleton': One instance shared across the entire container tree
 * - 'transient': A new instance created every time it is requested
 * - 'scoped': One instance per scoped container chain
 */
export type Lifetime = 'singleton' | 'transient' | 'scoped';

/**
 * Dependency injection container that manages the creation and lifetime of registered services.
 */
export abstract class Container {
  /**
   * Retrieves an instance of the specified token from the container.
   * @template T The type of instance to retrieve.
   * @param token The runtime token for the type to resolve.
   * @returns An instance of type T.
   */
  abstract get<T>(token: Token<T>): T;

  /**
   * Creates a new scoped container that inherits all registrations from this container.
   * @returns A new scoped container instance with this container as its parent.
   */
  abstract createScopedContainer(): ScopedContainer;

  /**
   * Checks if a service has a registration with the container.
   * @template T The type of the service to check.
   * @param token The runtime token for the type to check.
   * @returns True if the service has a registration, false otherwise.
   */
  abstract hasRegistration<T>(token: Token<T>): boolean;
}

/**
 * Scoped container that extends the base container with the ability to override registrations.
 */
export type ScopedContainer = Container & {
  /**
   * Overrides the registration for the specified token with a new instance.
   * @template T The type of the instance to override.
   * @param token The runtime token of the registration to override.
   * @param instance The instance to use for the registration.
   */
  override<T>(token: Token<T>, instance: T): void;
};

/**
 * Factory function that creates an instance of type T using the provided container.
 * @template T The type of instance the factory creates.
 * @param container The container to use for resolving dependencies.
 * @returns An instance of type T.
 */
export type Factory<T> = (container: Container) => T;

/**
 * Fluent interface for configuring registration lifetime.
 */
export interface RegistrationLifeTime {
  asSingleton(): void;
  asTransient(): void;
  asScoped(): void;
}

/**
 * Fluent interface for configuring array-based registrations.
 * @template T The element type of the array being registered.
 */
export interface RegistrationArray<T> {
  push(token: Token<T>): RegistrationArray<T>;
}

/**
 * Fluent interface for configuring map-based registrations.
 * @template K The key type of the map being registered.
 * @template V The value type of the map being registered.
 */
export interface RegistrationMap<K, V> {
  set(key: K, token: Token<V>): RegistrationMap<K, V>;
}

/**
 * Fluent interface for specifying how a service should be created.
 * @template T The type being registered.
 */
export interface RegistrationType<T> {
  useClass(constructor: Constructor<T>): RegistrationLifeTime;
  useFactory(factory: Factory<T>): RegistrationLifeTime;
  useInstance(instance: T): void;
  useArray<U extends ArrayType<T>>(constructor: Constructor<T>): RegistrationArray<U>;
  useMap<U extends MapType<T>>(constructor: Constructor<T>): RegistrationMap<U[0], U[1]>;
}

/**
 * Override descriptor used by build() to replace or inject registrations.
 * @template T The type handled by the override.
 */
export type Override<T = unknown> =
  | {
      token: Token<T>;
      useClass: Constructor<T>;
      lifetime?: Lifetime;
    }
  | {
      token: Token<T>;
      useFactory: Factory<T>;
      lifetime?: Lifetime;
    }
  | {
      token: Token<T>;
      useValue: T;
    };

/**
 * Build options used to compose the final container graph.
 */
export interface BuildOptions {
  autoRegisterDecorated?: boolean;
  overrides?: Override[];
}

/**
 * Service registry that manages registrations before building a container.
 */
export interface Registry {
  register<T>(token: Token<T>): RegistrationType<T>;
  registerValue<T>(token: Token<T>, value: T): this;
  registerFactory<T>(token: Token<T>, factory: Factory<T>, lifetime?: Lifetime): this;
  remove<T>(token: Token<T>): void;
  isRegistered<T>(token: Token<T>): boolean;
  build(options?: BuildOptions): Container;
}
