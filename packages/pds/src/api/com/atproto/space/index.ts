import { Server } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context'
import addMember from './addMember'
import applyWrites from './applyWrites'
import createRecord from './createRecord'
import createSpace from './createSpace'
import deleteRecord from './deleteRecord'
import getRecord from './getRecord'
import listRecords from './listRecords'
import listSpaces from './listSpaces'
import notifyMembership from './notifyMembership'
import putRecord from './putRecord'
import removeMember from './removeMember'
import uploadBlob from './uploadBlob'

export default function (server: Server, ctx: AppContext) {
  addMember(server, ctx)
  applyWrites(server, ctx)
  createRecord(server, ctx)
  createSpace(server, ctx)
  deleteRecord(server, ctx)
  getRecord(server, ctx)
  listRecords(server, ctx)
  listSpaces(server, ctx)
  notifyMembership(server, ctx)
  putRecord(server, ctx)
  removeMember(server, ctx)
  uploadBlob(server, ctx)
}
