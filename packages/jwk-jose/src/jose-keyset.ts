import { Key, Keyset } from '@atproto/jwk'
import { Importable, JoseKey } from './jose-key.js'

export class JoseKeyset<K extends Key = Key> extends Keyset<K> {
  static async fromImportables<K extends Key = JoseKey>(
    input: Record<string, K | Importable>,
  ) {
    return new JoseKeyset(
      await Promise.all(
        Object.entries(input).map(([kid, secret]) => {
          if (secret instanceof Key) {
            if (secret.kid !== kid) {
              throw new TypeError(`Key ID mismatch: ${kid} !== ${secret.kid}`)
            }
            return secret
          }

          return JoseKey.fromImportable(secret, kid)
        }),
      ),
    )
  }
}
