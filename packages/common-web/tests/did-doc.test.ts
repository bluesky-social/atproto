import { type DidDocument, getKemDidKey, getKemKey } from '../src/index.js'

describe('KEM key', () => {
  const doc: DidDocument = {
    id: 'did:plc:a',
    verificationMethod: [
      {
        id: '#atproto',
        type: 'Multikey',
        controller: 'did:plc:a',
        publicKeyMultibase: 'zSig',
      },
      {
        id: '#atproto_kem',
        type: 'Multikey',
        controller: 'did:plc:a',
        publicKeyMultibase: 'zKem',
      },
    ],
  }

  it('reads the #atproto_kem verification method', () => {
    expect(getKemKey(doc)).toEqual({
      type: 'Multikey',
      publicKeyMultibase: 'zKem',
    })
    expect(getKemDidKey(doc)).toBe('did:key:zKem')
  })

  it('is undefined when the document has no KEM key', () => {
    const withoutKem = {
      ...doc,
      verificationMethod: [doc.verificationMethod![0]],
    }
    expect(getKemKey(withoutKem)).toBeUndefined()
    expect(getKemDidKey(withoutKem)).toBeUndefined()
  })
})
