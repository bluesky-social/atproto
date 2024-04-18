import { Key, Keyset } from '@atproto-labs/jwk'
import { Importable, NodeKey } from './node-key.js'

export class NodeKeyset<K extends Key = Key> extends Keyset<K> {
  static async fromImportables<K extends Key = NodeKey>(
    input: Record<string, K | Importable>,
  ) {
    return new NodeKeyset(
      await Promise.all(
        Object.entries(input).map(([kid, secret]) =>
          secret instanceof Key ? secret : NodeKey.fromImportable(secret, kid),
        ),
      ),
    )
  }
}
