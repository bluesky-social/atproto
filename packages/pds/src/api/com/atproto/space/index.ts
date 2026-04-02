import { Server } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context'
import applyWrites from './applyWrites'
import createRecord from './createRecord'
import deleteRecord from './deleteRecord'
import getRecord from './getRecord'
import listRecords from './listRecords'
import putRecord from './putRecord'
import uploadBlob from './uploadBlob'

export default function (server: Server, ctx: AppContext) {
  applyWrites(server, ctx)
  createRecord(server, ctx)
  deleteRecord(server, ctx)
  getRecord(server, ctx)
  listRecords(server, ctx)
  putRecord(server, ctx)
  uploadBlob(server, ctx)
}
