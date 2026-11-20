import { Secp256k1Keypair } from '@atproto/crypto'
import {
  MemoryBlockstore,
  Repo,
  RepoVerificationError,
  WriteOpAction,
  blocksToCarFile,
  verifyRepoCar,
} from '../src/index.js'
import fixtures from './repo-car-fixtures.json' with { type: 'json' }

interface Fixture {
  name: string
  did: string
  validRepo: boolean
  carBase64: string
  expectedError?: string
}

const vectors = fixtures as Fixture[]

// Minimal CAR vectors from bluesky-social/atproto#5429 (reported by
// olix0r): each rejection vector is CID-consistent, completely hashed,
// and carries a valid signature — only the named repository invariant is
// violated.
describe('verifyRepoCar structural validation', () => {
  for (const fixture of vectors) {
    it(`${fixture.validRepo ? 'accepts' : 'rejects'} ${fixture.name}`, async () => {
      const carBytes = Uint8Array.from(atob(fixture.carBase64), (c) =>
        c.charCodeAt(0),
      )
      const attempt = verifyRepoCar(carBytes, fixture.did)
      if (fixture.validRepo) {
        await expect(attempt).resolves.toBeDefined()
      } else {
        await expect(attempt).rejects.toThrow(RepoVerificationError)
        await expect(attempt).rejects.toThrow(fixture.expectedError)
      }
    })
  }
})

// Repos produced by the normal write path must keep verifying: the
// structural checks must not reject legitimate MST shapes.
describe('verifyRepoCar on generated repos', () => {
  it('accepts a repo with hundreds of records across collections', async () => {
    const storage = new MemoryBlockstore()
    const keypair = await Secp256k1Keypair.create()
    let repo = await Repo.create(storage, keypair.did(), keypair)
    const collections = [
      'app.bsky.feed.post',
      'app.bsky.graph.follow',
      'com.example.custom',
      'tools.ozone.moderation.defs',
    ]
    for (let i = 0; i < 400; i++) {
      const col = collections[i % collections.length]
      repo = await repo.applyWrites(
        {
          action: WriteOpAction.Create,
          collection: col,
          rkey: `key${String(i).padStart(4, '0')}`,
          record: {
            $type: col,
            text: `record ${i}`,
            createdAt: new Date().toISOString(),
          },
        },
        keypair,
      )
    }
    for (let j = 0; j < 50; j++) {
      const i = j * 7
      const col = collections[i % collections.length]
      const rkey = `key${String(i).padStart(4, '0')}`
      repo = await repo.applyWrites(
        j % 2 === 0
          ? { action: WriteOpAction.Delete, collection: col, rkey }
          : {
              action: WriteOpAction.Update,
              collection: col,
              rkey,
              record: {
                $type: col,
                text: `updated ${i}`,
                createdAt: new Date().toISOString(),
              },
            },
        keypair,
      )
    }
    const root = await storage.getRoot()
    const car = await blocksToCarFile(root, storage.blocks)
    await expect(verifyRepoCar(car, repo.did)).resolves.toBeDefined()
  }, 120000)
})
