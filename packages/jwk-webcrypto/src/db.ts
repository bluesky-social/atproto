import { DB } from '@atproto/indexed-db'
import { fromSubtleAlgorithm, generateKeypair } from './util.js'

const INDEXED_DB_NAME = '@@jwk-webcrypto'

export async function loadCryptoKeyPair(
  kid: string,
  algs: string[],
  extractable = false,
): Promise<CryptoKeyPair> {
  type Schema = {
    'oauth-keypair': CryptoKeyPair
  }

  const migrations = [
    (db: IDBDatabase) => {
      db.createObjectStore('oauth-keypair')
    },
  ]

  // eslint-disable-next-line
  await using db = await DB.open<Schema>(INDEXED_DB_NAME, migrations)

  const current = await db.transaction(['oauth-keypair'], 'readonly', (tx) =>
    tx.objectStore('oauth-keypair').get(kid),
  )

  try {
    const alg = fromSubtleAlgorithm(current.privateKey.algorithm)
    if (algs.includes(alg) && current.privateKey.extractable === extractable) {
      return current
    } else if (current) {
      throw new Error('Store contained invalid keypair')
    }
  } catch {
    await db.transaction(['oauth-keypair'], 'readwrite', (tx) =>
      tx.objectStore('oauth-keypair').delete(kid),
    )
  }

  return generateKeypair(algs, extractable)
}
