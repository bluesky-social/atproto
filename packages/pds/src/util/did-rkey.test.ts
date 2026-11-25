import { type DidString, isValidRecordKey } from '@atproto/syntax'
import { didToRecordKey, recordKeyToDid } from './did-rkey.js'

describe('DID record keys', () => {
  it('leaves the port of a localhost did:web unencoded', () => {
    const rkey = didToRecordKey('did:web:localhost%3A2583' as DidString)
    expect(rkey).toBe('did:web:localhost:2583')
    expect(isValidRecordKey(rkey)).toBe(true)
    expect(recordKeyToDid(rkey)).toBe('did:web:localhost%3A2583')
  })

  it.each(['did:plc:ewvi7nxzyoun6zhxrhs64oiz', 'did:web:example.com'])(
    'keys %s by the DID itself',
    (did) => {
      expect(didToRecordKey(did as DidString)).toBe(did)
      expect(recordKeyToDid(did)).toBe(did)
    },
  )
})
