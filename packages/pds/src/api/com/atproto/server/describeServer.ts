import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.server.describeServer(() => {
    const availableUserDomains = ctx.cfg.identity.serviceHandleDomains
    const inviteCodeRequired = ctx.cfg.invites.required
    const privacyPolicy = ctx.cfg.service.privacyPolicyUrl
    const termsOfService = ctx.cfg.service.termsOfServiceUrl

    return {
      encoding: 'application/json',
      body: {
        did: ctx.cfg.service.did,
        availableUserDomains,
        inviteCodeRequired,
        links: { privacyPolicy, termsOfService },
      },
    }
  })
}
