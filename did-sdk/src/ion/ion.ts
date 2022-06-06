import fetch from 'node-fetch'
import * as IonSdk from '@decentralized-identity/ion-sdk'
import IonDocumentModel from '@decentralized-identity/ion-sdk/lib/models/IonDocumentModel'
import ProofOfWorkSDK from 'ion-pow-sdk'
import { DIDDocument } from 'did-resolver'
import {
  generateKeyPair,
  KeyType,
  generateFromSeedOptions,
} from './keypairs.js'
import { WritableDidDocAPI, ReadOnlyDidDocAPI } from '../did-documents.js'
import {
  Op,
  OpCreate,
  OpUpdate,
  OpRecover,
  OpDeactivate,
  OpUpdateParams,
} from './ops.js'

const RESOLVE_ENDPOINT =
  'https://beta.discover.did.microsoft.com/1.0/identifiers'
const CHALLENGE_ENDPOINT =
  'https://beta.ion.msidentity.com/api/v1.0/proof-of-work-challenge'
const SOLUTION_ENDPOINT = 'https://beta.ion.msidentity.com/api/v1.0/operations'

export { KeyType, generateFromSeedOptions } from './keypairs.js'
export type CreateParams = IonDocumentModel
export type UpdateParams = OpUpdateParams
export type RecoverParams = IonDocumentModel
export type KeyParams = generateFromSeedOptions & { keyType: KeyType }
export * as OPS from './ops.js'
export interface DidIonSerializedState {
  shortForm: string
  longForm: string
  ops: Op[]
}

interface ResolveResponse {
  didDocument: DIDDocument
  didDocumentMetadata: any
}

export async function resolve(
  didUri: string,
  ionResolveEndpoint = RESOLVE_ENDPOINT,
): Promise<ReadOnlyDidDocAPI> {
  const res = await fetch(ionResolveEndpoint + '/' + didUri)
  if (res.status >= 400) throw new Error('Not Found')
  const resObj = (await res.json()) as ResolveResponse
  if (!resObj?.didDocument) throw new Error('Not found')
  return new ReadOnlyDidDocAPI(resObj.didDocument, resObj.didDocumentMetadata)
}

export async function create(
  doc: CreateParams,
  options: {
    ionResolveEndpoint?: string
    ionChallengeEndpoint?: string
    ionSolutionEndpoint?: string
  } & KeyParams,
): Promise<IonDidDocAPI> {
  const did = new IonDidDocAPI(options)
  await did.create(doc, options)
  return did
}

export async function inst(
  state: DidIonSerializedState,
  options: {
    ionResolveEndpoint?: string
    ionChallengeEndpoint?: string
    ionSolutionEndpoint?: string
  } = {},
): Promise<IonDidDocAPI> {
  const did = new IonDidDocAPI(options)
  await did.hydrate(state)
  return did
}

export class IonDidDocAPI extends WritableDidDocAPI {
  _longForm: string | undefined
  _didDoc: DIDDocument | undefined
  _ops: Op[]
  _ionResolveEndpoint = RESOLVE_ENDPOINT
  _ionChallengeEndpoint = CHALLENGE_ENDPOINT
  _ionSolutionEndpoint = SOLUTION_ENDPOINT

  constructor(
    options: {
      ops?: Op[]
      ionResolveEndpoint?: string
      ionChallengeEndpoint?: string
      ionSolutionEndpoint?: string
    } = {},
  ) {
    super()
    this._ops = options.ops || []
    if (options.ionResolveEndpoint) {
      this._ionResolveEndpoint = options.ionResolveEndpoint
    }
    if (options.ionChallengeEndpoint) {
      this._ionChallengeEndpoint = options.ionChallengeEndpoint
    }
    if (options.ionSolutionEndpoint) {
      this._ionSolutionEndpoint = options.ionSolutionEndpoint
    }
  }

  get didDoc(): DIDDocument {
    if (!this._didDoc) {
      throw new Error('DID not yet created or loaded')
    }
    return this._didDoc
  }

  // ion-specific apis
  // =

  getAllOperations() {
    return this._ops
  }

  getLastOperation() {
    return this._ops[this._ops.length - 1]
  }

  getPreviousOperation(type: string): Op {
    return this._ops.reduce((last, op) => {
      return op.operation === type ||
        (op.operation === 'recover' &&
          (type === 'deactivate' || type === 'update'))
        ? op
        : last
    }, this._ops[0])
  }

  getOperation(index: number): Op {
    return this._ops[index]
  }

  getSuffix() {
    return this.getURI('short').split(':').pop() || ''
  }

  assertActive() {
    const lastOp = this.getLastOperation()
    if (lastOp?.operation === 'deactivate') {
      throw new Error('Cannot perform further operations on a deactivated DID')
    }
  }

  private _createLongForm() {
    // TODO
    // this code is based on ion-tools, but is it correct?
    // the longform DID is an encoding of the current state
    // shouldn't that mean it needs to use the most recent op
    // and not just the genesis?
    // -prf
    const create = this.getOperation(0) as OpCreate
    if (!create) throw new Error('DID not created')
    this._longForm =
      this._longForm ||
      IonSdk.IonDid.createLongFormDid({
        recoveryKey: create.recovery.publicJwk,
        updateKey: create.update.publicJwk,
        document: create.content,
      })
  }

  private async _resolveDidDoc() {
    this._didDoc = (
      await resolve(this.getURI(), this._ionResolveEndpoint)
    ).didDoc
  }

  private async _submitAnchorRequest(body: any) {
    // @ts-ignore the d.ts is wrong for the pow sdk -prf
    return ProofOfWorkSDK.submitIonRequest(
      this._ionChallengeEndpoint,
      this._ionSolutionEndpoint,
      JSON.stringify(body),
    )
  }

  // read api
  // =

  getURI(form = 'long'): string {
    this._createLongForm()
    if (!this._longForm) throw new Error('DID not created')
    return !form || form === 'long'
      ? this._longForm
      : this._longForm.split(':').slice(0, -1).join(':')
  }

  // writable api
  // =

  async create(doc: CreateParams, options: KeyParams): Promise<OpCreate> {
    this.assertActive()
    const op: OpCreate = {
      operation: 'create',
      content: doc,
      recovery: await generateKeyPair(options.keyType, options),
      update: await generateKeyPair(options.keyType, options),
    }
    const reqBody = IonSdk.IonRequest.createCreateRequest({
      recoveryKey: op.recovery.publicJwk,
      updateKey: op.update.publicJwk,
      document: op.content,
    })
    await this._submitAnchorRequest(reqBody)
    this._ops.push(op)
    this._createLongForm()
    await this._resolveDidDoc()
    return op
  }

  async update(params: UpdateParams, options: KeyParams): Promise<OpUpdate> {
    this.assertActive()
    const op: OpUpdate = {
      operation: 'update',
      content: params,
      previous: this.getPreviousOperation('update'),
      update: await generateKeyPair(options.keyType, options),
    }
    if (!op.previous.update) {
      throw new Error('Update key not found on previous ops')
    }
    const reqBody = await IonSdk.IonRequest.createUpdateRequest({
      didSuffix: this.getSuffix(),
      signer: IonSdk.LocalSigner.create(op.previous.update.privateJwk),
      updatePublicKey: op.previous.update.publicJwk,
      nextUpdatePublicKey: op.update.publicJwk,
      servicesToAdd: op.content.addServices,
      idsOfServicesToRemove: op.content?.removeServices,
      publicKeysToAdd: op.content?.addPublicKeys,
      idsOfPublicKeysToRemove: op.content?.removePublicKeys,
    })
    await this._submitAnchorRequest(reqBody)
    this._ops.push(op)
    await this._resolveDidDoc()
    return op
  }

  async recover(doc: RecoverParams, options: KeyParams): Promise<OpRecover> {
    this.assertActive()
    const op: OpRecover = {
      operation: 'recover',
      content: doc,
      previous: this.getPreviousOperation('recover'),
      recovery: await generateKeyPair(options.keyType, options),
      update: await generateKeyPair(options.keyType, options),
    }
    if (!op.previous.recovery) {
      throw new Error('Recovery key not found on previous ops')
    }
    const reqBody = await IonSdk.IonRequest.createRecoverRequest({
      didSuffix: this.getSuffix(),
      signer: IonSdk.LocalSigner.create(op.previous.recovery.privateJwk),
      recoveryPublicKey: op.previous.recovery.publicJwk,
      nextRecoveryPublicKey: op.recovery.publicJwk,
      nextUpdatePublicKey: op.update.publicJwk,
      document: op.content,
    })
    await this._submitAnchorRequest(reqBody)
    this._ops.push(op)
    await this._resolveDidDoc()
    return op
  }

  async deactivate(): Promise<OpDeactivate> {
    this.assertActive()
    const op: OpDeactivate = {
      operation: 'deactivate',
      previous: this.getPreviousOperation('deactivate'),
    }
    if (!op.previous.recovery) {
      throw new Error('Recovery key not found on previous ops')
    }
    const reqBody = await IonSdk.IonRequest.createDeactivateRequest({
      didSuffix: this.getSuffix(),
      recoveryPublicKey: op.previous.recovery.publicJwk,
      signer: IonSdk.LocalSigner.create(op.previous.recovery.privateJwk),
    })
    await this._submitAnchorRequest(reqBody)
    this._ops.push(op)
    await this._resolveDidDoc()
    return op
  }

  serialize(): DidIonSerializedState {
    return {
      shortForm: this.getURI('short'),
      longForm: this.getURI(),
      ops: this.getAllOperations(),
    }
  }

  async hydrate(state: DidIonSerializedState): Promise<void> {
    if (!isSerializedOpsValid(state)) {
      throw new Error(`Unable to load did:ion - invalid .ops`)
    }
    this._ops = state.ops
    this._createLongForm()
    await this._resolveDidDoc()
  }
}

function isSerializedOpsValid(state: DidIonSerializedState) {
  if (!state.ops) return false
  if (!Array.isArray(state.ops)) return false
  return state.ops.every((op) => {
    switch (op.operation) {
      case 'create':
        if (!op.content) return false
        if (!op.update) return false
        if (!op.recovery) return false
        break
      case 'update':
        if (!op.content) return false
        if (!op.update) return false
        if (!op.previous) return false
        break
      case 'recover':
        if (!op.content) return false
        if (!op.update) return false
        if (!op.recovery) return false
        if (!op.previous) return false
        break
      case 'deactivate':
        if (!op.previous) return false
        break
      default:
        return false
    }
    return true
  })
}
