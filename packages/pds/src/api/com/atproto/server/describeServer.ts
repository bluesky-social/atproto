import { AppContext } from '../../../../context'
import { Server } from '../../../../lexicon'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.server.describeServer(() => {
    const availableUserDomains = ctx.cfg.identity.serviceHandleDomains
    const inviteCodeRequired = ctx.cfg.invites.required
    const privacyPolicy = ctx.cfg.service.privacyPolicyUrl
    const termsOfService = ctx.cfg.service.termsOfServiceUrl
    const contactEmailAddress = ctx.cfg.service.contactEmailAddress
    const acceptingImports = ctx.cfg.service.acceptingImports
    const maxImportSize = ctx.cfg.service.maxImportSize

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
        imports: {
          accepted: acceptingImports,
          maxSize: maxImportSize,
        },
      },
    }
  })
}
