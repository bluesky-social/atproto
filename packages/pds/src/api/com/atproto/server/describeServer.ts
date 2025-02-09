import { AppContext } from '../../../../context'
import { Server } from '../../../../lexicon'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.server.describeServer(() => {
    const availableUserDomains = ctx.cfg.identity.serviceHandleDomains
    const inviteCodeRequired = ctx.cfg.invites.required
    const privacyPolicy = ctx.cfg.service.privacyPolicyUrl
    const termsOfService = ctx.cfg.service.termsOfServiceUrl
    const contactEmailAddress = ctx.cfg.service.contactEmailAddress

    return {
      encoding: 'application/json',
      body: {
        did: ctx.cfg.service.did,
        availableUserDomains,
        inviteCodeRequired,
        links: { privacyPolicy, termsOfService },
        contact: {
          email: contactEmailAddress,
        },
      },
    }
  })
}
