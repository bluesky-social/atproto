import AppContext from '../../../../context'
import { Server } from '../../../../lexicon'
import createTemplate from './createTemplate'
import deleteTemplate from './deleteTemplate'
import listTemplates from './listTemplates'
import updateTemplate from './updateTemplate'

export default function (server: Server, ctx: AppContext) {
  createTemplate(server, ctx)
  deleteTemplate(server, ctx)
  listTemplates(server, ctx)
  updateTemplate(server, ctx)
}
