import type { UriString } from '@atproto/lex'
import type { Server } from '@atproto/xrpc-server'
import type { AppContext } from '../../../../context.js'
import { com } from '../../../../lexicons/index.js'

export default function (server: Server, ctx: AppContext) {
  const { entrywayClient } = ctx

  const did = ctx.cfg.service.did
  const availableUserDomains = ctx.cfg.identity.serviceHandleDomains
  const inviteCodeRequired = ctx.cfg.invites.required
  const privacyPolicy = ctx.cfg.service.privacyPolicyUrl as UriString
  const termsOfService = ctx.cfg.service.termsOfServiceUrl as UriString
  const contactEmailAddress = ctx.cfg.service.contactEmailAddress

  if (entrywayClient) {
    server.add(com.atproto.server.describeServer, {
      handler: async ({ params }) => {
        // @NOTE We don't report `inviteCodeRequired` here because account
        // creation is dictated by the entryway. We *do* return
        // `availableUserDomains` because it is needed for handle updates, which
        // may be performed against both the entryway and the PDS.
        const { availableUserDomains, links, contact } =
          await entrywayClient.call(com.atproto.server.describeServer, params)

        return {
          encoding: 'application/json' as const,
          body: { did, availableUserDomains, links, contact },
        }
      },
    })
  } else {
    server.add(com.atproto.server.describeServer, () => {
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
}
