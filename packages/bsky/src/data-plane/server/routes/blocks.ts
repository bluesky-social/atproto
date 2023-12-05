import { Database } from '../../../db'

export default (db: Database) => ({
  async getBidirectionalBlock(req) {
    throw new Error('unimplemented')
  },
  async getBlocks(req) {
    throw new Error('unimplemented')
  },
  async getBidirectionalBlockViaList(req) {
    throw new Error('unimplemented')
  },
  async getBlocklistSubscription(req) {
    throw new Error('unimplemented')
  },
  async getBlocklistSubscriptions(req) {
    throw new Error('unimplemented')
  },
})
