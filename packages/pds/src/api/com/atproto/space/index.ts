import type { Server } from '@atproto/xrpc-server'
import type { AppContext } from '../../../../context.js'
import applyWrites from './applyWrites.js'
import createRecord from './createRecord.js'
import deleteRecord from './deleteRecord.js'
import getBlob from './getBlob.js'
import getDelegationToken from './getDelegationToken.js'
import getLatestCommit from './getLatestCommit.js'
import getRecord from './getRecord.js'
import getRepo from './getRepo.js'
import getSpaceCredential from './getSpaceCredential.js'
import listBlobs from './listBlobs.js'
import listRecords from './listRecords.js'
import listRepoOps from './listRepoOps.js'
import listRepos from './listRepos.js'
import listSpaces from './listSpaces.js'
import notifyWrite from './notifyWrite.js'
import putRecord from './putRecord.js'
import registerNotify from './registerNotify.js'
import unregisterNotify from './unregisterNotify.js'

export default function (server: Server, ctx: AppContext) {
  applyWrites(server, ctx)
  createRecord(server, ctx)
  deleteRecord(server, ctx)
  getBlob(server, ctx)
  getDelegationToken(server, ctx)
  getLatestCommit(server, ctx)
  getRecord(server, ctx)
  getRepo(server, ctx)
  getSpaceCredential(server, ctx)
  listBlobs(server, ctx)
  listRecords(server, ctx)
  listRepoOps(server, ctx)
  listRepos(server, ctx)
  listSpaces(server, ctx)
  notifyWrite(server, ctx)
  putRecord(server, ctx)
  registerNotify(server, ctx)
  unregisterNotify(server, ctx)
}
