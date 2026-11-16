import * as plc from '@did-plc/lib'
import type { DidString } from '@atproto/syntax'
import type { AppContext } from '../context.js'
import type { UnpublishableReason } from './progress.js'

export type PublishContext = Pick<
  AppContext,
  | 'actorStore'
  | 'plcClient'
  | 'idResolver'
  | 'sequencer'
  | 'plcRotationKey'
  | 'cfg'
>

export type PublishOutcome =
  'published' | 'deleted' | { unpublishable: UnpublishableReason }

export class LeaseLostError extends Error {
  constructor(did: string) {
    super(`lost the spaces migration lease on ${did}`)
  }
}

/**
 * Publishes an account's KEM key in its DID doc and emits `#identity`. Every
 * step is idempotent, so a run cut short at any point is completed by the next:
 *
 * 1. Ensure the key exists. It is on disk before it can be published.
 * 2. Read the current DID doc from its source, not a cache. If it lists our
 *    key already, skip to 4. This recovers a crash between 3 and 4.
 * 3. Publish it, if this host can, or report why it can't.
 * 4. Sequence `#identity`. The caller then records the account published.
 *
 * `'deleted'` means the account's store no longer exists.
 */
export async function publishAccount(
  ctx: PublishContext,
  did: DidString,
  holdsLease: () => Promise<boolean>,
): Promise<PublishOutcome> {
  if (!(await ctx.actorStore.exists(did))) return 'deleted'
  const kemKey = (await ctx.actorStore.ensureKemKeypair(did)).did()

  if (did.startsWith('did:plc:')) {
    const lastOp = await ctx.plcClient.getLastOp(did)
    if (lastOp.type === 'plc_tombstone') {
      return { unpublishable: 'tombstoned' }
    }
    const { rotationKeys, services, verificationMethods } =
      plc.normalizeOp(lastOp)
    if (verificationMethods.atproto_kem !== kemKey) {
      if (!rotationKeys.includes(ctx.plcRotationKey.did())) {
        return { unpublishable: 'rotation-key-not-held' }
      }
      if (services.atproto_pds?.endpoint !== ctx.cfg.service.publicUrl) {
        return { unpublishable: 'pds-elsewhere' }
      }
      // A process that stalled past its lease mustn't publish over another's
      if (!(await holdsLease())) throw new LeaseLostError(did)
      await ctx.plcClient.updateData(did, ctx.plcRotationKey, (op) => ({
        ...op,
        verificationMethods: { ...op.verificationMethods, atproto_kem: kemKey },
      }))
    }
  } else {
    const doc = await ctx.idResolver.did.resolve(did, true)
    if (!doc) throw new Error(`could not resolve the DID document of ${did}`)
    const listsOurKey = (doc.verificationMethod ?? []).some(
      (method) =>
        method.id.endsWith('#atproto_kem') &&
        `did:key:${method.publicKeyMultibase}` === kemKey,
    )
    if (!listsOurKey) return { unpublishable: 'did-web' }
  }

  await ctx.sequencer.sequenceIdentity(did)
  return 'published'
}
