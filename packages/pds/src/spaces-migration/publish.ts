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
  const signingKey = (await ctx.actorStore.keypair(did)).did()

  const plcTimeoutMs = opts.plcTimeoutMs ?? DEFAULT_PLC_TIMEOUT_MS
  const live = await inspectKemKey(
    ctx,
    did,
    { kem: kemKey, signing: signingKey },
    { plcTimeoutMs },
  )
  if (!live.published) {
    if (live.unpublishableReason) {
      return { unpublishable: live.unpublishableReason }
    }
    // So it is a did:plc this host can update.
    // A process that stalled past its lease mustn't publish over another's
    if (!(await holdsLease())) throw new LeaseLostError(did)
    try {
      await boundPlc(did, plcTimeoutMs, (signal) =>
        ctx.plcClient.updateData(
          did,
          ctx.plcRotationKey,
          (op) => {
            // updateData re-reads the doc, which may have changed since
            const reason = whyUnpublishable(ctx, op, signingKey)
            if (reason) throw new UnpublishableError(reason)
            return {
              ...op,
              verificationMethods: {
                ...op.verificationMethods,
                atproto_kem: kemKey,
              },
            }
          },
          { signal },
        ),
      )
    } catch (err) {
      if (err instanceof UnpublishableError) {
        return { unpublishable: err.reason }
      }
      throw err
    }
  }

  await ctx.sequencer.sequenceIdentity(did)
  return 'published'
}

export type KemKeyState = {
  /** The DID doc lists the key. */
  published: boolean
  /** Why this host can't publish the key, if it isn't published. */
  unpublishableReason: UnpublishableReason | null
}

/** An account's public keys, as did:keys. */
export type AccountKeys = {
  /** Absent if the account holds no KEM key yet. */
  kem: string | undefined
  /** The repo signing key. */
  signing: string
}

/**
 * Reads the account's DID doc from its source, not a cache, and reports
 * whether it lists the KEM key and, if not, whether this host could publish
 * it. Writes nothing. With no KEM key, the key is never published.
 */
export async function inspectKemKey(
  ctx: Pick<
    PublishContext,
    'plcClient' | 'idResolver' | 'plcRotationKey' | 'cfg'
  >,
  did: DidString,
  keys: AccountKeys,
  opts: { plcTimeoutMs?: number } = {},
): Promise<KemKeyState> {
  const kemKey = keys.kem
  if (did.startsWith('did:plc:')) {
    const lastOp = await boundPlc(
      did,
      opts.plcTimeoutMs ?? DEFAULT_PLC_TIMEOUT_MS,
      (signal) => ctx.plcClient.getLastOp(did, { signal }),
    )
    if (lastOp.type === 'plc_tombstone') {
      return { published: false, unpublishableReason: 'tombstoned' }
    }
    const normalized = plc.normalizeOp(lastOp)
    if (
      kemKey !== undefined &&
      normalized.verificationMethods.atproto_kem === kemKey
    ) {
      return { published: true, unpublishableReason: null }
    }
    return {
      published: false,
      unpublishableReason:
        whyUnpublishable(ctx, normalized, keys.signing) ?? null,
    }
  }
  const doc = await ctx.idResolver.did.resolve(did, true)
  if (!doc) throw new Error(`could not resolve the DID document of ${did}`)
  const listsOurKey =
    kemKey !== undefined &&
    (doc.verificationMethod ?? []).some(
      (method) =>
        method.id.endsWith('#atproto_kem') &&
        `did:key:${method.publicKeyMultibase}` === kemKey,
    )
  return listsOurKey
    ? { published: true, unpublishableReason: null }
    : { published: false, unpublishableReason: 'did-web' }
}

// Bound the whole PLC operation, including its reads and write.
function boundPlc<T>(
  did: string,
  timeoutMs: number,
  call: (signal: AbortSignal) => Promise<T>,
) {
  return withSignal(
    call,
    AbortSignal.timeout(timeoutMs),
    () => new PlcTimeoutError(did, timeoutMs),
  )
}

function whyUnpublishable(
  ctx: Pick<PublishContext, 'plcRotationKey' | 'cfg'>,
  op: Pick<plc.UnsignedOperation, 'rotationKeys' | 'verificationMethods'>,
  signingKey: string,
): UnpublishableReason | undefined {
  // Behind an entryway, the entryway publishes with its own rotation key
  const rotationKey =
    ctx.cfg.entryway?.plcRotationKey ?? ctx.plcRotationKey.did()
  if (!op.rotationKeys.includes(rotationKey)) {
    return 'rotation-key-not-held'
  }
  // The doc naming our signing key means we host the account. Its service
  // endpoint may not match our public URL exactly, e.g. an alias of this host.
  if (op.verificationMethods.atproto !== signingKey) {
    return 'signing-key-not-held'
  }
  return undefined
}

// Rejects with `onTimeout()` once `signal` aborts, whether or not the call
// settles: the timeout also holds for a custom client that ignores the signal.
async function withSignal<T>(
  call: (signal: AbortSignal) => Promise<T>,
  signal: AbortSignal,
  onTimeout: () => Error,
): Promise<T> {
  const promise = call(signal)
  // A call that loses the race may still fail later: don't leave that unhandled
  promise.catch(() => {})
  let onAbort: (() => void) | undefined
  const aborted = new Promise<never>((_, reject) => {
    onAbort = () => reject(onTimeout())
    if (signal.aborted) onAbort()
    else signal.addEventListener('abort', onAbort, { once: true })
  })
  try {
    return await Promise.race([promise, aborted])
  } finally {
    if (onAbort) signal.removeEventListener('abort', onAbort)
  }
}
