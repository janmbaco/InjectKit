import { Container, ScopedContainer, Token } from './interfaces.js';
import { Registration } from './internal.js';
import { formatToken } from './token.js';

/**
 * Implementation of the dependency injection container.
 * Manages service registrations and resolves instances based on their lifetime strategy.
 */
export class InjectKitContainer implements ScopedContainer, Container {
  private readonly instances = new Map<Token<unknown>, unknown>();

  constructor(
    private readonly registrations: Map<Token<unknown>, Registration<unknown>>,
    private readonly parent?: InjectKitContainer,
  ) {}

  private createInstance<T>(token: Token<T>, registration: Registration<T>): T {
    let instance: T;

    if (registration.constructor) {
      const dependencies: unknown[] = [];
      for (const dependency of registration.ctorDependencies || []) {
        dependencies.push(this.get(dependency));
      }

      instance = new registration.constructor(...dependencies);
    } else if (registration.factory) {
      instance = registration.factory(this);
    } else if (registration.instance !== undefined) {
      instance = registration.instance;
    } else {
      throw new Error(`Invalid registration for ${formatToken(token)}`);
    }

    if (registration.collectionDependencies) {
      if (Array.isArray(registration.collectionDependencies) && instance instanceof Array) {
        for (const dependency of registration.collectionDependencies) {
          instance.push(this.get(dependency));
        }
      } else if (registration.collectionDependencies instanceof Map && instance instanceof Map) {
        for (const [key, dependency] of registration.collectionDependencies) {
          instance.set(key, this.get(dependency));
        }
      }
    }

    if (registration.lifetime === 'singleton') {
      let container: InjectKitContainer = this;

      while (container.parent) {
        container = container.parent;
      }

      container.instances.set(token, instance);
    } else if (registration.lifetime === 'scoped') {
      this.instances.set(token, instance);
    }

    return instance;
  }

  private getScopedInstance<T>(token: Token<T>): T {
    const instance = this.instances.get(token) as T;

    if (!instance && this.parent) {
      return this.parent.getScopedInstance(token);
    }

    return instance;
  }

  public get<T>(token: Token<T>): T {
    const registration = this.registrations.get(token) as Registration<T>;
    if (!registration) {
      throw new Error(`Registration for ${formatToken(token)} not found`);
    }

    if (registration.lifetime !== 'transient') {
      const instance = this.getScopedInstance(token);
      if (instance) {
        return instance;
      }
    }

    return this.createInstance(token, registration);
  }

  public hasRegistration<T>(token: Token<T>): boolean {
    return this.registrations.has(token);
  }

  public createScopedContainer(): ScopedContainer {
    return new InjectKitContainer(this.registrations, this);
  }

  public override<T>(token: Token<T>, instance: T): void {
    this.registrations.set(token, {
      constructor: undefined,
      lifetime: 'scoped',
      dependencies: [],
      ctorDependencies: [],
      factory: undefined,
      instance,
      collectionDependencies: undefined,
    });
    this.instances.set(token, instance);
  }
}
