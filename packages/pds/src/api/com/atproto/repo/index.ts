import AppContext from '../../../../context'
import { Server } from '../../../../lexicon'
import applyWrites from './applyWrites'
import createRecord from './createRecord'
import deleteRecord from './deleteRecord'
import describe from './describe'
import getRecord from './getRecord'
import listRecords from './listRecords'
import putRecord from './putRecord'
import uploadBlob from './uploadBlob'

export default function (server: Server, ctx: AppContext) {
  applyWrites(server, ctx)
  createRecord(server, ctx)
  deleteRecord(server, ctx)
  describe(server, ctx)
  getRecord(server, ctx)
  listRecords(server, ctx)
  putRecord(server, ctx)
  uploadBlob(server, ctx)
}
