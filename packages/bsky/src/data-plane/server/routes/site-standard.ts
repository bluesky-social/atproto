import type { ServiceImpl } from '@connectrpc/connect'
import type { Service } from '../../../proto/bsky_connect.js'
import type { Database } from '../db/index.js'

export default (_db: Database): Partial<ServiceImpl<typeof Service>> => ({
  async getSiteStandardRecordsByURI() {
    return { documents: [], publications: [] }
  },
  async getSiteStandardRecordsByRef() {
    return { documents: [], publications: [] }
  },
})
