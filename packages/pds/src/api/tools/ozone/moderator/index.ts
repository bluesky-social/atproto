import AppContext from '../../../../context'
import { Server } from '../../../../lexicon'
import addUser from './addUser'
import deleteUser from './deleteUser'
import listUsers from './listUsers'
import updateUser from './updateUser'

export default function (server: Server, ctx: AppContext) {
  addUser(server, ctx)
  deleteUser(server, ctx)
  listUsers(server, ctx)
  updateUser(server, ctx)
}
