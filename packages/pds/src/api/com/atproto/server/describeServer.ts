import { UriString } from '@atproto/lex'
import { DidString } from '@atproto/syntax'
import { Server } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context'
import { com } from '../../../../lexicons/index.js'

export default function (server: Server, ctx: AppContext) {
  server.add(com.atproto.server.describeServer, () => {
    const did = ctx.cfg.service.did as DidString
    const availableUserDomains = ctx.cfg.identity.serviceHandleDomains
    const inviteCodeRequired = ctx.cfg.invites.required
    const privacyPolicy = ctx.cfg.service.privacyPolicyUrl as UriString
    const termsOfService = ctx.cfg.service.termsOfServiceUrl as UriString
    const contactEmailAddress = ctx.cfg.service.contactEmailAddress

    return {
      encoding: 'application/json' as const,
      body: {
        did,
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
