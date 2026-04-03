import { Lifetime, Token } from './interfaces.js';
import { getDefaultMetadataRegistry } from './metadata.js';

const metadataRegistry = getDefaultMetadataRegistry();

const applyServiceMetadata =
  (metadata: { injectable?: boolean; lifetime?: Lifetime; provide?: Token<unknown> }): ClassDecorator =>
  <TFunction extends Function>(target: TFunction): TFunction => {
    metadataRegistry.defineServiceMetadata(target, {
      ...metadata,
      injectable: metadata.injectable ?? true,
    });

    return target;
  };

/**
 * Marks a class as injectable and eligible for metadata-driven registration.
 * @returns A class decorator that marks the class as injectable.
 */
export const Injectable = (): ClassDecorator => applyServiceMetadata({ injectable: true });

/**
 * Marks a class as injectable with singleton lifetime by default.
 * @returns A class decorator that marks the class as a singleton.
 */
export const Singleton = (): ClassDecorator =>
  applyServiceMetadata({ injectable: true, lifetime: 'singleton' });

/**
 * Marks a class as injectable with scoped lifetime by default.
 * @returns A class decorator that marks the class as scoped.
 */
export const Scoped = (): ClassDecorator =>
  applyServiceMetadata({ injectable: true, lifetime: 'scoped' });

/**
 * Marks a class as injectable with transient lifetime by default.
 * @returns A class decorator that marks the class as transient.
 */
export const Transient = (): ClassDecorator =>
  applyServiceMetadata({ injectable: true, lifetime: 'transient' });

/**
 * Declares the token satisfied by the decorated implementation.
 * @param token The token provided by the decorated class.
 * @returns A class decorator that associates the class with the token.
 */
export const Provides = (token: Token<unknown>): ClassDecorator =>
  applyServiceMetadata({ injectable: true, provide: token });
