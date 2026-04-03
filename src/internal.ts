import { Constructor, Factory, Lifetime, Token } from './interfaces.js';

/**
 * Internal representation of a service registration in the container.
 * Contains all the information needed to resolve and create instances of the service.
 * @template T The type being registered.
 * @internal
 */
export type Registration<T> = {
  constructor?: Constructor<T>;
  factory?: Factory<T>;
  instance?: T;
  lifetime: Lifetime;
  dependencies: Token<unknown>[];
  ctorDependencies: Token<unknown>[];
  collectionDependencies?: Array<Token<unknown>> | Map<unknown, Token<unknown>>;
};
