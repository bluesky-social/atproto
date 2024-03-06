import { DataPlaneClient } from '../data-plane/client'
import { Label } from '../lexicon/types/com/atproto/label/defs'
import { HydrationMap, parseJsonBytes } from './util'

export type { Label } from '../lexicon/types/com/atproto/label/defs'

export type SubjectLabels = {
  isTakendown: boolean
  labels: Label[]
}

export type Labels = HydrationMap<SubjectLabels>

export class LabelHydrator {
  constructor(
    public dataplane: DataPlaneClient,
    public opts?: { labelsFromIssuerDids?: string[] },
  ) {}

  async getLabelsForSubjects(
    subjects: string[],
    issuers?: string[],
  ): Promise<Labels> {
    issuers = ([] as string[])
      .concat(issuers ?? [])
      .concat(this.opts?.labelsFromIssuerDids ?? [])
    if (!subjects.length || !issuers.length)
      return new HydrationMap<SubjectLabels>()
    const res = await this.dataplane.getLabels({ subjects, issuers })
    return res.labels.reduce((acc, cur) => {
      const label = parseJsonBytes(cur) as Label | undefined
      if (!label || label.neg) return acc
      let entry = acc.get(label.uri)
      if (!entry) {
        entry = {
          isTakendown: false,
          labels: [],
        }
        acc.set(label.uri, entry)
      }
      entry.labels.push(label)
      if (TAKEDOWN_LABELS.includes(label.val) && !label.neg) {
        entry.isTakendown = true
      }
      return acc
    }, new HydrationMap<SubjectLabels>())
  }
}

const TAKEDOWN_LABELS = ['!takedown', '!suspend']
