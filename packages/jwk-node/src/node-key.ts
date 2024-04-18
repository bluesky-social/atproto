import { KeyObject } from 'node:crypto'

import { jwkSchema } from '@atproto-labs/jwk'
import { Importable as JoseImportable, JoseKey } from '@atproto-labs/jwk-jose'

export type Importable = KeyObject | JoseImportable

export class NodeKey extends JoseKey {
  static async fromImportable(
    input: Importable,
    kid: string,
  ): Promise<NodeKey> {
    if (input instanceof KeyObject) {
      return this.fromKeyObject(kid, input)
    }

    return super.fromImportable(input, kid)
  }

  static async fromKeyObject(
    kid: string,
    privateKey: KeyObject,
  ): Promise<NodeKey> {
    const jwk = jwkSchema.parse(privateKey.export({ format: 'jwk' }))
    const use = jwk.use || 'sig'
    return new NodeKey({ ...jwk, use, kid })
  }
}
