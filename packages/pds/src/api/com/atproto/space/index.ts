import { Server } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context'
import addMember from './addMember'
import applyWrites from './applyWrites'
import createRecord from './createRecord'
import createSpace from './createSpace'
import deleteRecord from './deleteRecord'
import getMembers from './getMembers'
import getMemberGrant from './getMemberGrant'
import getMemberOplog from './getMemberOplog'
import getMemberState from './getMemberState'
import getRecord from './getRecord'
import getRepoOplog from './getRepoOplog'
import getRepoState from './getRepoState'
import getSpaceCredential from './getSpaceCredential'
import listRecords from './listRecords'
import listSpaces from './listSpaces'
import notifyMembership from './notifyMembership'
import notifyWrite from './notifyWrite'
import putRecord from './putRecord'
import removeMember from './removeMember'
import uploadBlob from './uploadBlob'

export default function (server: Server, ctx: AppContext) {
  addMember(server, ctx)
  applyWrites(server, ctx)
  createRecord(server, ctx)
  createSpace(server, ctx)
  deleteRecord(server, ctx)
  getMembers(server, ctx)
  getMemberGrant(server, ctx)
  getMemberOplog(server, ctx)
  getMemberState(server, ctx)
  getRecord(server, ctx)
  getRepoOplog(server, ctx)
  getRepoState(server, ctx)
  getSpaceCredential(server, ctx)
  listRecords(server, ctx)
  listSpaces(server, ctx)
  notifyMembership(server, ctx)
  notifyWrite(server, ctx)
  putRecord(server, ctx)
  removeMember(server, ctx)
  uploadBlob(server, ctx)
}
