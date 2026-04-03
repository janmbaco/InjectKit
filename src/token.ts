import { Token } from './interfaces.js';

/**
 * Formats a runtime token into a readable string for diagnostics.
 * @param token The token to format.
 * @returns A stable readable representation of the token.
 */
export const formatToken = (token: Token<unknown>): string => {
  if (typeof token === 'string') {
    return token;
  }

  if (typeof token === 'symbol') {
    return token.description ? `Symbol(${token.description})` : token.toString();
  }

  return token.name || '<anonymous>';
};
