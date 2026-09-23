import {
  type Agent,
  type AgentConfig,
  type RetryOptions,
  type XrpcRequestProcessingOptions,
  type XrpcResponseOptions,
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
import { pick } from './util.js'

export type XrpcHandleResolverOptions = Pick<AgentConfig, 'fetch' | 'headers'> &
  RetryOptions &
  XrpcRequestProcessingOptions &
  XrpcResponseOptions

export class XrpcHandleResolver implements HandleResolver {
  protected readonly agent: Agent
  protected readonly xrpcOptions: RetryOptions & XrpcResponseOptions

  constructor(service: URL | string, options: XrpcHandleResolverOptions = {}) {
    this.agent = buildAgent({
      service,
      fetch: options.fetch,
      headers: options.headers,
    })
    // @NOTE we use "pick" here to prevent overriding critical xrpc options
    // (like "labelers", "service", etc.)
    this.xrpcOptions = pick(options, [
      'retry',
      'maxRetries',
      'maxRetryTimeout',
      'minRetryTimeout',
      'retryTimeoutFactor',
      'retryHeaders',
      'validateRequest',
      'validateResponse',
      'strictResponseProcessing',
    ])
  }

  public async resolve(
    handle: HandleString,
    options?: ResolveHandleOptions,
  ): Promise<ResolvedHandle> {
    const result = await xrpcSafe(this.agent, resolveHandle, {
      ...this.xrpcOptions,
      params: { handle },
      cache: options?.noCache ? 'no-cache' : undefined,
      signal: options?.signal,
      redirect: 'error',
    })

    if (result.success) {
      const { did } = result.body
      // @ts-expect-error explicitly opting-out of type safety
      if (this.xrpcOptions.validateResponse === false) return did
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
