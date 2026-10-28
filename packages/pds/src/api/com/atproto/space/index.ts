import type { Server } from '@atproto/xrpc-server'
import type { AppContext } from '../../../../context.js'
import applyWrites from './applyWrites.js'
import createRecord from './createRecord.js'
import createSpace from './createSpace.js'
import deleteRecord from './deleteRecord.js'
import deleteSpace from './deleteSpace.js'
import exportSpace from './exportSpace.js'
import getBlob from './getBlob.js'
import getDelegationToken from './getDelegationToken.js'
import getLatestCommit from './getLatestCommit.js'
import getRecord from './getRecord.js'
import getRepo from './getRepo.js'
import getSpace from './getSpace.js'
import getSpaceCredential from './getSpaceCredential.js'
import importRepo from './importRepo.js'
import importSpace from './importSpace.js'
import listBlobs from './listBlobs.js'
import listRecords from './listRecords.js'
import listRepoOps from './listRepoOps.js'
import listRepos from './listRepos.js'
import listSpaces from './listSpaces.js'
import notifyCredentialRevoked from './notifyCredentialRevoked.js'
import notifyWrite from './notifyWrite.js'
import putRecord from './putRecord.js'
import registerNotify from './registerNotify.js'
import unregisterNotify from './unregisterNotify.js'
import updateSpace from './updateSpace.js'

export default function (server: Server, ctx: AppContext) {
  applyWrites(server, ctx)
  createRecord(server, ctx)
  createSpace(server, ctx)
  deleteRecord(server, ctx)
  deleteSpace(server, ctx)
  exportSpace(server, ctx)
  getBlob(server, ctx)
  getDelegationToken(server, ctx)
  getLatestCommit(server, ctx)
  getRecord(server, ctx)
  getRepo(server, ctx)
  getSpace(server, ctx)
  getSpaceCredential(server, ctx)
  importRepo(server, ctx)
  importSpace(server, ctx)
  listBlobs(server, ctx)
  listRecords(server, ctx)
  listRepoOps(server, ctx)
  listRepos(server, ctx)
  listSpaces(server, ctx)
  notifyCredentialRevoked(server, ctx)
  notifyWrite(server, ctx)
  putRecord(server, ctx)
  registerNotify(server, ctx)
  unregisterNotify(server, ctx)
  updateSpace(server, ctx)
}
