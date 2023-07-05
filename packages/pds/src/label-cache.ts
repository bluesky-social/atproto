import { createDeferrable, wait } from '@atproto/common'
import Database from './db'
import { Label } from './db/tables/label'

export class LabelCache {
  bySubject: Record<string, Label[]> = {}
  latestLabel = ''
  defer = createDeferrable()
  refreshes = 0

  destroyed = false

  constructor(public db: Database) {}

  async start() {
    await this.fullRefresh()
    this.poll()
  }

  async fullRefresh() {
    const allLabels = await this.db.db.selectFrom('label').selectAll().execute()
    this.wipeCache()
    this.processLabels(allLabels)
  }

  async partialRefresh() {
    const labels = await this.db.db
      .selectFrom('label')
      .selectAll()
      .where('cts', '>', this.latestLabel)
      .execute()
    this.processLabels(labels)
  }

  async poll() {
    if (this.destroyed) return
    if (this.refreshes >= 120) {
      await this.fullRefresh()
      this.refreshes = 0
    } else {
      await this.partialRefresh()
      this.refreshes++
    }
    this.defer = createDeferrable()
    await wait(500)
    this.poll()
  }

  async catchUp() {
    await this.defer.complete
  }

  processLabels(labels: Label[]) {
    for (const label of labels) {
      if (label.cts > this.latestLabel) {
        this.latestLabel = label.cts
      }
      this.bySubject[label.uri] ??= []
      this.bySubject[label.uri].push(label)
    }
    this.defer.resolve()
  }

  wipeCache() {
    this.bySubject = {}
  }

  stop() {
    this.destroyed = true
  }

  forSubject(subject: string, includeNeg = false): Label[] {
    const labels = this.bySubject[subject] ?? []
    return includeNeg ? labels : labels.filter((l) => l.neg === 0)
  }

  forSubjects(subjects: string[], includeNeg?: boolean): Label[] {
    let labels: Label[] = []
    const alreadyAdded = new Set<string>()
    for (const subject of subjects) {
      if (alreadyAdded.has(subject)) {
        continue
      }
      const subLabels = this.forSubject(subject, includeNeg)
      labels = [...labels, ...subLabels]
      alreadyAdded.add(subject)
    }
    return labels
  }
}
