/**
 * Lightweight structured logger with no third-party dependency.
 *
 * Design decisions:
 * - Levels and format are driven by LOG_LEVEL / LOG_FORMAT so CI can emit JSON lines
 *   for log aggregation while developers keep readable output locally.
 * - Every entry is also kept in an in-memory store shared by child loggers, which the
 *   `logger` fixture attaches to the Playwright report when a test fails.
 * - Secrets are never logged: `redact()` masks values and `sanitize()` masks well-known
 *   sensitive keys inside structured payloads.
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';
export type LogFormat = 'pretty' | 'json';
export type LogContext = Record<string, string | number | boolean | undefined>;

export interface LogEntry {
  timestamp: string;
  level: Exclude<LogLevel, 'silent'>;
  message: string;
  context: LogContext;
  data?: unknown;
}

export interface LoggerOptions {
  level?: LogLevel;
  format?: LogFormat;
  context?: LogContext;
  /** Optional custom sink (e.g. a file writer). Defaults to the console. */
  sink?: (line: string, entry: LogEntry) => void;
}

const LEVEL_WEIGHT: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  silent: 100,
};

const SENSITIVE_KEY_PATTERN = /pass(word)?|secret|token|authorization|api[-_]?key|cookie/i;
const MAX_STORED_ENTRIES = 2000;

interface EntryStore {
  entries: LogEntry[];
}

export class Logger {
  private readonly level: LogLevel;
  private readonly format: LogFormat;
  private readonly context: LogContext;
  private readonly sink: (line: string, entry: LogEntry) => void;
  private readonly store: EntryStore;

  private constructor(
    options: Required<Omit<LoggerOptions, 'sink'>> & Pick<LoggerOptions, 'sink'>,
    store: EntryStore
  ) {
    this.level = options.level;
    this.format = options.format;
    this.context = options.context;
    this.sink = options.sink ?? consoleSink;
    this.store = store;
  }

  static create(options: LoggerOptions = {}): Logger {
    return new Logger(
      {
        level: options.level ?? Logger.levelFromEnv(),
        format: options.format ?? Logger.formatFromEnv(),
        context: options.context ?? {},
        sink: options.sink,
      },
      { entries: [] }
    );
  }

  /** Creates a logger that inherits settings and shares the entry store with its parent. */
  child(context: LogContext): Logger {
    return new Logger(
      {
        level: this.level,
        format: this.format,
        context: { ...this.context, ...context },
        sink: this.sink,
      },
      this.store
    );
  }

  get entries(): readonly LogEntry[] {
    return this.store.entries;
  }

  clearEntries(): void {
    this.store.entries.length = 0;
  }

  debug(message: string, data?: unknown): void {
    this.log('debug', message, data);
  }

  info(message: string, data?: unknown): void {
    this.log('info', message, data);
  }

  warn(message: string, data?: unknown): void {
    this.log('warn', message, data);
  }

  error(message: string, data?: unknown): void {
    this.log('error', message, data);
  }

  /** Runs an async operation and logs its duration; rethrows on failure after logging. */
  async time<T>(label: string, operation: () => Promise<T>): Promise<T> {
    const started = Date.now();
    try {
      const result = await operation();
      this.debug(`${label} completed`, { durationMs: Date.now() - started });
      return result;
    } catch (error) {
      this.error(`${label} failed`, { durationMs: Date.now() - started, error: String(error) });
      throw error;
    }
  }

  /** Renders all stored entries as text, ready to be attached to a test report. */
  dump(): string {
    return this.store.entries.map(entry => this.render(entry)).join('\n');
  }

  isEnabled(level: LogLevel): boolean {
    return LEVEL_WEIGHT[level] >= LEVEL_WEIGHT[this.level];
  }

  /** Masks a secret, keeping only a short prefix to aid debugging. */
  static redact(value: string | undefined, visibleChars = 2): string {
    if (!value) {
      return '<empty>';
    }
    return value.length <= visibleChars ? '***' : `${value.slice(0, visibleChars)}***`;
  }

  /** Recursively masks values whose key looks sensitive. */
  static sanitize(value: unknown): unknown {
    if (Array.isArray(value)) {
      return value.map(item => Logger.sanitize(item));
    }
    if (value !== null && typeof value === 'object') {
      const result: Record<string, unknown> = {};
      for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
        result[key] = SENSITIVE_KEY_PATTERN.test(key)
          ? Logger.redact(typeof nested === 'string' ? nested : JSON.stringify(nested))
          : Logger.sanitize(nested);
      }
      return result;
    }
    return value;
  }

  private log(level: Exclude<LogLevel, 'silent'>, message: string, data?: unknown): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context: this.context,
      ...(data === undefined ? {} : { data: Logger.sanitize(data) }),
    };

    if (this.store.entries.length >= MAX_STORED_ENTRIES) {
      this.store.entries.shift();
    }
    this.store.entries.push(entry);

    if (this.isEnabled(level)) {
      this.sink(this.render(entry), entry);
    }
  }

  private render(entry: LogEntry): string {
    if (this.format === 'json') {
      return JSON.stringify(entry);
    }
    const contextText = Object.entries(entry.context)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => `${key}=${String(value)}`)
      .join(' ');
    const dataText = entry.data === undefined ? '' : ` ${JSON.stringify(entry.data)}`;
    return `${entry.timestamp} [${entry.level.toUpperCase().padEnd(5)}]${contextText ? ` [${contextText}]` : ''} ${entry.message}${dataText}`;
  }

  private static levelFromEnv(): LogLevel {
    const raw = process.env.LOG_LEVEL?.toLowerCase();
    return raw !== undefined && raw in LEVEL_WEIGHT ? (raw as LogLevel) : 'info';
  }

  private static formatFromEnv(): LogFormat {
    return process.env.LOG_FORMAT?.toLowerCase() === 'json' ? 'json' : 'pretty';
  }
}

function consoleSink(line: string, entry: LogEntry): void {
  switch (entry.level) {
    case 'error':
      console.error(line);
      break;
    case 'warn':
      console.warn(line);
      break;
    case 'debug':
    case 'info':
      console.log(line);
      break;
  }
}

/** Process-wide logger for framework internals (config loading, global hooks, API clients). */
export const logger = Logger.create({ context: { scope: 'framework' } });
