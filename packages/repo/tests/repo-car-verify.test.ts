import { RepoVerificationError, verifyRepoCar } from '../src/index.js'
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
