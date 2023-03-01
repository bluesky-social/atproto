import AppContext from '../../../../context'
import { Server } from '../../../../lexicon'
import batchWrite from './batchWrite'
import createRecord from './createRecord'
import deleteRecord from './deleteRecord'
import describe from './describe'
import getRecord from './getRecord'
import listRecords from './listRecords'
import putRecord from './putRecord'

export default function (server: Server, ctx: AppContext) {
  batchWrite(server, ctx)
  createRecord(server, ctx)
  deleteRecord(server, ctx)
  describe(server, ctx)
  getRecord(server, ctx)
  listRecords(server, ctx)
  putRecord(server, ctx)
}
