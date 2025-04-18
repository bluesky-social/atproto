import { Selectable } from 'kysely'
import {
  $Typed,
  AppBskyActorDefs,
  AtUri,
  ToolsOzoneModerationDefs,
  ToolsOzoneVerificationDefs,
} from '@atproto/api'
import { Database } from '../db'
import { CreatedAtUriKeyset, paginate } from '../db/pagination'
import { Verification } from '../db/schema/verification'

export type VerificationServiceCreator = (db: Database) => VerificationService

export class VerificationService {
  constructor(public db: Database) {}

  static creator() {
    return (db: Database) => new VerificationService(db)
  }

  async create(
    verifications: Pick<
      Verification,
      'uri' | 'issuer' | 'subject' | 'handle' | 'displayName' | 'createdAt'
    >[],
  ) {
    // @TODO: We should probably handle errors here?
    await this.db.transaction(async (tx) => {
      return Promise.allSettled(
        verifications.map((verification) => {
          return tx.db
            .insertInto('verification')
            .values(verification)
            .onConflict((oc) => oc.doNothing())
            .execute()
        }),
      )
    })
  }

  async markRevoked({
    uris,
    revokedBy,
    revokedAt,
    revokeReason,
  }: {
    uris: string[]
    revokedBy?: string
    revokedAt?: string
    revokeReason?: string
  }) {
    const now = new Date().toISOString()
    return Promise.allSettled(
      uris.map(async (uri) => {
        const atUri = new AtUri(uri)
        const res = await this.db.db
          .updateTable('verification')
          .set({
            revokeReason,
            updatedAt: now,
            revokedAt: revokedAt || now,
            // Allow setting revokedBy to a moderator/verifier DID and if it isn't set, default to the author of the verification record
            revokedBy: revokedBy || atUri.host,
          })
          .where('uri', '=', uri)
          .where('revokedAt', 'is', null)
          .execute()

        return res
      }),
    )
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
    createdAfter?: string
    createdBefore?: string
    issuers?: string[]
    subjects?: string[]
    isRevoked?: boolean
    limit?: number
  }) {
    const { ref } = this.db.db.dynamic

    let qb = this.db.db.selectFrom('verification').selectAll()

    if (issuers.length) {
      qb = qb.where('issuer', 'in', issuers)
    }

    if (isRevoked !== undefined) {
      qb = qb.where('revokedAt', isRevoked ? 'is' : 'is not', null)
    }

    if (subjects.length) {
      qb = qb.where('subject', 'in', subjects)
    }

    if (createdAfter) {
      qb = qb.where('createdAt', '>', createdAfter)
    }

    if (createdBefore) {
      qb = qb.where('createdAt', '>', createdBefore)
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
      | $Typed<ToolsOzoneModerationDefs.RepoViewDetail>
      | $Typed<ToolsOzoneModerationDefs.RepoViewNotFound>
    >,
    profiles: Map<string, AppBskyActorDefs.ProfileViewDetailed>,
  ): $Typed<ToolsOzoneVerificationDefs.VerificationView>[] {
    return verifications.map((verification) => {
      const issuerRepo = repos.get(verification.issuer)
      const subjectRepo = repos.get(verification.subject)
      const subjectProfile = profiles.get(verification.subject)
      const issuerProfile = profiles.get(verification.issuer)
      return {
        $type: 'tools.ozone.verification.defs#verificationView',
        uri: verification.uri,
        issuer: verification.issuer,
        subject: verification.subject,
        createdAt: verification.createdAt,
        displayName: verification.displayName,
        handle: verification.handle,
        updatedAt: verification.updatedAt || undefined,
        revokedAt: verification.revokedAt || undefined,
        revokedBy: verification.revokedBy || undefined,
        revokeReason: verification.revokeReason || undefined,
        issuerRepo,
        subjectRepo,
        subjectProfile: subjectProfile
          ? {
              $type: 'app.bsky.actor.defs#profileViewDetailed',
              ...subjectProfile,
            }
          : undefined,
        issuerProfile: issuerProfile
          ? {
              $type: 'app.bsky.actor.defs#profileViewDetailed',
              ...issuerProfile,
            }
          : undefined,
      }
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

  async updateFirehoseCursor(cursor: string) {
    await this.db.db
      .updateTable('firehose_cursor')
      .set({ cursor })
      .where('service', '=', 'verification')
      .executeTakeFirst()
  }
}
