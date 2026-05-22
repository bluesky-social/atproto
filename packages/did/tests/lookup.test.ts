import { AtprotoDidDocument } from '../src/atproto.js'
import { lookupDidReference } from '../src/lookup.js'

const did = 'did:plc:l3rouwludahu3ui3bt66mfvj' as const
const doc: AtprotoDidDocument = {
  id: did,
  alsoKnownAs: [`at://example.test`],
  verificationMethod: [
    {
      id: `${did}#atproto`,
      type: 'Multikey',
      controller: did,
      publicKeyMultibase: 'zQ3shXjHeiBuRCKmM36cuYnm7YEMzhGnCmCSKvxMDxxqhuTRA',
    },
    {
      id: `${did}#atproto_label`,
      type: 'Multikey',
      controller: did,
      publicKeyMultibase: 'zQ3shg9SoKuQATZeoXfTLQNyrW2hWPmtRimg7ZbFkBdJ8mPe5',
    },
  ],
  service: [
    {
      id: `${did}#atproto_pds`,
      type: 'AtprotoPersonalDataServer',
      serviceEndpoint: 'https://pds.example.test',
    },
  ],
}

describe('lookupDidReference', () => {
  it('resolves a relative reference against the doc.id', () => {
    const vm = lookupDidReference(doc, '#atproto', 'verificationMethod')
    expect(vm?.id).toBe(`${did}#atproto`)
  })

  it('resolves an absolute reference matching doc.id', () => {
    const vm = lookupDidReference(
      doc,
      `${did}#atproto_label`,
      'verificationMethod',
    )
    expect(vm?.id).toBe(`${did}#atproto_label`)
  })

  it('returns null for an absolute reference to a different DID', () => {
    const vm = lookupDidReference(
      doc,
      `did:plc:abcdefghijklmnopqrstuvwx#atproto`,
      'verificationMethod',
    )
    expect(vm).toBeNull()
  })

  it('returns null when the fragment is not in the section', () => {
    const vm = lookupDidReference(doc, '#nope', 'verificationMethod')
    expect(vm).toBeNull()
  })

  it('looks up service entries when section is service', () => {
    const svc = lookupDidReference(doc, '#atproto_pds', 'service')
    expect(svc?.id).toBe(`${did}#atproto_pds`)
  })

  it('returns null when looking for a verificationMethod fragment in service', () => {
    const svc = lookupDidReference(doc, '#atproto', 'service')
    expect(svc).toBeNull()
  })
})
