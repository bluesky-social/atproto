import { ServiceImpl } from '@connectrpc/connect'
import { Service } from '../../../proto/bsky_connect.js'
import { Database } from '../db/index.js'

export default (_db: Database): Partial<ServiceImpl<typeof Service>> => ({
  async getSiteStandardRecordsByURI() {
    return { documents: [], publications: [] }
  },
  async getSiteStandardRecordsByRef() {
    return { documents: [], publications: [] }
  },
})
