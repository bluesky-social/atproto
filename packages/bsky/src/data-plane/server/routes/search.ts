import { ServiceImpl } from '@connectrpc/connect'
import { Service } from '../../gen/bsky_connect'
import { Database } from '../../../db'

export default (db: Database): Partial<ServiceImpl<typeof Service>> => ({
  async searchActors(req) {
    throw new Error('unimplemented')
  },
  async searchPosts(req) {
    throw new Error('unimplemented')
  },
})
