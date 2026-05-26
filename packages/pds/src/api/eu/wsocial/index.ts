import { AppContext } from '../../../context'
import { Server } from '../../../lexicon'
import addNeuroLink from './admin/addNeuroLink'
import createPassInvitation from './admin/xrpc-createPassInvitation'
import getNeuroLink from './admin/getNeuroLink'
import listNeuroAccounts from './admin/listNeuroAccounts'
import removeNeuroLink from './admin/removeNeuroLink'
import updateNeuroLink from './admin/updateNeuroLink'
import linkWid from './quicklogin/xrpc-linkWid'
import allocateWidForAccount from './server/xrpc-allocateWidForAccount'
import checkHandleAvailability from './server/xrpc-checkHandleAvailability'
import requestAccountDelete from './server/xrpc-requestAccountDelete'

export default function (server: Server, ctx: AppContext) {
  createPassInvitation(server, ctx)
  addNeuroLink(server, ctx)
  getNeuroLink(server, ctx)
  listNeuroAccounts(server, ctx)
  removeNeuroLink(server, ctx)
  updateNeuroLink(server, ctx)
  allocateWidForAccount(server, ctx)
  checkHandleAvailability(server, ctx)
  requestAccountDelete(server, ctx)
  linkWid(server, ctx)
}
