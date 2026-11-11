import type { Server } from '@atproto/xrpc-server'
import type { AppContext } from '../../../../context.js'
import applyWrites from './applyWrites.js'
import clearRecords from './clearRecords.js'
import createRecord from './createRecord.js'
import createSpace from './createSpace.js'
import deleteRecord from './deleteRecord.js'
import deleteSpace from './deleteSpace.js'
import exportSpaceMeta from './exportSpaceMeta.js'
import getBlob from './getBlob.js'
import getDelegationToken from './getDelegationToken.js'
import getLatestCommit from './getLatestCommit.js'
import getRecord from './getRecord.js'
import getRepo from './getRepo.js'
import getSpace from './getSpace.js'
import getSpaceCredential from './getSpaceCredential.js'
import importRepo from './importRepo.js'
import importSpaceMeta from './importSpaceMeta.js'
import listBlobs from './listBlobs.js'
import listRecords from './listRecords.js'
import listRepoOps from './listRepoOps.js'
import listSpaces from './listSpaces.js'
import listWriters from './listWriters.js'
import notifyCredentialsRevoked from './notifyCredentialsRevoked.js'
import notifyRepoUpdate from './notifyRepoUpdate.js'
import putRecord from './putRecord.js'
import removeWriter from './removeWriter.js'
import updateSpace from './updateSpace.js'

export default function (server: Server, ctx: AppContext) {
  applyWrites(server, ctx)
  clearRecords(server, ctx)
  createRecord(server, ctx)
  createSpace(server, ctx)
  deleteRecord(server, ctx)
  deleteSpace(server, ctx)
  exportSpaceMeta(server, ctx)
  getBlob(server, ctx)
  getDelegationToken(server, ctx)
  getLatestCommit(server, ctx)
  getRecord(server, ctx)
  getRepo(server, ctx)
  getSpace(server, ctx)
  getSpaceCredential(server, ctx)
  importRepo(server, ctx)
  importSpaceMeta(server, ctx)
  listBlobs(server, ctx)
  listRecords(server, ctx)
  listRepoOps(server, ctx)
  listSpaces(server, ctx)
  listWriters(server, ctx)
  notifyCredentialsRevoked(server, ctx)
  notifyRepoUpdate(server, ctx)
  putRecord(server, ctx)
  removeWriter(server, ctx)
  updateSpace(server, ctx)
}
