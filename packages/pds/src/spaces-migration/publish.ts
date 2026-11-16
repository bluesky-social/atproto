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

/** A PLC call took too long. Treated like PLC pushing back. */
export class PlcTimeoutError extends Error {
  constructor(did: string, timeoutMs: number) {
    super(`plc did not answer within ${timeoutMs}ms for ${did}`)
  }
}

// The doc changed between reading it and updating it, so we can't publish
class UnpublishableError extends Error {
  constructor(public reason: UnpublishableReason) {
    super(`kem key unpublishable: ${reason}`)
  }
}

export const DEFAULT_PLC_TIMEOUT_MS = 30_000

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
  opts: { plcTimeoutMs?: number } = {},
): Promise<PublishOutcome> {
  if (!(await ctx.actorStore.exists(did))) return 'deleted'
  const kemKey = (await ctx.actorStore.ensureKemKeypair(did)).did()

  if (did.startsWith('did:plc:')) {
    // The PLC client has no timeout of its own
    const plcTimeoutMs = opts.plcTimeoutMs ?? DEFAULT_PLC_TIMEOUT_MS
    const bounded = <T>(call: Promise<T>) =>
      withTimeout(
        call,
        plcTimeoutMs,
        () => new PlcTimeoutError(did, plcTimeoutMs),
      )

    const lastOp = await bounded(ctx.plcClient.getLastOp(did))
    if (lastOp.type === 'plc_tombstone') {
      return { unpublishable: 'tombstoned' }
    }
    const normalized = plc.normalizeOp(lastOp)
    if (normalized.verificationMethods.atproto_kem !== kemKey) {
      const reason = whyUnpublishable(ctx, normalized)
      if (reason) return { unpublishable: reason }
      // A process that stalled past its lease mustn't publish over another's
      if (!(await holdsLease())) throw new LeaseLostError(did)
      try {
        await bounded(
          ctx.plcClient.updateData(did, ctx.plcRotationKey, (op) => {
            // updateData re-reads the doc, which may have changed since
            const reason = whyUnpublishable(ctx, op)
            if (reason) throw new UnpublishableError(reason)
            return {
              ...op,
              verificationMethods: {
                ...op.verificationMethods,
                atproto_kem: kemKey,
              },
            }
          }),
        )
      } catch (err) {
        if (err instanceof UnpublishableError) {
          return { unpublishable: err.reason }
        }
        throw err
      }
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

function whyUnpublishable(
  ctx: PublishContext,
  op: Pick<plc.UnsignedOperation, 'rotationKeys' | 'services'>,
): UnpublishableReason | undefined {
  if (!op.rotationKeys.includes(ctx.plcRotationKey.did())) {
    return 'rotation-key-not-held'
  }
  if (op.services.atproto_pds?.endpoint !== ctx.cfg.service.publicUrl) {
    return 'pds-elsewhere'
  }
  return undefined
}

async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  onTimeout: () => Error,
): Promise<T> {
  // A call that loses the race may still fail later: don't leave that unhandled
  promise.catch(() => {})
  let timer: NodeJS.Timeout | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(onTimeout()), ms)
  })
  try {
    return await Promise.race([promise, timeout])
  } finally {
    clearTimeout(timer)
  }
}
