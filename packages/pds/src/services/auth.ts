import Database from '../db'
import { RefreshToken } from '../auth'

export class AuthService {
  constructor(public db: Database) {}

  static creator() {
    return (db: Database) => new AuthService(db)
  }

  async grantRefreshToken(payload: RefreshToken) {
    return this.db.db
      .insertInto('refresh_token')
      .values({
        id: payload.jti,
        did: payload.sub,
        expiresAt: new Date(payload.exp * 1000).toISOString(),
      })
      .executeTakeFirst()
  }

  async revokeRefreshToken(id: string) {
    const { numDeletedRows } = await this.db.db
      .deleteFrom('refresh_token')
      .where('id', '=', id)
      .executeTakeFirst()
    return numDeletedRows > 0
  }
}
