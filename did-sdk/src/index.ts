import * as web from './web/web.js'
import * as key from './key/key.js'
import * as ion from './ion/ion.js'
import { DidWebServer } from './web/server.js'
import { ReadOnlyDidDocAPI } from './did-documents.js'

export async function resolve(didUri: string): Promise<ReadOnlyDidDocAPI> {
  const didMethod = didUri.split(':').at(1)
  if (didMethod === 'web') {
    return web.resolve(didUri)
  }
  if (didMethod === 'key') {
    return key.resolve(didUri)
  }
  if (didMethod === 'ion') {
    return ion.resolve(didUri)
  }
  throw new Error(`Unsupported did method (${didMethod}) ${didUri}`)
}

export async function createDidWebServer(port = 9999): Promise<DidWebServer> {
  const s = new DidWebServer(port)
  await s.whenReady
  return s
}

export { KeyCapabilitySection, DIDDocument } from 'did-resolver'
export { DidDocAPI, ReadOnlyDidDocAPI } from './did-documents.js'
export { DidWebServer } from './web/server.js'
export * as web from './web/web.js'
export * as key from './key/key.js'
export * as ion from './ion/ion.js'
