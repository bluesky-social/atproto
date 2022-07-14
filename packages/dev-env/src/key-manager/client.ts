/**
 * NOTE
 * This key manager service is not meant for production use.
 * It's specifically designed for the dev env.
 */

import axios from 'axios'
import * as didSdk from '@adxp/did-sdk'

export interface CreateAccountParams {
  username: string
  didServer: string
}

export interface CreateAccountResponse {
  did: string
  didKey: string
  didDoc: didSdk.DIDDocument
  didDocSignature: false
}

export interface SignDidDocUpdateResponse {
  did: string
  didDoc: didSdk.DIDDocument
  didDocSignature: false
}

export default class DevEnvKeyManagerClient {
  origin: string

  constructor(url: string) {
    this.origin = new URL(url).origin
  }

  async createAccount(
    params: CreateAccountParams,
  ): Promise<CreateAccountResponse> {
    const url = new URL('/account', this.origin).toString()
    return axios.post(url, params)
  }

  async signDidDocUpdate(
    did: string,
    didDoc: didSdk.DIDDocument,
  ): Promise<SignDidDocUpdateResponse> {
    const url = new URL(`/sign-did-doc-update/${did}`, this.origin).toString()
    return axios.post(url, didDoc)
  }
}
