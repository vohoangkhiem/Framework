export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K];
};

export type TypeGuard<T> = (value: unknown) => value is T;

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Parses JSON without throwing; returns `undefined` for invalid input. */
export function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

/** Parses JSON and validates the shape with a type guard, producing a typed value or a clear error. */
export function parseJsonAs<T>(text: string, guard: TypeGuard<T>, label = 'JSON payload'): T {
  const parsed = safeJsonParse(text);
  if (parsed === undefined) {
    throw new SyntaxError(`${label} is not valid JSON: ${text.slice(0, 200)}`);
  }
  if (!guard(parsed)) {
    throw new TypeError(
      `${label} does not match the expected shape: ${JSON.stringify(parsed).slice(0, 200)}`
    );
  }
  return parsed;
}

export function prettyJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

export function deepClone<T>(value: T): T {
  return structuredClone(value);
}

/** Recursively merges `override` into `base` without mutating either argument. */
export function deepMerge<T extends Record<string, unknown>>(base: T, override: DeepPartial<T>): T {
  const result: Record<string, unknown> = { ...base };
  for (const [key, overrideValue] of Object.entries(override)) {
    if (overrideValue === undefined) {
      continue;
    }
    const baseValue = result[key];
    result[key] =
      isRecord(baseValue) && isRecord(overrideValue)
        ? deepMerge(baseValue, overrideValue as DeepPartial<Record<string, unknown>>)
        : overrideValue;
  }
  return result as T;
}

export function pick<T extends object, K extends keyof T>(
  source: T,
  keys: readonly K[]
): Pick<T, K> {
  const result = {} as Pick<T, K>;
  for (const key of keys) {
    if (key in source) {
      result[key] = source[key];
    }
  }
  return result;
}

export function omit<T extends object, K extends keyof T>(
  source: T,
  keys: readonly K[]
): Omit<T, K> {
  const result: Partial<T> = { ...source };
  for (const key of keys) {
    delete result[key];
  }
  return result as Omit<T, K>;
}

/** Reads a nested value using a dotted path such as "Items[0].title" or "data.user.id". */
export function getPath(source: unknown, path: string): unknown {
  const segments = path
    .replace(/\[(\d+)\]/g, '.$1')
    .split('.')
    .filter(Boolean);
  let current: unknown = source;
  for (const segment of segments) {
    if (Array.isArray(current)) {
      current = current[Number(segment)];
    } else if (isRecord(current)) {
      current = current[segment];
    } else {
      return undefined;
    }
  }
  return current;
}

export const JsonUtils = {
  isRecord,
  safeJsonParse,
  parseJsonAs,
  prettyJson,
  deepClone,
  deepMerge,
  pick,
  omit,
  getPath,
} as const;
