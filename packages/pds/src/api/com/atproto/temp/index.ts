import AppContext from '../../../../context'
import { Server } from '../../../../lexicon'
import checkSignupQueue from './checkSignupQueue'
import requestPhoneVerification from './requestPhoneVerification'

export default function (server: Server, ctx: AppContext) {
  requestPhoneVerification(server, ctx)
  checkSignupQueue(server, ctx)
}
