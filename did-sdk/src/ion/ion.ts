import fetch from 'node-fetch'
import * as IonSdk from '@decentralized-identity/ion-sdk'
import IonDocumentModel from '@decentralized-identity/ion-sdk/lib/models/IonDocumentModel'
import ProofOfWorkSDK from 'ion-pow-sdk'
import { KeyCapabilitySection, DIDDocument } from 'did-resolver'
import { generateKeyPair } from '../keypairs.js'
import { DidDocAPI, ReadOnlyDidDocAPI } from '../did-documents.js'
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

export type CreateParams = IonDocumentModel
export type UpdateParams = OpUpdateParams
export type RecoverParams = IonDocumentModel
export * as OPS from './ops'

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

export interface IonDidState {
  shortForm: string
  longForm: string
  ops: Op[]
}

export class IonDidDocAPI extends DidDocAPI {
  _longForm: string | undefined
  _ops: Op[]
  _ionChallengeEndpoint = CHALLENGE_ENDPOINT
  _ionSolutionEndpoint = SOLUTION_ENDPOINT

  constructor(
    options: {
      ops?: Op[]
      ionChallengeEndpoint?: string
      ionSolutionEndpoint?: string
    } = {},
  ) {
    super()
    this._ops = options.ops || []
    if (options.ionChallengeEndpoint) {
      this._ionChallengeEndpoint = options.ionChallengeEndpoint
    }
    if (options.ionSolutionEndpoint) {
      this._ionSolutionEndpoint = options.ionSolutionEndpoint
    }
  }

  get state(): IonDidState {
    return {
      shortForm: this.getURI('short'),
      longForm: this.getURI(),
      ops: this.getAllOperations(),
    }
  }

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

  assertActive() {
    const lastOp = this.getLastOperation()
    if (lastOp?.operation === 'deactivate') {
      throw 'Cannot perform further operations on a deactivated DID'
    }
  }

  getURI(form = 'long'): string {
    const create = this.getOperation(0) as OpCreate
    if (!create) throw new Error('DID not created')
    this._longForm =
      this._longForm ||
      IonSdk.IonDid.createLongFormDid({
        recoveryKey: create.recovery.publicJwk,
        updateKey: create.update.publicJwk,
        document: create.content,
      })
    return !form || form === 'long'
      ? this._longForm
      : this._longForm.split(':').slice(0, -1).join(':')
  }

  getSuffix() {
    return this.getURI('short').split(':').pop() || ''
  }

  async create(doc: CreateParams): Promise<OpCreate> {
    this.assertActive()
    const op: OpCreate = {
      operation: 'create',
      content: doc,
      recovery: await generateKeyPair(),
      update: await generateKeyPair(),
    }
    const reqBody = IonSdk.IonRequest.createCreateRequest({
      recoveryKey: op.recovery.publicJwk,
      updateKey: op.update.publicJwk,
      document: op.content,
    })
    await submitAnchorRequest(reqBody)
    this._ops.push(op)
    return op
  }

  async update(params: UpdateParams): Promise<OpUpdate> {
    this.assertActive()
    const op: OpUpdate = {
      operation: 'update',
      content: params,
      previous: this.getPreviousOperation('update'),
      update: await generateKeyPair(),
    }
    if (!op.previous.update) {
      throw new Error('Update key not found on previous ops')
    }
    const reqBody = IonSdk.IonRequest.createUpdateRequest({
      didSuffix: this.getSuffix(),
      signer: IonSdk.LocalSigner.create(op.previous.update.privateJwk),
      updatePublicKey: op.previous.update.publicJwk,
      nextUpdatePublicKey: op.update.publicJwk,
      servicesToAdd: op.content.addServices,
      idsOfServicesToRemove: op.content?.removeServices,
      publicKeysToAdd: op.content?.addPublicKeys,
      idsOfPublicKeysToRemove: op.content?.removePublicKeys,
    })
    await submitAnchorRequest(reqBody)
    this._ops.push(op)
    return op
  }

  async recover(doc: RecoverParams): Promise<OpRecover> {
    this.assertActive()
    const op: OpRecover = {
      operation: 'recover',
      content: doc,
      previous: this.getPreviousOperation('recover'),
      recovery: await generateKeyPair(),
      update: await generateKeyPair(),
    }
    if (!op.previous.recovery) {
      throw new Error('Recovery key not found on previous ops')
    }
    const reqBody = IonSdk.IonRequest.createRecoverRequest({
      didSuffix: this.getSuffix(),
      signer: IonSdk.LocalSigner.create(op.previous.recovery.privateJwk),
      recoveryPublicKey: op.previous.recovery.publicJwk,
      nextRecoveryPublicKey: op.recovery.publicJwk,
      nextUpdatePublicKey: op.update.publicJwk,
      document: op.content,
    })
    await submitAnchorRequest(reqBody)
    this._ops.push(op)
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
    const reqBody = IonSdk.IonRequest.createDeactivateRequest({
      didSuffix: this.getSuffix(),
      recoveryPublicKey: op.previous.recovery.publicJwk,
      signer: IonSdk.LocalSigner.create(op.previous.recovery.privateJwk),
    })
    await submitAnchorRequest(reqBody)
    this._ops.push(op)
    return op
  }

  getPublicKey(purpose: KeyCapabilitySection = 'assertionMethod') {
    // TODO
    throw new Error('TODO')
  }
}

async function submitAnchorRequest(body: any) {
  // @ts-ignore the d.ts is wrong for the pow sdk -prf
  return ProofOfWorkSDK.submitIonRequest(
    this._ionChallengeEndpoint,
    this._ionSolutionEndpoint,
    JSON.stringify(body),
  )
}
