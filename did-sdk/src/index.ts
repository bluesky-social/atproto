import * as Web from './web/web.js'
import * as Key from './key/key.js'
// import * as ION from './ion/ion.js'
import { DidWebServer } from './web/server.js'
import { DidDocAPI, ReadOnlyDidDocAPI } from './did-documents.js'

export async function resolve(didUri: string): Promise<ReadOnlyDidDocAPI> {
  const didMethod = didUri.split(':').at(1)
  if (didMethod === 'web') {
    return Web.resolve(didUri)
  }
  if (didMethod === 'key') {
    return Key.resolve(didUri)
  }
  if (didMethod === 'ion') {
    // return ION.resolve(didUri)
  }
  throw new Error(`Unsupported did method (${didMethod}) ${didUri}`)
}

// export async function create(
//   method: 'ion' | 'key',
//   opts: any,
// ): Promise<DidDocAPI> {
//   throw new Error('TODO')
// }

// export async function inst(
//   method: 'ion' | 'key',
//   state: any,
// ): Promise<DidDocAPI> {
//   throw new Error('TODO')
// }

export async function createDidWebServer(port = 9999): Promise<DidWebServer> {
  const s = new DidWebServer(port)
  await s.whenReady
  return s
}

export { KeyCapabilitySection, DIDDocument } from 'did-resolver'
export { DidWebServer } from './web/server.js'
/*export * as Web from './web/web.js'
export * as Key from './key/key.js'
export * as ION from './ion/ion.js'

export { DidDocAPI, ReadOnlyDidDocAPI } from './did-documents.js'
export { KeyPair, generateKeyPair } from './keypairs.js'*/
