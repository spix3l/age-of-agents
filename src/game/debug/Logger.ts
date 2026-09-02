export type LogCategory = 'ai' | 'combat' | 'economy' | 'sim';
export type LogLevel = 'info' | 'warn';

export interface LogEntry {
  readonly at: number;
  readonly category: LogCategory;
  readonly level: LogLevel;
  readonly message: string;
}

export interface LoggerOptions {
  readonly categories?: readonly LogCategory[];
  readonly capacity?: number;
  readonly sink?: ((entry: LogEntry) => void) | null;
}

/**
 * Structured, category-filtered log with a bounded buffer. The console sink is opt-in so an
 * unattended soak run never floods the browser or the test reporter.
 */
export class Logger {
  private enabled: Set<LogCategory>;
  private readonly entries: LogEntry[] = [];
  private readonly capacity: number;
  private sink: ((entry: LogEntry) => void) | null;

  constructor(options: LoggerOptions = {}) {
    this.enabled = new Set(options.categories ?? []);
    this.capacity = options.capacity ?? 200;
    this.sink = options.sink ?? null;
  }

  isEnabled(category: LogCategory): boolean { return this.enabled.has(category); }
  setCategories(categories: readonly LogCategory[]): void { this.enabled = new Set(categories); }
  setSink(sink: ((entry: LogEntry) => void) | null): void { this.sink = sink; }
  get history(): readonly LogEntry[] { return this.entries; }

  log(category: LogCategory, at: number, message: string, level: LogLevel = 'info'): void {
    if (!this.enabled.has(category)) return;
    const entry: LogEntry = { at, category, level, message };
    this.entries.push(entry);
    if (this.entries.length > this.capacity) this.entries.shift();
    this.sink?.(entry);
  }

  clear(): void { this.entries.length = 0; }
}
