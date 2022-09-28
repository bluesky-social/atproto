import axios from 'axios'
import { CID } from 'multiformats/cid'
import { DidableKey } from '@adxp/crypto'
import { check, cidForData } from '@adxp/common'
import * as operations from '../lib/operations'
import * as t from '../lib/types'

export class PlcClient {
  constructor(public url: string) {}

  async getDocument(did: string): Promise<t.DidDocument> {
    const res = await axios.get(`${this.url}/${encodeURIComponent(did)}`)
    return res.data
  }

  async getDocumentData(did: string): Promise<t.DocumentData> {
    const res = await axios.get(`${this.url}/data/${encodeURIComponent(did)}`)
    return res.data
  }

  async getOperationLog(did: string): Promise<t.Operation[]> {
    const res = await axios.get(`${this.url}/log/${encodeURIComponent(did)}`)
    return res.data.log
  }

  postOpUrl(did: string): string {
    return `${this.url}/${encodeURIComponent(did)}`
  }

  async createDid(
    signingKey: DidableKey,
    recoveryKey: string,
    username: string,
    service: string,
  ): Promise<string> {
    const op = await operations.create(
      signingKey,
      recoveryKey,
      username,
      service,
    )
    if (!check.is(op, t.def.createOp)) {
      throw new Error('Not a valid create operation')
    }
    const did = await operations.didForCreateOp(op)
    await axios.post(this.postOpUrl(did), op)
    return did
  }

  async getPrev(did): Promise<CID> {
    const log = await this.getOperationLog(did)
    if (log.length === 0) {
      throw new Error(`Could not make update: DID does not exist: ${did}`)
    }
    return cidForData(log[log.length - 1])
  }

  async rotateSigningKey(
    did: string,
    newKey: string,
    signingKey: DidableKey,
    prev?: CID,
  ) {
    prev = prev ? prev : await this.getPrev(did)
    const op = await operations.rotateSigningKey(
      newKey,
      prev.toString(),
      signingKey,
    )
    await axios.post(this.postOpUrl(did), op)
  }

  async rotateRecoveryKey(
    did: string,
    newKey: string,
    signingKey: DidableKey,
    prev?: CID,
  ) {
    prev = prev ? prev : await this.getPrev(did)
    const op = await operations.rotateRecoveryKey(
      newKey,
      prev.toString(),
      signingKey,
    )
    await axios.post(this.postOpUrl(did), op)
  }

  async updateUsername(did: string, username: string, signingKey: DidableKey) {
    const prev = await this.getPrev(did)
    const op = await operations.updateUsername(
      username,
      prev.toString(),
      signingKey,
    )
    await axios.post(this.postOpUrl(did), op)
  }

  async updateAtpPds(did: string, service: string, signingKey: DidableKey) {
    const prev = await this.getPrev(did)
    const op = await operations.updateAtpPds(
      service,
      prev.toString(),
      signingKey,
    )
    await axios.post(this.postOpUrl(did), op)
  }
}

export default PlcClient
