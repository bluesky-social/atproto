import * as web from './web/web'
import * as key from './key/key'
import * as ion from './ion/ion'
import { ReadOnlyDidDocAPI } from './did-documents'

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

export type { KeyCapabilitySection, DIDDocument } from 'did-resolver'
export { DidDocAPI, ReadOnlyDidDocAPI } from './did-documents'
export { DidWebServer } from './web/server'
export * from './web/db'
export * as web from './web/web'
export * as key from './key/key'
export * as ion from './ion/ion'
