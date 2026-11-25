import { describe, expect, it, vi } from 'vitest'
import type { Account } from '@atproto/oauth-provider-api'
import type { OAuthAuthorizationRequestParameters } from '@atproto/oauth-types'
import { AccessTokenMode } from '../access-token/access-token-mode.js'
import type { ClientAuth } from '../client/client-auth.js'
import type { Client } from '../client/client.js'
import type { LexiconManager } from '../lexicon/lexicon-manager.js'
import type { RequestMetadata } from '../lib/http/request.js'
import type { OAuthHooks } from '../oauth-hooks.js'
import type { Code } from '../request/code.js'
import type { Signer } from '../signer/signer.js'
import { TokenManager } from './token-manager.js'
import type { TokenStore } from './token-store.js'

describe(TokenManager, () => {
  describe('createToken', () => {
    it('gives onTokenCreated the scope the token grants', async () => {
      const onTokenCreated = vi.fn<NonNullable<OAuthHooks['onTokenCreated']>>()
      const lexiconManager = {
        // Expands a permission set as the real manager does
        buildTokenScope: async (scope: string) =>
          scope.replace('include:com.example.perms', 'repo:com.example.post'),
      } as unknown as LexiconManager
      const manager = new TokenManager(
        { createToken: vi.fn() } as unknown as TokenStore,
        lexiconManager,
        { createAccessToken: async () => 'jwt' } as unknown as Signer,
        { onTokenCreated },
        AccessTokenMode.stateful,
      )

      const response = await manager.createToken(
        {
          id: 'https://client.example/client-metadata.json',
          metadata: { grant_types: ['authorization_code'] },
          sessionLifetime: 60_000,
        } as unknown as Client,
        { method: 'none' } as unknown as ClientAuth,
        {} as RequestMetadata,
        { sub: 'did:plc:alice' } as unknown as Account,
        null,
        {
          client_id: 'https://client.example/client-metadata.json',
          scope: 'atproto include:com.example.perms',
        } as OAuthAuthorizationRequestParameters,
        'cod-abc' as Code,
      )

      expect(response.scope).toBe('atproto repo:com.example.post')
      expect(onTokenCreated).toHaveBeenCalledTimes(1)
      expect(onTokenCreated.mock.calls[0][0].scope).toBe(
        'atproto repo:com.example.post',
      )
    })
  })
})
