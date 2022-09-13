// TODO: rewrite me

import { DIDDocument } from 'did-resolver'
import { secureRandom } from '../crypto'
import { ReadOnlyDidDocAPI, WritableDidDocAPI } from '../did-documents'

interface DidKeySerializedState {}

export async function resolve(didUri: string): Promise<ReadOnlyDidDocAPI> {
  throw new Error('TODO: implement did:key resolve')
}

export async function create(): Promise<KeyDidDocAPI> {
  throw new Error('TODO: implement did:key create')
}

export async function inst(
  state: DidKeySerializedState,
): Promise<KeyDidDocAPI> {
  throw new Error('TODO: implement did:key inst')
}

export class KeyDidDocAPI extends WritableDidDocAPI {
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

  async create(): Promise<void> {
    throw new Error('TODO: implement did:key create')
  }

  serialize(): DidKeySerializedState {
    throw new Error('TODO: implement did:key serialize')
  }

  async hydrate(state: DidKeySerializedState) {
    throw new Error('TODO: implement did:key hydrate')
  }
}
