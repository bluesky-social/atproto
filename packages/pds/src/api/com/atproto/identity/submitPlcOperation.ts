import * as plc from '@did-plc/lib'
import { check } from '@atproto/common'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context'
import { Server } from '../../../../lexicon'
import { httpLogger as log } from '../../../../logger'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.identity.submitPlcOperation({
    auth: ctx.authVerifier.authorization({
      authorize: (permissions) => {
        permissions.assertIdentity({ attr: '*' })
      },
    }),
    handler: async ({ auth, input }) => {
      const requester = auth.credentials.did
      const op = input.body.operation

      if (!check.is(op, plc.def.operation)) {
        throw new InvalidRequestError('Invalid operation')
      }

      const rotationKey =
        ctx.cfg.entryway?.plcRotationKey ?? ctx.plcRotationKey.did()
      if (!op.rotationKeys.includes(rotationKey)) {
        throw new InvalidRequestError(
          "Rotation keys do not include server's rotation key",
        )
      }
      if (op.services['atproto_pds']?.type !== 'AtprotoPersonalDataServer') {
        throw new InvalidRequestError('Incorrect type on atproto_pds service')
      }
      if (op.services['atproto_pds']?.endpoint !== ctx.cfg.service.publicUrl) {
        throw new InvalidRequestError(
          'Incorrect endpoint on atproto_pds service',
        )
      }
      const signingKey = await ctx.actorStore.keypair(requester)
      if (op.verificationMethods['atproto'] !== signingKey.did()) {
        throw new InvalidRequestError('Incorrect signing key')
      }
      const account = await ctx.accountManager.getAccount(requester, {
        includeDeactivated: true,
      })
      if (
        account?.handle &&
        op.alsoKnownAs.at(0) !== `at://${account.handle}`
      ) {
        throw new InvalidRequestError('Incorrect handle in alsoKnownAs')
      }

      await ctx.plcClient.sendOperation(requester, op)
      await ctx.sequencer.sequenceIdentityEvt(requester)

      try {
        await ctx.idResolver.did.resolve(requester, true)
      } catch (err) {
        log.error(
          { err, did: requester },
          'failed to refresh did after plc update',
        )
      }
    },
  })
}
