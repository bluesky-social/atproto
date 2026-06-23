import { Server } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context.js'
import applyWrites from './applyWrites.js'
import createRecord from './createRecord.js'
import deleteRecord from './deleteRecord.js'
import getBlob from './getBlob.js'
import getDelegationToken from './getDelegationToken.js'
import getRecord from './getRecord.js'
import getRepoState from './getRepoState.js'
import getSpace from './getSpace.js'
import getSpaceCredential from './getSpaceCredential.js'
import listRecords from './listRecords.js'
import listRepoOps from './listRepoOps.js'
import listRepos from './listRepos.js'
import listSpaces from './listSpaces.js'
import notifySpaceDeleted from './notifySpaceDeleted.js'
import notifyWrite from './notifyWrite.js'
import putRecord from './putRecord.js'
import registerNotify from './registerNotify.js'

export default function (server: Server, ctx: AppContext) {
  applyWrites(server, ctx)
  createRecord(server, ctx)
  deleteRecord(server, ctx)
  getBlob(server, ctx)
  getDelegationToken(server, ctx)
  getRecord(server, ctx)
  getRepoState(server, ctx)
  getSpace(server, ctx)
  getSpaceCredential(server, ctx)
  listRecords(server, ctx)
  listRepoOps(server, ctx)
  listRepos(server, ctx)
  listSpaces(server, ctx)
  notifySpaceDeleted(server, ctx)
  notifyWrite(server, ctx)
  putRecord(server, ctx)
  registerNotify(server, ctx)
}
