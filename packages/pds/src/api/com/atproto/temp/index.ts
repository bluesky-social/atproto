import AppContext from '../../../../context'
import { Server } from '../../../../lexicon'
import requestPhoneVerification from './requestPhoneVerification'
import checkSignupAvailability from './checkSignupAvailability'
import sendSignupQueueEmails from './sendSignupQueueEmails'

export default function (server: Server, ctx: AppContext) {
  requestPhoneVerification(server, ctx)
  checkSignupAvailability(server, ctx)
  sendSignupQueueEmails(server, ctx)
}
