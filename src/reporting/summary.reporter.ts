import fs from 'node:fs';
import path from 'node:path';
import type { FullConfig, FullResult, Reporter, Suite, TestCase } from '@playwright/test/reporter';
import { describeConfig } from '../config/environment';
import { DateUtils } from '../utils/date-utils';

export interface SummaryReporterOptions {
  /** Markdown file to write (parent folders are created). Skipped when omitted. */
  outputFile?: string;
  /** Maximum number of failing tests listed individually. Defaults to 25. */
  maxFailures?: number;
}

interface ProjectSummary {
  passed: number;
  failed: number;
  flaky: number;
  skipped: number;
  durationMs: number;
}

interface RunSummary {
  byProject: Map<string, ProjectSummary>;
  totals: ProjectSummary;
  failures: string[];
}

const STATUS_LABEL: Record<FullResult['status'], string> = {
  passed: 'PASSED',
  failed: 'FAILED',
  timedout: 'TIMED OUT',
  interrupted: 'INTERRUPTED',
};

function emptySummary(): ProjectSummary {
  return { passed: 0, failed: 0, flaky: 0, skipped: 0, durationMs: 0 };
}

/**
 * Compact run summary for humans and CI dashboards: a per-project table printed to the console,
 * written as Markdown next to the other artifacts and appended to the GitHub Actions job summary
 * when available. It complements the HTML report (which stays the place for traces and steps).
 *
 * Registered in playwright.config.ts as `['./src/reporting/summary.reporter.ts', options]`.
 */
class SummaryReporter implements Reporter {
  private readonly outputFile: string | undefined;
  private readonly maxFailures: number;
  private config: FullConfig | undefined;
  private suite: Suite | undefined;

  constructor(options: SummaryReporterOptions = {}) {
    this.outputFile = options.outputFile;
    this.maxFailures = options.maxFailures ?? 25;
  }

  printsToStdio(): boolean {
    return true;
  }

  onBegin(config: FullConfig, suite: Suite): void {
    this.config = config;
    this.suite = suite;
  }

  onEnd(result: FullResult): void {
    const tests = this.suite?.allTests() ?? [];
    // `--list` invokes reporters without executing anything; a table of "skipped" tests there
    // would be noise, so only summarise runs in which at least one test produced a result.
    if (!tests.some(test => test.results.length > 0)) {
      return;
    }

    const markdown = this.render(this.collect(tests), result);
    console.log(`\n${markdown}\n`);

    if (this.outputFile) {
      fs.mkdirSync(path.dirname(this.outputFile), { recursive: true });
      fs.writeFileSync(this.outputFile, `${markdown}\n`, 'utf8');
    }
    const stepSummary = process.env.GITHUB_STEP_SUMMARY;
    if (stepSummary) {
      fs.appendFileSync(stepSummary, `${markdown}\n`, 'utf8');
    }
  }

  private collect(tests: readonly TestCase[]): RunSummary {
    const byProject = new Map<string, ProjectSummary>();
    const failures: string[] = [];

    for (const test of tests) {
      const projectName = test.parent.project()?.name ?? '(no project)';
      const entry = byProject.get(projectName) ?? emptySummary();
      entry.durationMs += test.results.reduce((total, run) => total + run.duration, 0);
      switch (test.outcome()) {
        case 'expected':
          entry.passed += 1;
          break;
        case 'unexpected':
          entry.failed += 1;
          failures.push(`${projectName} > ${SummaryReporter.testTitle(test, projectName)}`);
          break;
        case 'flaky':
          entry.flaky += 1;
          break;
        case 'skipped':
          entry.skipped += 1;
          break;
      }
      byProject.set(projectName, entry);
    }

    const totals = emptySummary();
    for (const entry of byProject.values()) {
      totals.passed += entry.passed;
      totals.failed += entry.failed;
      totals.flaky += entry.flaky;
      totals.skipped += entry.skipped;
      totals.durationMs += entry.durationMs;
    }
    return { byProject, totals, failures };
  }

  private render(summary: RunSummary, result: FullResult): string {
    const { environment, baseUrl } = describeConfig();
    const shard = this.config?.shard;
    const scope = shard ? ` | Shard ${shard.current}/${shard.total}` : '';
    const row = (name: string, entry: ProjectSummary): string =>
      `| ${name} | ${entry.passed} | ${entry.failed} | ${entry.flaky} | ${entry.skipped} | ${DateUtils.humanizeDuration(entry.durationMs)} |`;

    const lines = [
      `## Playwright run: ${STATUS_LABEL[result.status]}`,
      '',
      `Environment **${String(environment)}** | ${String(baseUrl)} | Wall time ${DateUtils.humanizeDuration(result.duration)}${scope}`,
      '',
      '| Project | Passed | Failed | Flaky | Skipped | Test time |',
      '| --- | ---: | ---: | ---: | ---: | ---: |',
      ...Array.from(summary.byProject, ([name, entry]) => row(name, entry)),
      row('**Total**', summary.totals),
    ];

    if (summary.failures.length > 0) {
      lines.push('', `### Failed tests (${summary.failures.length})`, '');
      lines.push(...summary.failures.slice(0, this.maxFailures).map(title => `- ${title}`));
      if (summary.failures.length > this.maxFailures) {
        lines.push(`- ... and ${summary.failures.length - this.maxFailures} more`);
      }
    }
    return lines.join('\n');
  }

  /** "file > describe > title" without the root and project segments of `titlePath()`. */
  private static testTitle(test: TestCase, projectName: string): string {
    const [, maybeProject, ...rest] = test.titlePath();
    const parts = maybeProject === projectName ? rest : [maybeProject ?? '', ...rest];
    return parts.filter(part => part.length > 0).join(' > ');
  }
}

export default SummaryReporter;
