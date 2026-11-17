import { jest } from '@jest/globals'
import { CLOCK_SKEW_SEC, SPACE_CREDENTIAL_MAX_AGE_SEC } from '@atproto/space'
import type { SpaceRefString } from '@atproto/syntax'
import { type AccountDb, getDb, getMigrator } from '../db/index.js'
import {
  addRevokedSpaceCredentials,
  deleteExpiredRevokedSpaceCredentials,
  isSpaceCredentialRevoked,
} from './revoked-space-credential.js'

const SPACE =
  'at://did:plc:authority/space/com.example.group/a' as SpaceRefString

// A credential issued at the edge of the skew can be used until its maximum
// lifetime plus the skew at both ends.
const RETENTION_MS = (SPACE_CREDENTIAL_MAX_AGE_SEC + 2 * CLOCK_SKEW_SEC) * 1000

describe('revoked space credentials', () => {
  let db: AccountDb

  beforeEach(async () => {
    db = getDb(':memory:')
    await getMigrator(db).migrateToLatestOrThrow()
  })

  afterEach(async () => {
    await db.close()
  })

  const at = (clock: jest.SpiedFunction<typeof Date.now>, ms: number) =>
    clock.mockReturnValue(ms)

  it('retains a revocation for the longest a credential can be used', async () => {
    using clock = jest.spyOn(Date, 'now')
    const t0 = Date.UTC(2026, 0, 1)

    at(clock, t0)
    await addRevokedSpaceCredentials(db, SPACE, ['jti'])

    at(clock, t0 + RETENTION_MS - 1000)
    expect(await isSpaceCredentialRevoked(db, SPACE, 'jti')).toBe(true)
    at(clock, t0 + RETENTION_MS)
    expect(await isSpaceCredentialRevoked(db, SPACE, 'jti')).toBe(false)
  })

  it('renews the retention of a repeated revocation', async () => {
    using clock = jest.spyOn(Date, 'now')
    const t0 = Date.UTC(2026, 0, 1)

    at(clock, t0)
    await addRevokedSpaceCredentials(db, SPACE, ['jti'])
    at(clock, t0 + 60_000)
    await addRevokedSpaceCredentials(db, SPACE, ['jti'])

    at(clock, t0 + RETENTION_MS)
    expect(await isSpaceCredentialRevoked(db, SPACE, 'jti')).toBe(true)
  })

  it('prunes only expired revocations', async () => {
    using clock = jest.spyOn(Date, 'now')
    const t0 = Date.UTC(2026, 0, 1)

    at(clock, t0)
    await addRevokedSpaceCredentials(db, SPACE, ['old'])
    at(clock, t0 + RETENTION_MS)
    await addRevokedSpaceCredentials(db, SPACE, ['new'])
    await deleteExpiredRevokedSpaceCredentials(db)

    const rows = await db.db
      .selectFrom('revoked_space_credential')
      .select('jti')
      .execute()
    expect(rows).toEqual([{ jti: 'new' }])
  })
})
