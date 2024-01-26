import { DataPlaneClient } from '../data-plane/client'
import { Label } from '../lexicon/types/com/atproto/label/defs'
import { HydrationMap, parseJsonBytes } from './util'

export type { Label } from '../lexicon/types/com/atproto/label/defs'

export type Labels = HydrationMap<Label[]>

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
    if (!subjects.length || !issuers.length) return new HydrationMap<Label[]>()
    const res = await this.dataplane.getLabels({ subjects, issuers })
    return res.labels.reduce((acc, cur) => {
      const label = parseJsonBytes(cur) as Label | undefined
      if (!label || label.neg) return acc
      const entry = acc.get(label.uri)
      if (entry) {
        entry.push(label)
      } else {
        acc.set(label.uri, [label])
      }
      return acc
    }, new HydrationMap<Label[]>())
  }
}
