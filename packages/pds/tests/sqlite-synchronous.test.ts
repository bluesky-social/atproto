import { sql } from 'kysely'
import { TestNetworkNoAppView } from '@atproto/dev-env'
// Importing from `dist` to circumvent circular dependency typing issues
import type { Database } from '../dist/db/index.js'

const getSynchronous = async <T>(db: Database<T>) => {
  const res = await sql<{
    synchronous: number
  }>`PRAGMA synchronous`.execute(db.db)
  return res.rows[0]?.synchronous
}

// PRAGMA synchronous reports 1 for NORMAL (better-sqlite3's WAL default) and 2 for FULL
describe.each([
  { synchronousFull: true, expected: 2 },
  { synchronousFull: false, expected: 1 },
])(
  'sqlite synchronous (synchronousFull: $synchronousFull)',
  ({ synchronousFull, expected }) => {
    let network: TestNetworkNoAppView
    let did: string

    beforeAll(async () => {
      network = await TestNetworkNoAppView.create({
        dbPostgresSchema: `sqlite_synchronous_${synchronousFull}`,
        pds: { synchronousFull },
      })
      const sc = network.getSeedClient()
      await sc.createAccount('alice', {
        email: 'alice@test.com',
        handle: 'alice.test',
        password: 'alice-pass',
      })
      did = sc.dids.alice
    })

    afterAll(async () => {
      await network?.close()
    })

    it('applies to a fresh actor store connection', async () => {
      await using db = await network.pds.ctx.actorStore.openDb(did)
      expect(await getSynchronous(db)).toBe(expected)
    })

    it('applies to the account db', async () => {
      expect(await getSynchronous(network.pds.ctx.accountManager.db)).toBe(
        expected,
      )
    })

    it('applies to the sequencer db', async () => {
      expect(await getSynchronous(network.pds.ctx.sequencer.db)).toBe(expected)
    })
  },
)
