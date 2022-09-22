import z from 'zod'
import { DidDocument } from './types'

const testEntry = z.object({
  name: z.string(),
  service: z.string(),
})
export type TestEntry = z.infer<typeof testEntry>

// globals
// =

export class DidTestRegistry {
  entries: Map<string, TestEntry> = new Map()

  resolve(did: string) {
    const name = did.split(':')[2] || ''
    const entry = this.entries.get(name)
    if (!entry) {
      throw new Error(`Entry not found: ${did}`)
    }
    return toDidDocument(did, entry)
  }

  set(name: string, entry: TestEntry) {
    this.entries.set(name, entry)
  }
}

// helpers
// =

function toDidDocument(did: string, entry: TestEntry): DidDocument {
  return {
    '@context': ['https://www.w3.org/ns/did/v1'],
    id: did,
    alsoKnownAs: [`https://${entry.name}`],
    verificationMethod: [
      /*TODO*/
    ],
    assertionMethod: [
      /* TODO `${did}#signingKey`*/
    ],
    capabilityInvocation: [
      /* TODO `${did}#signingKey`*/
    ],
    capabilityDelegation: [
      /* TODO `${did}#signingKey`*/
    ],
    service: [
      {
        id: `${did}#atpPds`,
        type: 'AtpPersonalDataServer',
        serviceEndpoint: entry.service,
      },
    ],
  }
}
