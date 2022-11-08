import Database from '..'
import { APP_BSKY_GRAPH } from '../../lexicon'
import { Ref } from '../types'
import { countAll } from '../util'

export const upvoteCountFromScene = (db: Database, sceneDid: Ref) => {
  return db.db
    .selectFrom('assertion')
    .whereRef('assertion.creator', '=', sceneDid)
    .where('assertion.confirmUri', 'is not', null)
    .where('assertion.assertion', '=', APP_BSKY_GRAPH.AssertMember)
    .innerJoin('vote', 'vote.creator', 'assertion.subjectDid')
    .where('vote.direction', '=', 'up')
    .groupBy(['vote.subject'])
    .select(countAll.as('count'))
}

export default upvoteCountFromScene
