import {
  type Agent,
  type AgentConfig,
  type XrpcRequestInitOptions,
  type XrpcRequestProcessingOptions,
  type XrpcResponseOptions,
  type XrpcRetryOptions,
  buildAgent,
  xrpcSafe,
} from '@atproto/lex-client'
import type { HandleString } from '@atproto/lex-schema'
import { HandleResolverError } from './handle-resolver-error.js'
import { main as resolveHandle } from './lexicons/com/atproto/identity/resolveHandle.defs.js'
import {
  type HandleResolver,
  type ResolveHandleOptions,
  type ResolvedHandle,
  isResolvedHandle,
} from './types.js'

export type XrpcOptions = XrpcRetryOptions &
  XrpcRequestInitOptions &
  XrpcRequestProcessingOptions &
  XrpcResponseOptions

export type XrpcHandleResolverOptions = Pick<AgentConfig, 'fetch' | 'headers'> &
  XrpcOptions

export class XrpcHandleResolver implements HandleResolver {
  protected readonly agent: Agent
  protected readonly options: XrpcOptions

  constructor(
    service: URL | string,
    { fetch, headers, ...options }: XrpcHandleResolverOptions = {},
  ) {
    this.agent = buildAgent({ service, fetch, headers })
    this.options = options
  }

  public async resolve(
    handle: HandleString,
    options?: ResolveHandleOptions,
  ): Promise<ResolvedHandle> {
    const result = await xrpcSafe(this.agent, resolveHandle, {
      ...this.options,
      params: { handle },
      cache: options?.noCache ? 'no-cache' : this.options.cache,
      signal: options?.signal ?? this.options.signal,
      redirect: this.options.redirect ?? 'error',
      // Prevent this.options from setting unwanted xrpc options
      labelers: undefined,
      appLabelers: undefined,
      service: undefined,
      // @NOTE 'body' and 'encoding' are ignored for XRPC Queries.
    })

    if (result.success) {
      const { did } = result.body
      // @ts-expect-error explicitly opting-out of type safety
      if (this.options.validateResponse === false) return did
      if (isResolvedHandle(did)) return did
      throw new HandleResolverError(
        `Invalid DID (${did}) returned from resolveHandle method`,
      )
    }

    if (
      result.error === 'InvalidRequest' &&
      result.message === 'Unable to resolve handle'
    ) {
      return null
    }

    throw new HandleResolverError(
      `Unexpected error (${result.error}) from com.atproto.identity.resolveHandle method`,
      { cause: result },
    )
  }
}
