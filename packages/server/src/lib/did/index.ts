import * as didTest from './did-test'

export function resolve(did: string) {
  if (did.startsWith('did:test:')) {
    return didTest.resolve(did)
  }
  throw new Error(`Unsupported did method: ${did}`)
}

export * as didTest from './did-test'
