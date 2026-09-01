import { Transform, type TransformCallback } from 'node:stream'
import {
  DidResolver,
  type DidResolverOpts,
  PoorlyFormattedDidError,
  UnsupportedDidWebPathError,
} from '@atproto/identity'
import { type Fetch, safeFetchWrap } from '@atproto-labs/fetch-node'

const DID_DOC_PATH = '/.well-known/did.json'
const DEFAULT_RESPONSE_MAX_SIZE = 10 * 1024 * 1024

export const createSafeFetch = ({
  timeout = Infinity,
  responseMaxSize = DEFAULT_RESPONSE_MAX_SIZE,
}: {
  timeout?: number
  responseMaxSize?: number
} = {}) => {
  const safeFetch = safeFetchWrap({
    allowCustomPort: true,
    allowImplicitRedirect: true,
    allowIpHost: false,
    responseMaxSize,
    timeout,
  })

  return (input: Parameters<typeof globalThis.fetch>[0], init?: RequestInit) =>
    safeFetch(input, { ...init, redirect: 'error' })
}

export class SafeDidResolver extends DidResolver {
  private readonly safeFetch: Fetch

  constructor(opts: DidResolverOpts) {
    super(opts)
    this.safeFetch = createSafeFetch({ timeout: opts.timeout ?? 3000 })
  }

  override async resolveNoCheck(did: string): Promise<unknown> {
    if (!did.startsWith('did:web:')) {
      return super.resolveNoCheck(did)
    }

    const parsedId = did.split(':').slice(2).join(':')
    const parts = parsedId.split(':').map(decodeURIComponent)
    if (parts.length < 1) {
      throw new PoorlyFormattedDidError(did)
    }
    if (parts.length !== 1) {
      throw new UnsupportedDidWebPathError(did)
    }

    const url = new URL(`https://${parts[0]}${DID_DOC_PATH}`)
    const res = await this.safeFetch.call(globalThis, url, {
      headers: { accept: 'application/did+ld+json,application/json' },
    })
    if (!res.ok) {
      await res.body?.cancel()
      return null
    }
    return res.json()
  }
}

export class BodyTimeoutTransform extends Transform {
  private timer: NodeJS.Timeout | undefined

  constructor(private readonly timeout: number) {
    super()
    this.resetTimer()
  }

  override _transform(
    chunk: unknown,
    encoding: BufferEncoding,
    callback: TransformCallback,
  ) {
    this.resetTimer()
    callback(null, chunk)
  }

  override _flush(callback: TransformCallback) {
    this.clearTimer()
    callback()
  }

  override _destroy(
    error: Error | null,
    callback: (error?: Error | null) => void,
  ) {
    this.clearTimer()
    callback(error)
  }

  private resetTimer() {
    this.clearTimer()
    this.timer = setTimeout(
      () => this.destroy(new Error('Blob body timeout')),
      this.timeout,
    )
    this.timer.unref()
  }

  private clearTimer() {
    if (this.timer) clearTimeout(this.timer)
    this.timer = undefined
  }
}
