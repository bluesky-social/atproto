import { MAX_RECORD_SIZE } from '@atproto/space'
import { type NsidString, SpaceRef } from '@atproto/syntax'
import { prepareCreate } from './prepare.js'
import { InvalidRecordError } from './types.js'

const COLLECTION = 'com.example.record' as NsidString

describe('prepareCreate', () => {
  // The request body limit is below this, so it isn't reachable over HTTP.
  it('refuses a space record over the size limit', async () => {
    const prepared = prepareCreate({
      did: 'did:plc:writer',
      space: SpaceRef.parse(
        'at://did:plc:authority/space/com.example.group/self',
      ),
      collection: COLLECTION,
      record: { $type: COLLECTION, text: 'x'.repeat(MAX_RECORD_SIZE) },
    })
    await expect(prepared).rejects.toThrow(InvalidRecordError)
    await expect(prepared).rejects.toThrow(/^Record too large/)
  })
})
