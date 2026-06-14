import { ServiceImpl } from '@connectrpc/connect'
import { keyBy } from '@atproto/common'
import { Service } from '../../../proto/sokaa_connect'
import { Database } from '../db'

export default (db: Database): Partial<ServiceImpl<typeof Service>> => ({
  async getLikesByActorAndSubjects(req) {
    const { actorDid, refs } = req
    if (refs.length === 0) {
      return { uris: [] }
    }
    const res = await db.db
      .selectFrom('like')
      .where('creator', '=', actorDid)
      .where(
        'subject',
        'in',
        refs.map(({ uri }) => uri),
      )
      .selectAll()
      .execute()
    const bySubject = keyBy(res, 'subject')
    return {
      uris: refs.map(({ uri }) => bySubject.get(uri)?.uri ?? ''),
    }
  },

  async getActorFollowsActors(req) {
    const { actorDid, targetDids } = req
    if (targetDids.length === 0) {
      return { uris: [] }
    }
    const res = await db.db
      .selectFrom('follow')
      .where('creator', '=', actorDid)
      .where('subjectDid', 'in', targetDids)
      .selectAll()
      .execute()
    const bySubject = keyBy(res, 'subjectDid')
    return {
      uris: targetDids.map((did) => bySubject.get(did)?.uri ?? ''),
    }
  },
})
