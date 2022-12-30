import Database from '../db'
import { RefreshToken } from '../auth'
import { Services } from '.'

export class AuthService {
  constructor(public services: Services, public db: Database) {}

  static creator(services: Services) {
    return (db: Database) => new AuthService(services, db)
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

  async revokeRefreshTokensByDid(did: string) {
    const { numDeletedRows } = await this.db.db
      .deleteFrom('refresh_token')
      .where('did', '=', did)
      .executeTakeFirst()
    return numDeletedRows > 0
  }
}
