import { ensureAtpDocument } from '@atproto/identity'
import * as plc from '@did-plc/lib'
import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { check, cidForCbor } from '@atproto/common'
import { InvalidRequestError } from '@atproto/xrpc-server'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.temp.transferAccount({
    handler: async ({ input }) => {
      const { did, handle } = input.body

      const signingKey = await ctx.actorStore.keypair(did)
      const currRoot = await ctx.actorStore.read(did, (store) =>
        store.repo.storage.getRootDetailed(),
      )

      const plcOp = await verifyDidAndPlcOp(
        ctx,
        did,
        handle,
        signingKey.did(),
        input.body.plcOp,
      )

      await ctx.plcClient.sendOperation(did, plcOp)

      const { accessJwt, refreshJwt } = await ctx.accountManager.createAccount({
        did,
        handle,
        repoCid: currRoot.cid,
        repoRev: currRoot.rev,
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
  plcOp: unknown,
): Promise<plc.Operation> => {
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
  return plcOp
}
