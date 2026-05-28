import { Server } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context.js'
import addMember from './addMember.js'
import applyWrites from './applyWrites.js'
import createRecord from './createRecord.js'
import createSpace from './createSpace.js'
import deleteRecord from './deleteRecord.js'
import deleteSpace from './deleteSpace.js'
import getBlob from './getBlob.js'
import getMemberGrant from './getMemberGrant.js'
import getMemberOplog from './getMemberOplog.js'
import getMemberState from './getMemberState.js'
import getMembers from './getMembers.js'
import getRecord from './getRecord.js'
import getRepoOplog from './getRepoOplog.js'
import getRepoState from './getRepoState.js'
import getSpace from './getSpace.js'
import getSpaceCredential from './getSpaceCredential.js'
import listRecords from './listRecords.js'
import listSpaces from './listSpaces.js'
import notifyMembership from './notifyMembership.js'
import notifySpaceDeleted from './notifySpaceDeleted.js'
import notifyWrite from './notifyWrite.js'
import putRecord from './putRecord.js'
import removeMember from './removeMember.js'
import updateSpaceConfig from './updateSpaceConfig.js'

export default function (server: Server, ctx: AppContext) {
  addMember(server, ctx)
  applyWrites(server, ctx)
  createRecord(server, ctx)
  createSpace(server, ctx)
  deleteRecord(server, ctx)
  deleteSpace(server, ctx)
  getBlob(server, ctx)
  getMembers(server, ctx)
  getMemberGrant(server, ctx)
  getMemberOplog(server, ctx)
  getMemberState(server, ctx)
  getRecord(server, ctx)
  getRepoOplog(server, ctx)
  getRepoState(server, ctx)
  getSpace(server, ctx)
  getSpaceCredential(server, ctx)
  listRecords(server, ctx)
  listSpaces(server, ctx)
  notifyMembership(server, ctx)
  notifySpaceDeleted(server, ctx)
  notifyWrite(server, ctx)
  putRecord(server, ctx)
  removeMember(server, ctx)
  updateSpaceConfig(server, ctx)
}
