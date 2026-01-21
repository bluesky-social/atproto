import { Timestamp } from '@bufbuild/protobuf'
import { ServiceImpl } from '@connectrpc/connect'
import { Selectable, sql } from 'kysely'
import {
  AppBskyNotificationDeclaration,
  ChatBskyActorDeclaration,
} from '@atproto/api'
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
    const { dids, returnAgeAssuranceForDids } = req
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
    const notifDeclarationUris = dids.map(
      (did) => `at://${did}/app.bsky.notification.declaration/self`,
    )
    const germDeclarationUris = dids.map(
      (did) => `at://${did}/com.germnetwork.declaration/self`,
    )
    const { ref } = db.db.dynamic
    const [
      handlesRes,
      verificationsReceived,
      profiles,
      statuses,
      chatDeclarations,
      notifDeclarations,
      germDeclarations,
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
      getRecords(db)({ uris: notifDeclarationUris }),
      getRecords(db)({ uris: germDeclarationUris }),
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

      const chatDeclaration = parseRecordBytes<ChatBskyActorDeclaration.Record>(
        chatDeclarations.records[i].record,
      )

      const germDeclaration = germDeclarations.records[i]

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
      const ageAssuranceForDids = new Set(returnAgeAssuranceForDids)

      const activitySubscription = () => {
        const record = parseRecordBytes<AppBskyNotificationDeclaration.Record>(
          notifDeclarations.records[i].record,
        )

        // The dataplane is responsible for setting the default of "followers" (default according to the lexicon).
        const defaultVal = 'followers'

        if (typeof record?.allowSubscriptions !== 'string') {
          return defaultVal
        }

        switch (record.allowSubscriptions) {
          case 'followers':
          case 'mutuals':
          case 'none':
            return record.allowSubscriptions
          default:
            return defaultVal
        }
      }

      const ageAssuranceStatus = () => {
        if (!ageAssuranceForDids.has(did)) {
          return undefined
        }

        const status = row?.ageAssuranceStatus ?? 'unknown'
        let access = row?.ageAssuranceAccess
        if (!access || access === 'unknown') {
          if (status === 'assured') {
            access = 'full'
          } else if (status === 'blocked') {
            access = 'none'
          } else {
            access = 'unknown'
          }
        }

        return {
          lastInitiatedAt: row?.ageAssuranceLastInitiatedAt
            ? Timestamp.fromDate(new Date(row?.ageAssuranceLastInitiatedAt))
            : undefined,
          status,
          access,
        }
      }

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
        germRecord: germDeclaration,
        tags: [],
        profileTags: [],
        allowActivitySubscriptionsFrom: activitySubscription(),
        ageAssuranceStatus: ageAssuranceStatus(),
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
