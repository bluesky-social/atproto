import { DataPlaneClient } from '../data-plane/client'
import { Label } from '../lexicon/types/com/atproto/label/defs'
import { HydrationMap } from './util'

export type { Label } from '../lexicon/types/com/atproto/label/defs'

export type Labels = HydrationMap<Label>

export class ActorHydrator {
  constructor(public dataplane: DataPlaneClient) {}

  async getLabelsForSubjects(subjects: string[]): Promise<Labels> {
    throw new Error('unimplemented')
  }
}
