import { RefreshToken } from '../../../../auth'
import Database from '../../../../db'

export const grantRefreshToken = async (
  db: Database,
  payload: RefreshToken,
) => {
  return db.db
    .insertInto('refresh_token')
    .values({
      id: payload.jti,
      did: payload.sub,
      expiresAt: new Date(payload.exp * 1000).toISOString(),
    })
    .executeTakeFirst()
}

export const revokeRefreshToken = async (db: Database, id: string) => {
  const { numDeletedRows } = await db.db
    .deleteFrom('refresh_token')
    .where('id', '=', id)
    .executeTakeFirst()
  return numDeletedRows > 0
}
