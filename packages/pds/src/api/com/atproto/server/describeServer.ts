import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.server.describeServer(() => {
    const availableUserDomains = ctx.cfg.availableUserDomains
    const inviteCodeRequired = ctx.cfg.inviteRequired
    const repoSigningKey = ctx.repoSigningKey.did()
    const plcRotationKeys = [ctx.cfg.recoveryKey, ctx.plcRotationKey.did()]
    const privacyPolicy = ctx.cfg.privacyPolicyUrl
    const termsOfService = ctx.cfg.termsOfServiceUrl

    return {
      encoding: 'application/json',
      body: {
        availableUserDomains,
        inviteCodeRequired,
        repoSigningKey,
        plcRotationKeys,
        links: { privacyPolicy, termsOfService },
      },
    }
  })
}
