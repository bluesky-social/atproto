import {
  DidResolver,
  type DidResolverOpts,
  PoorlyFormattedDidError,
  UnsupportedDidWebPathError,
} from '@atproto/identity'
import { type Fetch, safeFetchWrap } from '@atproto-labs/fetch-node'

const DID_DOC_PATH = '/.well-known/did.json'

export const createSafeFetch = (timeout = Infinity) => {
  const safeFetch = safeFetchWrap({
    allowCustomPort: true,
    allowImplicitRedirect: true,
    allowIpHost: false,
    responseMaxSize: Infinity,
    timeout,
  })

  return (input: Parameters<typeof globalThis.fetch>[0], init?: RequestInit) =>
    safeFetch(input, { ...init, redirect: 'error' })
}

export class SafeDidResolver extends DidResolver {
  private readonly safeFetch: Fetch

  constructor(opts: DidResolverOpts) {
    super(opts)
    this.safeFetch = createSafeFetch(opts.timeout ?? 3000)
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
    if (!res.ok) return null
    return res.json()
  }
}
