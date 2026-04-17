import { Lifetime, Token } from './interfaces.js';
import { getDefaultMetadataRegistry } from './metadata.js';

const metadataRegistry = getDefaultMetadataRegistry();

export interface ServiceDecoratorOptions {
  deps?: readonly Token<unknown>[];
}

type ServiceMetadataOptions = ServiceDecoratorOptions & {
  injectable?: boolean;
  lifetime?: Lifetime;
  provide?: Token<unknown>;
};

const applyServiceMetadata =
  (metadata: ServiceMetadataOptions = {}): ClassDecorator =>
  <TFunction extends Function>(target: TFunction): TFunction => {
    metadataRegistry.defineServiceMetadata(target, {
      ...metadata,
      deps: metadata.deps ? [...metadata.deps] : undefined,
      injectable: metadata.injectable ?? true,
    });

    return target;
  };

/**
 * Marks a class as injectable and eligible for metadata-driven registration.
 * @returns A class decorator that marks the class as injectable.
 */
export const Injectable = (
  options: ServiceDecoratorOptions = {},
): ClassDecorator => applyServiceMetadata({ injectable: true, ...options });

/**
 * Marks a class as injectable with singleton lifetime by default.
 * @returns A class decorator that marks the class as a singleton.
 */
export const Singleton = (
  options: ServiceDecoratorOptions = {},
): ClassDecorator =>
  applyServiceMetadata({ injectable: true, lifetime: 'singleton', ...options });

/**
 * Marks a class as injectable with scoped lifetime by default.
 * @returns A class decorator that marks the class as scoped.
 */
export const Scoped = (
  options: ServiceDecoratorOptions = {},
): ClassDecorator =>
  applyServiceMetadata({ injectable: true, lifetime: 'scoped', ...options });

/**
 * Marks a class as injectable with transient lifetime by default.
 * @returns A class decorator that marks the class as transient.
 */
export const Transient = (
  options: ServiceDecoratorOptions = {},
): ClassDecorator =>
  applyServiceMetadata({ injectable: true, lifetime: 'transient', ...options });

/**
 * Declares the token satisfied by the decorated implementation.
 * @param token The token provided by the decorated class.
 * @returns A class decorator that associates the class with the token.
 */
export const Provider = (
  token: Token<unknown>,
  options: ServiceDecoratorOptions = {},
): ClassDecorator =>
  applyServiceMetadata({ injectable: true, provide: token, ...options });
