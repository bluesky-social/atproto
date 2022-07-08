/**
 * NOTE
 * This did:web service is not meant for production use.
 * It's specifically designed for the dev env.
 */

import axios from 'axios'
import * as didSdk from '@adxp/did-sdk'

export default class DevEnvDidWebClient {
  origin: string

  constructor(url: string) {
    this.origin = new URL(url).origin
  }

  async resolve(did: string): Promise<didSdk.DIDDocument> {
    const res = await didSdk.web.resolve(did)
    return res.didDoc
  }

  async put(didDoc: didSdk.DIDDocument): Promise<void> {
    await axios.put(this.origin, didDoc)
  }
}
