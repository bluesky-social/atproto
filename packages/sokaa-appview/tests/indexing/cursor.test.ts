import {
  getSubscriptionCursor,
  setSubscriptionCursor,
} from '../../src/data-plane/server/cursor'
import { createTestDb } from './helpers'

describe('subscription cursor', () => {
  const schema = 'sokaa_appview_cursor'
  let database: Awaited<ReturnType<typeof createTestDb>>

  beforeAll(async () => {
    database = await createTestDb(schema)
  })

  afterAll(async () => {
    await database.db.schema.dropSchema(schema).ifExists().cascade().execute()
    await database.close()
  })

  it('returns undefined when no cursor is stored', async () => {
    expect(await getSubscriptionCursor(database.db)).toBeUndefined()
  })

  it('persists and reads lastSeq', async () => {
    const ts = '2026-01-01T00:00:00.000Z'
    await setSubscriptionCursor(database.db, 42, ts)
    expect(await getSubscriptionCursor(database.db)).toBe(42)

    await setSubscriptionCursor(database.db, 99, ts)
    expect(await getSubscriptionCursor(database.db)).toBe(99)
  })

  it('enforces singleton row', async () => {
    const rows = await database.db
      .selectFrom('subscription_cursor')
      .selectAll()
      .execute()
    expect(rows).toHaveLength(1)
    expect(rows[0].id).toBe(1)
  })
})
