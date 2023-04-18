import { HOUR } from '@atproto/common'
import Database from '../db'
import { RefreshToken, getRefreshTokenId } from '../auth'

const REFRESH_GRACE_MS = 2 * HOUR

export class AuthService {
  constructor(public db: Database) {}

  static creator() {
    return (db: Database) => new AuthService(db)
  }

  async grantRefreshToken(
    payload: RefreshToken,
    appPasswordName: string | null,
  ) {
    return this.db.db
      .insertInto('refresh_token')
      .values({
        id: payload.jti,
        did: payload.sub,
        appPasswordName,
        expiresAt: new Date(payload.exp * 1000).toISOString(),
      })
      .onConflict((oc) => oc.doNothing()) // E.g. when re-granting during a refresh grace period
      .executeTakeFirst()
  }

  async rotateRefreshToken(
    id: string,
  ): Promise<{ nextId: string; appPassName: string | null } | null> {
    this.db.assertTransaction()
    const token = await this.db.db
      .selectFrom('refresh_token')
      .if(this.db.dialect !== 'sqlite', (qb) => qb.forUpdate())
      .where('id', '=', id)
      .selectAll()
      .executeTakeFirst()
    if (!token) return null

    // Shorten the refresh token lifespan down from its
    // original expiration time to its revocation grace period.

    const now = new Date()
    const prevExpiresAt = new Date(token.expiresAt)
    const graceExpiresAt = new Date(now.getTime() + REFRESH_GRACE_MS)

    const expiresAt =
      graceExpiresAt < prevExpiresAt ? graceExpiresAt : prevExpiresAt
    const expired = expiresAt <= now

    // Determine the next refresh token id: upon refresh token
    // reuse you always receive a refresh token with the same id.
    const nextId = token.nextId ?? getRefreshTokenId()

    // Update token w/ possibly-updated expiration time
    // and next id, and tidy all of user's expired tokens.

    await this.db.db
      .updateTable('refresh_token')
      .where('id', '=', id)
      .set({ expiresAt: expiresAt.toISOString(), nextId })
      .executeTakeFirst()
    await this.db.db
      .deleteFrom('refresh_token')
      .where('did', '=', token.did)
      .where('expiresAt', '<=', now.toISOString())
      .returningAll()
      .executeTakeFirst()

    return expired ? null : { nextId, appPassName: token.appPasswordName }
  }

  async revokeRefreshToken(id: string) {
    const { numDeletedRows } = await this.db.db
      .deleteFrom('refresh_token')
      .where('id', '=', id)
      .executeTakeFirst()
    return numDeletedRows > 0
  }

  async revokeRefreshTokensByDid(did: string) {
    const { numDeletedRows } = await this.db.db
      .deleteFrom('refresh_token')
      .where('did', '=', did)
      .executeTakeFirst()
    return numDeletedRows > 0
  }

  async revokeAppPasswordRefreshToken(did: string, appPassName: string) {
    const { numDeletedRows } = await this.db.db
      .deleteFrom('refresh_token')
      .where('did', '=', did)
      .where('appPasswordName', '=', appPassName)
      .executeTakeFirst()
    return numDeletedRows > 0
  }
}
