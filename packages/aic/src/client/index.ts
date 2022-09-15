import axios from 'axios'
import { CID } from 'multiformats/cid'
import { DidableKey } from '@adxp/crypto'
import { check, cidForData } from '@adxp/common'
import * as operations from '../lib/operations'
import * as t from '../lib/types'

export class AicClient {
  constructor(public url: string) {}

  async getDocument(did: string): Promise<t.DocumentData> {
    const res = await axios.get(`${this.url}/${did}`)
    return res.data
  }

  async getOperationLog(did: string): Promise<t.Operation[]> {
    const res = await axios.get(`${this.url}/log/${did}`)
    return res.data.log
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
    await axios.post(`${this.url}/${did}`, op)
    return did
  }

  async getPrev(did): Promise<CID> {
    const log = await this.getOperationLog(did)
    if (log.length === 0) {
      throw new Error(`Could not make update: DID does not exist: ${did}`)
    }
    return cidForData(log[log.length - 1])
  }

  async rotateSigningKey(did: string, newKey: string, signingKey: DidableKey) {
    const prev = await this.getPrev(did)
    const op = await operations.rotateSigningKey(
      newKey,
      prev.toString(),
      signingKey,
    )
    await axios.post(`${this.url}/${did}`, op)
  }

  async rotateRecoveryKey(did: string, newKey: string, signingKey: DidableKey) {
    const prev = await this.getPrev(did)
    const op = await operations.rotateRecoveryKey(
      newKey,
      prev.toString(),
      signingKey,
    )
    await axios.post(`${this.url}/${did}`, op)
  }

  async updateUsername(did: string, username: string, signingKey: DidableKey) {
    const prev = await this.getPrev(did)
    const op = await operations.updateUsername(
      username,
      prev.toString(),
      signingKey,
    )
    await axios.post(`${this.url}/${did}`, op)
  }

  async updateService(did: string, service: string, signingKey: DidableKey) {
    const prev = await this.getPrev(did)
    const op = await operations.updateService(
      service,
      prev.toString(),
      signingKey,
    )
    await axios.post(`${this.url}/${did}`, op)
  }
}

export default AicClient
