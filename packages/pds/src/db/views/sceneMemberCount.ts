<<<<<<< Updated upstream
import Database from '..'
import { APP_BSKY_GRAPH } from '../../lexicon'
import { Ref } from '../types'
import { countAll } from '../util'

export const sceneMemberCount = (db: Database, sceneDid: Ref) => {
  return db.db
    .selectFrom('assertion')
    .whereRef('assertion.creator', '=', sceneDid)
    .where('assertion.confirmUri', 'is not', null)
    .where('assertion.assertion', '=', APP_BSKY_GRAPH.AssertMember)
    .select(countAll.as('count'))
}

export default sceneMemberCount
=======
export interface SceneMemberCount {
  did: string
  count: number
}

export const viewName = 'scene_member_count'

export type PartialDB = { [viewName]: SceneMemberCount }
>>>>>>> Stashed changes
