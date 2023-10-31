import { ensureAtpDocument } from '@atproto/identity'
import * as plc from '@did-plc/lib'
import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { cborDecode, check, cidForCbor } from '@atproto/common'
import { InvalidRequestError } from '@atproto/xrpc-server'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.temp.transferAccount({
    handler: async ({ input }) => {
      const { did, plcOp, handle } = input.body

      const signingKey = await ctx.actorStore.keypair(did)
      await verifyDidAndPlcOp(ctx, did, handle, signingKey.did(), plcOp)

      const { accessJwt, refreshJwt } =
        await ctx.accountManager.registerAccount({
          did,
          handle,
        })

      return {
        encoding: 'application/json',
        body: {
          handle,
          did: did,
          accessJwt: accessJwt,
          refreshJwt: refreshJwt,
        },
      }
    },
  })
}

const verifyDidAndPlcOp = async (
  ctx: AppContext,
  did: string,
  handle: string,
  signingKey: string,
  plcOpBytes: Uint8Array,
) => {
  const plcOp = cborDecode(plcOpBytes)
  if (!check.is(plcOp, plc.def.operation)) {
    throw new InvalidRequestError('invalid plc operation', 'IncompatibleDidDoc')
  }
  await plc.assureValidOp(plcOp)
  const prev = await ctx.plcClient.getLastOp(did)
  if (!prev || prev.type === 'plc_tombstone') {
    throw new InvalidRequestError(
      'no accessible prev for did',
      'IncompatibleDidDoc',
    )
  }
  const prevCid = await cidForCbor(prev)
  if (plcOp.prev?.toString() !== prevCid.toString()) {
    throw new InvalidRequestError(
      'invalid prev on plc operation',
      'IncompatibleDidDoc',
    )
  }
  const normalizedPrev = plc.normalizeOp(prev)
  await plc.assureValidSig(normalizedPrev.rotationKeys, plcOp)
  const doc = plc.formatDidDoc({ did, ...plcOp })
  const data = ensureAtpDocument(doc)
  if (handle !== data.handle) {
    throw new InvalidRequestError(
      'invalid handle on plc operation',
      'IncompatibleDidDoc',
    )
  } else if (data.pds !== ctx.cfg.service.publicUrl) {
    throw new InvalidRequestError(
      'invalid service on plc operation',
      'IncompatibleDidDoc',
    )
  } else if (data.signingKey !== signingKey) {
    throw new InvalidRequestError(
      'invalid signing key on plc operation',
      'IncompatibleDidDoc',
    )
  }
}
