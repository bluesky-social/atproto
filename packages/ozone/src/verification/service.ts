import type { Selectable } from 'kysely'
import {
  type $Typed,
  type AtUriString,
  type DatetimeString,
  type DidString,
  asUnknown$TypedObject,
  currentDatetimeString,
} from '@atproto/lex'
import { AtUri } from '@atproto/syntax'
import type { Database } from '../db/index.js'
import { CreatedAtUriKeyset, paginate } from '../db/pagination.js'
import type { Verification } from '../db/schema/verification.js'
import { app, tools } from '../lexicons/index.js'

export type VerificationServiceCreator = (db: Database) => VerificationService

export class VerificationService {
  constructor(public db: Database) {}

  static creator() {
    return (db: Database) => new VerificationService(db)
  }

  async create(
    verifications: Pick<
      Verification,
      | 'uri'
      | 'issuer'
      | 'subject'
      | 'handle'
      | 'displayName'
      | 'createdAt'
      | 'cid'
    >[],
  ) {
    return this.db.transaction(async (tx) => {
      return tx.db
        .insertInto('verification')
        .values(verifications)
        .onConflict((oc) => oc.doNothing())
        .returningAll()
        .execute()
    })
  }

  async markRevoked({
    uris,
    revokedBy,
    revokedAt,
    revokeReason,
  }: {
    uris: AtUriString[]
    revokedBy?: DidString
    revokedAt?: DatetimeString
    revokeReason?: string
  }) {
    const now = currentDatetimeString()

    // @NOTE AtUri and AtUri.did will throw if any of the uris are invalid,
    // which we want to happen before the transaction.
    const parsedUris = uris.map((uri) => {
      const atUri = new AtUri(uri)
      return { did: atUri.did, uri: atUri.href }
    })

    return this.db.transaction(async (tx) => {
      for (const { did, uri } of parsedUris) {
        // @TODO is this "return" statement right???
        return tx.db
          .updateTable('verification')
          .set({
            revokeReason,
            updatedAt: now,
            revokedAt: revokedAt || now,
            // Allow setting revokedBy to a moderator/verifier DID and if it isn't set, default to the author of the verification record
            revokedBy: revokedBy || did,
          })
          .where('uri', '=', uri)
          .where('revokedAt', 'is', null)
          .execute()
      }
    })
  }

  async list({
    sortDirection,
    cursor,
    createdAfter,
    createdBefore,
    issuers = [],
    subjects = [],
    isRevoked,
    limit = 100,
  }: {
    sortDirection?: 'asc' | 'desc'
    cursor?: string
    createdAfter?: DatetimeString
    createdBefore?: DatetimeString
    issuers?: DidString[]
    subjects?: DidString[]
    isRevoked?: boolean
    limit?: number
  }) {
    const { ref } = this.db.db.dynamic

    let qb = this.db.db.selectFrom('verification').selectAll()

    if (issuers?.length) {
      qb = qb.where('issuer', 'in', issuers)
    }

    if (isRevoked !== undefined) {
      qb = qb.where('revokedAt', isRevoked ? 'is not' : 'is', null)
    }

    if (subjects?.length) {
      qb = qb.where('subject', 'in', subjects)
    }

    if (createdAfter) {
      qb = qb.where('createdAt', '>=', createdAfter)
    }

    if (createdBefore) {
      qb = qb.where('createdAt', '<=', createdBefore)
    }

    const keyset = new CreatedAtUriKeyset(ref(`createdAt`), ref('uri'))
    const paginatedBuilder = paginate(qb, {
      limit,
      cursor,
      keyset,
      tryIndex: true,
      direction: sortDirection === 'desc' ? 'desc' : 'asc',
    })

    const result = await paginatedBuilder.execute()
    return { verifications: result, cursor: keyset.packFromResult(result) }
  }

  view(
    verifications: Selectable<Verification>[],
    repos: Map<
      string,
      | $Typed<tools.ozone.moderation.defs.RepoViewDetail>
      | $Typed<tools.ozone.moderation.defs.RepoViewNotFound>
    >,
    profiles: Map<string, app.bsky.actor.defs.ProfileViewDetailed>,
  ): $Typed<tools.ozone.verification.defs.VerificationView>[] {
    return verifications.map((verification) => {
      const issuerRepo = repos.get(verification.issuer)
      const subjectRepo = repos.get(verification.subject)
      const subjectProfile = profiles.get(verification.subject)
      const issuerProfile = profiles.get(verification.issuer)
      return tools.ozone.verification.defs.verificationView.$build({
        uri: verification.uri,
        issuer: verification.issuer,
        subject: verification.subject,
        createdAt: verification.createdAt,
        displayName: verification.displayName,
        handle: verification.handle,
        // @ts-expect-error not part of the schema
        updatedAt: verification.updatedAt || undefined,
        revokedAt: verification.revokedAt || undefined,
        revokedBy: verification.revokedBy || undefined,
        revokeReason: verification.revokeReason || undefined,
        issuerRepo,
        subjectRepo,
        subjectProfile: subjectProfile
          ? asUnknown$TypedObject(
              app.bsky.actor.defs.profileViewDetailed.$build(subjectProfile),
            )
          : undefined,
        issuerProfile: issuerProfile
          ? asUnknown$TypedObject(
              app.bsky.actor.defs.profileViewDetailed.$build(issuerProfile),
            )
          : undefined,
      })
    })
  }

  async getFirehoseCursor() {
    const entry = await this.db.db
      .selectFrom('firehose_cursor')
      .select('cursor')
      .where('service', '=', 'verification')
      .executeTakeFirst()

    return entry?.cursor || null
  }

  createFirehoseCursor() {
    return this.db.db
      .insertInto('firehose_cursor')
      .values({
        service: 'verification',
        cursor: null,
      })
      .onConflict((oc) => oc.doNothing())
      .execute()
  }

  async updateFirehoseCursor(cursor: number) {
    const updated = await this.db.db
      .updateTable('firehose_cursor')
      .set({ cursor })
      .where('service', '=', 'verification')
      .where((eb) =>
        eb.or([eb('cursor', '<', cursor), eb('cursor', 'is', null)]),
      )
      .returningAll()
      .executeTakeFirst()

    return updated?.cursor
  }
}
