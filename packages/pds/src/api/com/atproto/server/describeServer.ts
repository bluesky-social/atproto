import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.server.describeServer(() => {
    const availableUserDomains = ctx.cfg.availableUserDomains
    const inviteCodeRequired = ctx.cfg.inviteRequired
    const privacyPolicy = ctx.cfg.privacyPolicyUrl
    const termsOfService = ctx.cfg.termsOfServiceUrl

    return {
      encoding: 'application/json',
      body: {
        availableUserDomains,
        inviteCodeRequired,
        links: { privacyPolicy, termsOfService },
      },
    }
  })
}
