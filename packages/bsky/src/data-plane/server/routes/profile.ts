import { Timestamp } from '@bufbuild/protobuf'
import { ServiceImpl } from '@connectrpc/connect'
import { Selectable, sql } from 'kysely'
import { keyBy } from '@atproto/common'
import { parseRecordBytes } from '../../../hydration/util'
import { Service } from '../../../proto/bsky_connect'
import { VerificationMeta } from '../../../proto/bsky_pb'
import { Database } from '../db'
import { Verification } from '../db/tables/verification'
import { getRecords } from './records'

type VerifiedBy = {
  [handle: string]: Pick<
    VerificationMeta,
    'rkey' | 'handle' | 'displayName' | 'sortedAt'
  >
}

export default (db: Database): Partial<ServiceImpl<typeof Service>> => ({
  async getActors(req) {
    const { dids } = req
    if (dids.length === 0) {
      return { actors: [] }
    }
    const profileUris = dids.map(
      (did) => `at://${did}/app.bsky.actor.profile/self`,
    )
    const statusUris = dids.map(
      (did) => `at://${did}/app.bsky.actor.status/self`,
    )
    const chatDeclarationUris = dids.map(
      (did) => `at://${did}/chat.bsky.actor.declaration/self`,
    )
    const { ref } = db.db.dynamic
    const [
      handlesRes,
      verificationsReceived,
      profiles,
      statuses,
      chatDeclarations,
    ] = await Promise.all([
      db.db
        .selectFrom('actor')
        .leftJoin('actor_state', 'actor_state.did', 'actor.did')
        .where('actor.did', 'in', dids)
        .selectAll('actor')
        .select('actor_state.priorityNotifs')
        .select([
          db.db
            .selectFrom('labeler')
            .whereRef('creator', '=', ref('actor.did'))
            .select(sql<true>`${true}`.as('val'))
            .as('isLabeler'),
        ])
        .execute(),
      db.db
        .selectFrom('verification')
        .selectAll('verification')
        .innerJoin('actor', 'actor.did', 'verification.creator')
        .where('verification.subject', 'in', dids)
        .where('actor.trustedVerifier', '=', true)
        .orderBy('sortedAt', 'asc')
        .execute(),
      getRecords(db)({ uris: profileUris }),
      getRecords(db)({ uris: statusUris }),
      getRecords(db)({ uris: chatDeclarationUris }),
    ])

    const verificationsBySubjectDid = verificationsReceived.reduce(
      (acc, cur) => {
        const list = acc.get(cur.subject) ?? []
        list.push(cur)
        acc.set(cur.subject, list)
        return acc
      },
      new Map<string, Selectable<Verification>[]>(),
    )

    const byDid = keyBy(handlesRes, 'did')
    const actors = dids.map((did, i) => {
      const row = byDid.get(did)

      const status = statuses.records[i]

      const chatDeclaration = parseRecordBytes(
        chatDeclarations.records[i].record,
      )

      const verifications = verificationsBySubjectDid.get(did) ?? []
      const verifiedBy: VerifiedBy = verifications.reduce((acc, cur) => {
        acc[cur.creator] = {
          rkey: cur.rkey,
          handle: cur.handle,
          displayName: cur.displayName,
          sortedAt: Timestamp.fromDate(new Date(cur.sortedAt)),
        }
        return acc
      }, {} as VerifiedBy)

      return {
        exists: !!row,
        handle: row?.handle ?? undefined,
        profile: profiles.records[i],
        takenDown: !!row?.takedownRef,
        takedownRef: row?.takedownRef || undefined,
        tombstonedAt: undefined, // in current implementation, tombstoned actors are deleted
        labeler: row?.isLabeler ?? false,
        allowIncomingChatsFrom:
          typeof chatDeclaration?.['allowIncoming'] === 'string'
            ? chatDeclaration['allowIncoming']
            : undefined,
        upstreamStatus: row?.upstreamStatus ?? '',
        createdAt: profiles.records[i].createdAt, // @NOTE profile creation date not trusted in production
        priorityNotifications: row?.priorityNotifs ?? false,
        trustedVerifier: row?.trustedVerifier ?? false,
        verifiedBy,
        statusRecord: status,
        tags: [],
        profileTags: [],
      }
    })
    return { actors }
  },

  // @TODO handle req.lookupUnidirectional w/ networked handle resolution
  async getDidsByHandles(req) {
    const { handles } = req
    if (handles.length === 0) {
      return { dids: [] }
    }
    const res = await db.db
      .selectFrom('actor')
      .where('handle', 'in', handles)
      .selectAll()
      .execute()
    const byHandle = keyBy(res, 'handle')
    const dids = handles.map((handle) => byHandle.get(handle)?.did ?? '')
    return { dids }
  },

  async updateActorUpstreamStatus(req) {
    const { actorDid, upstreamStatus } = req
    await db.db
      .updateTable('actor')
      .set({ upstreamStatus })
      .where('did', '=', actorDid)
      .execute()
  },
})
