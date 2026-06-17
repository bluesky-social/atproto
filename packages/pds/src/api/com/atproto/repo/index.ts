import { Server } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context.js'
import applyWrites from './applyWrites.js'
import createRecord from './createRecord.js'
import deleteRecord from './deleteRecord.js'
import describeRepo from './describeRepo.js'
import getRecord from './getRecord.js'
import importRepo from './importRepo.js'
import listMissingBlobs from './listMissingBlobs.js'
import listRecords from './listRecords.js'
import putRecord from './putRecord.js'
import uploadBlob from './uploadBlob.js'

export default function (server: Server, ctx: AppContext) {
  applyWrites(server, ctx)
  createRecord(server, ctx)
  deleteRecord(server, ctx)
  describeRepo(server, ctx)
  getRecord(server, ctx)
  listRecords(server, ctx)
  putRecord(server, ctx)
  uploadBlob(server, ctx)
  listMissingBlobs(server, ctx)
  importRepo(server, ctx)
}
