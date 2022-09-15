import { DidableKey } from '@adxp/crypto'
import axios from 'axios'
import { Document, hashAndFindDid } from './document'
import { Create, create, Operation, UpdateOperation } from './types'
import * as cbor from '@ipld/dag-cbor'
import * as uint8arrays from 'uint8arrays'
import { check, cidForData } from '@adxp/common'

export class AicClient {
  constructor(public url: string) {}

  async getDocument(did: string): Promise<Document> {
    const res = await axios.get(`${this.url}/${did}`)
    return res.data
  }

  async getOperationLog(did: string): Promise<Operation[]> {
    const res = await axios.get(`${this.url}/log/${did}`)
    return res.data.log
  }

  async createDid(
    signingKey: DidableKey,
    recoveryKey: string,
    username: string,
    service: string,
  ): Promise<string> {
    const op: Partial<Create> = {
      type: 'create',
      signingKey: signingKey.did(),
      recoveryKey,
      username,
      service,
      prev: null,
    }
    const signedOp = await this.signOperation(op, signingKey)
    if (!check.is(signedOp, create)) {
      throw new Error('Not a valid create operation')
    }
    const did = await hashAndFindDid(signedOp)
    await axios.post(`${this.url}/${did}`, signedOp)
    return did
  }

  async makeUpdate(
    did: string,
    op: Partial<UpdateOperation>,
    signingKey: DidableKey,
  ) {
    const log = await this.getOperationLog(did)
    if (log.length === 0) {
      throw new Error(`Could not make update: DID does not exist: ${did}`)
    }
    const prev = await cidForData(log[log.length - 1])
    const signedOp = this.signOperation(
      {
        ...op,
        prev: prev.toString(),
      },
      signingKey,
    )
    await axios.post(`${this.url}/${did}`, signedOp)
  }

  async rotateSigningKey(did: string, newKey: string, signingKey: DidableKey) {
    return this.makeUpdate(
      did,
      { type: 'rotate_signing_key', key: newKey },
      signingKey,
    )
  }

  async rotateRecoveryKey(did: string, newKey: string, signingKey: DidableKey) {
    return this.makeUpdate(
      did,
      { type: 'rotate_recovery_key', key: newKey },
      signingKey,
    )
  }

  async udpateUsername(did: string, username: string, signingKey: DidableKey) {
    return this.makeUpdate(
      did,
      { type: 'update_username', username },
      signingKey,
    )
  }

  async updateService(did: string, service: string, signingKey: DidableKey) {
    return this.makeUpdate(did, { type: 'update_service', service }, signingKey)
  }
}

export default AicClient
