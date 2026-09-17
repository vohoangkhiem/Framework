import { ConfigurationError } from '../core/errors';

/**
 * Loads a driver that is intentionally NOT part of the framework's dependencies.
 * Database drivers are heavy and project specific, so each team installs only the one it
 * needs; a missing driver produces an actionable error instead of a cryptic module failure.
 */
export async function loadOptionalModule<T>(moduleName: string, installHint: string): Promise<T> {
  try {
    const loaded: unknown = await import(moduleName);
    return loaded as T;
  } catch (error) {
    throw new ConfigurationError(
      `Optional dependency "${moduleName}" is not installed. ${installHint}`,
      { cause: error }
    );
  }
}
