import { ensureAtpDocument } from '@atproto/identity'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { normalizeAndValidateHandle } from '../../../../handle'
import * as plc from '@did-plc/lib'
import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { cborDecode, check, cidForCbor } from '@atproto/common'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.temp.transferAccount({
    handler: async ({ input }) => {
      const { did, plcOp } = input.body
      // normalize & ensure valid handle
      const handle = await normalizeAndValidateHandle({
        ctx,
        handle: input.body.handle,
        did: input.body.did,
      })

      // check that the handle and email are available
      const handleAccnt = await ctx.accountManager.getAccount(handle)
      if (handleAccnt) {
        throw new InvalidRequestError(`Handle already taken: ${handle}`)
      }

      const signingDidKey = await verifyDidAndPlcOp(ctx, did, handle, plcOp)
      const signingKey = await ctx.actorStore.getReservedKeypair(signingDidKey)

      await ctx.actorStore.create(did, signingKey, (actorTxn) => {
        return actorTxn.repo.createRepo([])
      })
      await ctx.actorStore.storePlcOp(did, plcOp)
      await ctx.actorStore.clearReservedKeypair(signingDidKey)

      const { access, refresh } = await ctx.accountManager.registerAccount({
        did,
        handle,
      })

      return {
        encoding: 'application/json',
        body: {
          handle,
          did: did,
          accessJwt: access.jwt,
          refreshJwt: refresh.jwt,
        },
      }
    },
  })
}

const verifyDidAndPlcOp = async (
  ctx: AppContext,
  did: string,
  handle: string,
  plcOpBytes: Uint8Array,
) => {
  const plcOp = cborDecode(plcOpBytes)
  if (!check.is(plcOp, plc.def.operation)) {
    throw new Error('')
  }
  await plc.assureValidOp(plcOp)
  const prev = await ctx.plcClient.getLastOp(did)
  if (!prev || prev.type === 'plc_tombstone') {
    throw new Error('invalid prev')
  }
  const prevCid = await cidForCbor(prev)
  if (plcOp.prev?.toString() !== prevCid.toString()) {
    throw new Error('mismatched prevs')
  }
  const normalizedPrev = plc.normalizeOp(prev)
  await plc.assureValidSig(normalizedPrev.rotationKeys, plcOp)
  const doc = plc.formatDidDoc({ did, ...plcOp })
  const data = ensureAtpDocument(doc)
  if (handle !== data.handle) {
    throw new Error('mismatched handle')
  } else if (!plcOp.rotationKeys.includes(ctx.plcRotationKey.did())) {
    throw new Error('does not include plc rotation key')
  } else if (data.pds !== ctx.cfg.service.publicUrl) {
    throw new Error('service does not match')
  }
  return data.signingKey
}
