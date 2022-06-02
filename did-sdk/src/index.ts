// import * as Web from './web/web.js'
import * as Key from './key/key.js'
// import * as ION from './ion/ion.js'
import { DidDocAPI, ReadOnlyDidDocAPI } from './did-documents.js'

export async function resolve(didUri: string): Promise<ReadOnlyDidDocAPI> {
  const didMethod = didUri.split(':').at(1)
  if (didMethod === 'web') {
    // return Web.resolve(didUri)
  }
  if (didMethod === 'key') {
    return Key.resolve(didUri)
  }
  if (didMethod === 'ion') {
    // return ION.resolve(didUri)
  }
  throw new Error(`Unsupported did method (${didMethod}) ${didUri}`)
}
/*
export async function create(
  method: 'ion' | 'key',
  opts: any,
): Promise<DidDocAPI> {
  throw new Error('TODO')
}

export async function inst(
  method: 'ion' | 'key',
  state: any,
): Promise<DidDocAPI> {
  throw new Error('TODO')
}

export async function createDidWebServer(port = 9999): Promise<any> {
  throw new Error('TODO')
}

/*export * as Web from './web/web.js'
export * as Key from './key/key.js'
export * as ION from './ion/ion.js'
export { KeyCapabilitySection, DIDDocument } from 'did-resolver'
export { DidDocAPI, ReadOnlyDidDocAPI } from './did-documents.js'
export { KeyPair, generateKeyPair } from './keypairs.js'*/
