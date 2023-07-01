import { createDeferrable, wait } from '@atproto/common'
import Database from './db'
import { Label } from './db/tables/label'

export class LabelCache {
  bySubject: Record<string, Label[]> = {}
  latestLabel = ''
  defer = createDeferrable()

  destroyed = false

  constructor(public db: Database) {}

  async start() {
    const allLabels = await this.db.db.selectFrom('label').selectAll().execute()
    this.processLabels(allLabels)
    this.poll()
  }

  async poll() {
    if (this.destroyed) return
    const labels = await this.db.db
      .selectFrom('label')
      .selectAll()
      .where('cts', '>', this.latestLabel)
      .execute()
    this.processLabels(labels)
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

  stop() {
    this.destroyed = true
  }

  forSubject(subject: string, includeNeg = false): Label[] {
    const labels = this.bySubject[subject] ?? []
    return includeNeg ? labels : labels.filter((l) => l.neg === 0)
  }

  forSubjects(subjects: string[], includeNeg?: boolean): Label[] {
    let labels: Label[] = []
    for (const subject of subjects) {
      const subLabels = this.forSubject(subject, includeNeg)
      labels = [...labels, ...subLabels]
    }
    return labels
  }
}
