import * as key from '@transmute/did-key.js'
import { DIDDocument } from 'did-resolver'
import { secureRandom } from '../crypto'
import { ReadOnlyDidDocAPI, WritableDidDocAPI } from '../did-documents'

export type generateFromSeedOptions = { secureRandom: () => Buffer }
export type generateFromRandomOptions = {
  kty: 'EC' | 'OKP'
  crvOrSize: 'P-256' | 'P-384' | 'P-521'
}
export type KeyType =
  | 'ed25519'
  | 'x25519'
  | 'secp256k1'
  | 'bls12381'
  | 'secp256r1'
  | 'secp384r1'
  | 'secp521r1'
type Unpacked<T> = T extends (infer U)[] ? U : T
type GeneratedDid = Awaited<ReturnType<typeof key.generate>>
export type DidKey = Unpacked<GeneratedDid['keys']>
export type DidKeySerializedState = {
  id: string
  keys: DidKey[]
}

export async function resolve(didUri: string): Promise<ReadOnlyDidDocAPI> {
  const doc = await key.resolve(didUri, {
    accept: 'application/did+ld+json',
  })
  return new ReadOnlyDidDocAPI(doc.didDocument)
}

export async function create(
  type: KeyType,
  generateOptions?: generateFromSeedOptions | generateFromRandomOptions,
): Promise<KeyDidDocAPI> {
  const did = new KeyDidDocAPI()
  await did.create(type, generateOptions)
  return did
}

export async function inst(
  state: DidKeySerializedState,
): Promise<KeyDidDocAPI> {
  const did = new KeyDidDocAPI()
  await did.hydrate(state)
  return did
}

export class KeyDidDocAPI extends WritableDidDocAPI {
  id = ''
  keys: DidKey[] = []
  _didDoc: DIDDocument | undefined

  constructor() {
    super()
  }

  get didDoc(): DIDDocument {
    if (!this._didDoc) {
      throw new Error('DID not yet created or loaded')
    }
    return this._didDoc
  }

  async create(
    type: KeyType,
    generateOptions?: generateFromSeedOptions | generateFromRandomOptions,
  ): Promise<void> {
    if (!generateOptions) {
      try {
        generateOptions = key.getOptionsForType(
          type,
        ) as generateFromRandomOptions
      } catch (e) {
        generateOptions = {
          secureRandom: () => secureRandom(32),
        } as generateFromSeedOptions
      }
    }
    const res = await key.generate(type, generateOptions, {
      accept: 'application/did+ld+json',
    })
    this.id = res.didDocument.id
    this.keys = res.keys
    this._didDoc = (
      await key.resolve(this.id, {
        accept: 'application/did+ld+json',
      })
    ).didDocument
  }

  serialize(): DidKeySerializedState {
    return {
      id: this.id,
      keys: this.keys,
    }
  }

  async hydrate(state: DidKeySerializedState) {
    if (!state.id || typeof state.id !== 'string') {
      throw new Error(`Unable to load did:key - invalid .id`)
    }
    if (!isSerializedKeysValid(state)) {
      throw new Error(`Unable to load did:key - invalid .keys`)
    }
    this.id = state.id
    this.keys = state.keys
    this._didDoc = (
      await key.resolve(this.id, {
        accept: 'application/did+ld+json',
      })
    ).didDocument
  }
}

function isSerializedKeysValid(state: DidKeySerializedState): boolean {
  if (!state.keys) return false
  if (!Array.isArray(state.keys)) return false
  return state.keys.every((key) => {
    if (!key.id || typeof key.id !== 'string') return false
    if (!key.controller || typeof key.controller !== 'string') return false
    if (!key.type || typeof key.type !== 'string') return false
    if (!('publicKeyBase58' in key || 'publicKeyJwk' in key)) return false
    if (!('privateKeyBase58' in key || 'privateKeyJwk' in key)) return false
    return true
  })
}
