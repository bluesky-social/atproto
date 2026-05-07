import { ServiceImpl } from '@connectrpc/connect'
import { Service } from '../../../proto/bsky_connect'
import { DocumentWithPublication } from '../../../proto/bsky_pb'
import { Database } from '../db'

export default (_db: Database): Partial<ServiceImpl<typeof Service>> => ({
  async getSiteStandardDocumentsWithPublication(req) {
    return {
      results: req.uris.map(() => new DocumentWithPublication({})),
    }
  },
})
