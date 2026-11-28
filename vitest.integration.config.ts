import { writeFileSync } from 'node:fs'
import { relative } from 'node:path'
import { defineConfig } from 'vitest/config'
import {
  BaseSequencer,
  type Reporter,
  type TestModule,
  type TestSpecification,
  type Vitest,
} from 'vitest/node'
import durations from './vitest.integration.durations.json' with { type: 'json' }

// Packages whose tests need dev-infra (postgres & redis). "pnpm
// test:integration" runs them all in a single vitest process so that a CI
// shard (--shard) spreads every package's files over the same workers, instead
// of each package sharding (and running) on its own and the shard waiting on
// the slowest one.
//
// A package added here must not set "maxWorkers" (or disable file
// parallelism): vitest refuses to pool projects that disagree on it.

const recorded: Record<string, number | undefined> = durations
const known = Object.values(durations).sort((a, b) => a - b)
const median = known[Math.floor(known.length / 2)] ?? 1
// The recorded durations leave out each file's import and setup, which every
// file pays (an isolated one about a second). Without it, the many near-zero
// files would all go to the same shard.
const perFile = 1

/**
 * Shards by recorded duration rather than by file count, so that every shard
 * gets about the same amount of work. Durations (in seconds) come from a CI
 * run: refresh them with `node scripts/update-test-durations.mjs <run-id>`.
 * Files without a recorded duration count as the median. The assignment only
 * depends on the list of files, so every shard computes the same one.
 */
class DurationSequencer extends BaseSequencer {
  path(spec: TestSpecification): string {
    return relative(this.ctx.config.root, spec.moduleId)
  }

  duration(spec: TestSpecification): number {
    return (recorded[this.path(spec)] ?? median) + perFile
  }

  async shard(files: TestSpecification[]): Promise<TestSpecification[]> {
    const { index, count } = this.ctx.config.shard!
    const key = (spec: TestSpecification) =>
      `${this.path(spec)}\0${spec.project.name}`
    const sorted = [...files].sort(
      (a, b) =>
        this.duration(b) - this.duration(a) || (key(a) < key(b) ? -1 : 1),
    )
    // Longest first, each to the shard with the least work so far.
    const totals = new Array<number>(count).fill(0)
    const shards = Array.from(
      { length: count },
      () => [] as TestSpecification[],
    )
    for (const spec of sorted) {
      const i = totals.indexOf(Math.min(...totals))
      shards[i].push(spec)
      totals[i] += this.duration(spec)
    }
    return shards[index - 1]
  }

  async sort(files: TestSpecification[]): Promise<TestSpecification[]> {
    // Keep vitest's project grouping (a worker only reuses its module graph for
    // files of the same project), and run the longest files first within each.
    return [...files].sort(
      (a, b) =>
        a.project.config.sequence.groupOrder -
          b.project.config.sequence.groupOrder ||
        (a.project.name === b.project.name
          ? 0
          : a.project.name < b.project.name
            ? -1
            : 1) ||
        Number(b.project.config.isolate) - Number(a.project.config.isolate) ||
        this.duration(b) - this.duration(a),
    )
  }
}

/**
 * Writes each file's duration (tests and hooks, as the default reporter prints
 * it) to the file named by VITEST_DURATIONS, in the format of
 * vitest.integration.durations.json. CI uploads it from every shard.
 */
class DurationsReporter implements Reporter {
  #root = ''

  constructor(readonly file: string) {}

  onInit(vitest: Vitest) {
    this.#root = vitest.config.root
  }

  onTestRunEnd(testModules: ReadonlyArray<TestModule>) {
    const entries = testModules.map((testModule) => [
      relative(this.#root, testModule.moduleId),
      Math.round(testModule.diagnostic().duration / 100) / 10,
    ])
    writeFileSync(
      this.file,
      `${JSON.stringify(Object.fromEntries(entries), null, 2)}\n`,
    )
  }
}

const durationsFile = process.env.VITEST_DURATIONS

export default defineConfig({
  test: {
    reporters: durationsFile
      ? ['default', new DurationsReporter(durationsFile)]
      : ['default'],
    projects: [
      'packages/bsky',
      'packages/bsync',
      'packages/ozone',
      'packages/pds',
    ],
    sequence: { sequencer: DurationSequencer },
  },
})
