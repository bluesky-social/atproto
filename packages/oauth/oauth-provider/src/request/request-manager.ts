import { isAtprotoDid } from '@atproto/did'
import type { Account } from '@atproto/oauth-provider-api'
import {
  OAuthAuthorizationRequestParameters,
  OAuthAuthorizationServerMetadata,
} from '@atproto/oauth-types'
import { isValidHandle } from '@atproto/syntax'
import { ClientAuth } from '../client/client-auth.js'
import { ClientId } from '../client/client-id.js'
import { Client } from '../client/client.js'
import {
  AUTHORIZATION_INACTIVITY_TIMEOUT,
  NODE_ENV,
  PAR_EXPIRES_IN,
  TOKEN_MAX_AGE,
} from '../constants.js'
import { DeviceId } from '../device/device-id.js'
import { AccessDeniedError } from '../errors/access-denied-error.js'
import { AuthorizationError } from '../errors/authorization-error.js'
import { ConsentRequiredError } from '../errors/consent-required-error.js'
import { InvalidAuthorizationDetailsError } from '../errors/invalid-authorization-details-error.js'
import { InvalidGrantError } from '../errors/invalid-grant-error.js'
import { InvalidRequestError } from '../errors/invalid-request-error.js'
import { InvalidScopeError } from '../errors/invalid-scope-error.js'
import { RequestMetadata } from '../lib/http/request.js'
import { callAsync } from '../lib/util/function.js'
import { OAuthHooks } from '../oauth-hooks.js'
import { Signer } from '../signer/signer.js'
import { Code, generateCode } from './code.js'
import {
  RequestDataAuthorized,
  isRequestDataAuthorized,
} from './request-data.js'
import { generateRequestId } from './request-id.js'
import { RequestStore, UpdateRequestData } from './request-store.js'
import {
  RequestUri,
  decodeRequestUri,
  encodeRequestUri,
} from './request-uri.js'

export class RequestManager {
  constructor(
    protected readonly store: RequestStore,
    protected readonly signer: Signer,
    protected readonly metadata: OAuthAuthorizationServerMetadata,
    protected readonly hooks: OAuthHooks,
    protected readonly tokenMaxAge = TOKEN_MAX_AGE,
  ) {}

  protected createTokenExpiry() {
    return new Date(Date.now() + this.tokenMaxAge)
  }

  async createAuthorizationRequest(
    client: Client,
    clientAuth: null | ClientAuth,
    input: Readonly<OAuthAuthorizationRequestParameters>,
    deviceId: null | DeviceId,
  ) {
    const parameters = await this.validate(client, clientAuth, input)

    const expiresAt = new Date(Date.now() + PAR_EXPIRES_IN)
    const id = await generateRequestId()

    await this.store.createRequest(id, {
      clientId: client.id,
      clientAuth,
      parameters,
      expiresAt,
      deviceId,
      sub: null,
      code: null,
    })

    const uri = encodeRequestUri(id)
    return { uri, expiresAt, parameters }
  }

  protected async validate(
    client: Client,
    clientAuth: null | ClientAuth,
    parameters: Readonly<OAuthAuthorizationRequestParameters>,
  ): Promise<Readonly<OAuthAuthorizationRequestParameters>> {
    // -------------------------------
    // Validate unsupported parameters
    // -------------------------------

    for (const k of [
      // Known unsupported OIDC parameters
      'claims',
      'id_token_hint',
      'nonce', // note that OIDC "nonce" is redundant with PKCE
    ] as const) {
      if (parameters[k] !== undefined) {
        throw new AuthorizationError(parameters, `Unsupported "${k}" parameter`)
      }
    }

    // -----------------------
    // Validate against server
    // -----------------------

    if (
      !this.metadata.response_types_supported?.includes(
        parameters.response_type,
      )
    ) {
      throw new AuthorizationError(
        parameters,
        `Unsupported response_type "${parameters.response_type}"`,
        'unsupported_response_type',
      )
    }

    if (
      parameters.response_type === 'code' &&
      !this.metadata.grant_types_supported?.includes('authorization_code')
    ) {
      throw new AuthorizationError(
        parameters,
        `Unsupported grant_type "authorization_code"`,
        'invalid_request',
      )
    }

    if (parameters.scope) {
      for (const scope of parameters.scope.split(' ')) {
        // Currently, the implementation requires all the scopes to be statically
        // defined in the server metadata. In the future, we might add support
        // for dynamic scopes.
        if (!this.metadata.scopes_supported?.includes(scope)) {
          throw new AuthorizationError(
            parameters,
            `Scope "${scope}" is not supported by this server`,
          )
        }
      }
    }

    if (parameters.authorization_details) {
      for (const detail of parameters.authorization_details) {
        if (
          !this.metadata.authorization_details_types_supported?.includes(
            detail.type,
          )
        ) {
          throw new InvalidAuthorizationDetailsError(
            parameters,
            `Unsupported "authorization_details" type "${detail.type}"`,
          )
        }
      }
    }

    // -----------------------
    // Validate against client
    // -----------------------

    parameters = client.validateRequest(parameters)

    // -------------------
    // Validate parameters
    // -------------------

    if (!parameters.redirect_uri) {
      // Should already be ensured by client.validateRequest(). Adding here for
      // clarity & extra safety.
      throw new AuthorizationError(parameters, 'Missing "redirect_uri"')
    }

    // https://datatracker.ietf.org/doc/html/draft-ietf-oauth-v2-1-10#section-1.4.1
    // > The authorization server MAY fully or partially ignore the scope
    // > requested by the client, based on the authorization server policy or
    // > the resource owner's instructions. If the issued access token scope is
    // > different from the one requested by the client, the authorization
    // > server MUST include the scope response parameter in the token response
    // > (Section 3.2.3) to inform the client of the actual scope granted.

    // Let's make sure the scopes are unique (to reduce the token & storage size)
    const scopes = new Set(parameters.scope?.split(' '))

    parameters = { ...parameters, scope: [...scopes].join(' ') || undefined }

    if (parameters.code_challenge) {
      switch (parameters.code_challenge_method) {
        case undefined:
          // https://datatracker.ietf.org/doc/html/rfc7636#section-4.3
          parameters = { ...parameters, code_challenge_method: 'plain' }
        // falls through
        case 'plain':
        case 'S256':
          break
        default: {
          throw new AuthorizationError(
            parameters,
            `Unsupported code_challenge_method "${parameters.code_challenge_method}"`,
          )
        }
      }
    } else {
      if (parameters.code_challenge_method) {
        // https://datatracker.ietf.org/doc/html/rfc7636#section-4.4.1
        throw new AuthorizationError(
          parameters,
          'code_challenge is required when code_challenge_method is provided',
        )
      }

      // https://datatracker.ietf.org/doc/html/draft-ietf-oauth-v2-1-11#section-4.1.2.1
      //
      // > An AS MUST reject requests without a code_challenge from public
      // > clients, and MUST reject such requests from other clients unless
      // > there is reasonable assurance that the client mitigates
      // > authorization code injection in other ways. See Section 7.5.1 for
      // > details.
      //
      // > [...] In the specific deployment and the specific request, there is
      // > reasonable assurance by the authorization server that the client
      // > implements the OpenID Connect nonce mechanism properly.
      //
      // atproto does not implement the OpenID Connect nonce mechanism, so we
      // require the use of PKCE for all clients.

      throw new AuthorizationError(parameters, 'Use of PKCE is required')
    }

    // -----------------
    // atproto extension
    // -----------------

    if (parameters.response_type !== 'code') {
      throw new AuthorizationError(
        parameters,
        'atproto only supports the "code" response_type',
      )
    }

    if (!scopes.has('atproto')) {
      throw new InvalidScopeError(parameters, 'The "atproto" scope is required')
    } else if (scopes.has('openid')) {
      throw new InvalidScopeError(
        parameters,
        'OpenID Connect is not compatible with atproto',
      )
    }

    if (parameters.code_challenge_method !== 'S256') {
      throw new AuthorizationError(
        parameters,
        'atproto requires use of "S256" code_challenge_method',
      )
    }

    // atproto extension: if the client is not trusted, and not authenticated,
    // force users to consent to authorization requests. We do this to avoid
    // unauthenticated clients from being able to silently re-authenticate
    // users.
    if (
      !client.info.isTrusted &&
      !client.info.isFirstParty &&
      client.metadata.token_endpoint_auth_method === 'none'
    ) {
      if (parameters.prompt === 'none') {
        throw new ConsentRequiredError(
          parameters,
          'Public clients are not allowed to use silent-sign-on',
        )
      }

      // force "consent" for unauthenticated, third party clients
      parameters = { ...parameters, prompt: 'consent' }
    }

    // atproto extension: ensure that the login_hint is a valid handle or DID
    // @NOTE we to allow invalid case here, which is not spec'd anywhere.
    const hint = parameters.login_hint?.toLowerCase()
    if (hint) {
      if (!isAtprotoDid(hint) && !isValidHandle(hint)) {
        throw new AuthorizationError(parameters, `Invalid login_hint "${hint}"`)
      }

      // @TODO: ensure that the account actually exists on this server (there is
      // no point in showing the UI to the user if the account does not exist).

      // Update the parameters to ensure the right case is used
      parameters = { ...parameters, login_hint: hint }
    }

    return parameters
  }

  async get(uri: RequestUri, deviceId: DeviceId, clientId?: ClientId) {
    const id = decodeRequestUri(uri)

    const data = await this.store.readRequest(id)
    if (!data) throw new InvalidRequestError('Unknown request_uri')

    const updates: UpdateRequestData = {}

    try {
      if (data.sub || data.code) {
        // If an account was linked to the request, the next step is to exchange
        // the code for a token.
        throw new AccessDeniedError(
          data.parameters,
          'This request was already authorized',
        )
      }

      if (data.expiresAt < new Date()) {
        throw new AccessDeniedError(data.parameters, 'This request has expired')
      } else {
        updates.expiresAt = new Date(
          Date.now() + AUTHORIZATION_INACTIVITY_TIMEOUT,
        )
      }

      if (clientId != null && data.clientId !== clientId) {
        throw new AccessDeniedError(
          data.parameters,
          'This request was initiated for another client',
        )
      }

      if (!data.deviceId) {
        updates.deviceId = deviceId
      } else if (data.deviceId !== deviceId) {
        throw new AccessDeniedError(
          data.parameters,
          'This request was initiated from another device',
        )
      }
    } catch (err) {
      await this.store.deleteRequest(id)
      throw err
    }

    if (Object.keys(updates).length > 0) {
      await this.store.updateRequest(id, updates)
    }

    return {
      uri,
      expiresAt: updates.expiresAt || data.expiresAt,
      parameters: data.parameters,
      clientId: data.clientId,
    }
  }

  async setAuthorized(
    uri: RequestUri,
    client: Client,
    account: Account,
    deviceId: DeviceId,
    deviceMetadata: RequestMetadata,
  ): Promise<Code> {
    const requestId = decodeRequestUri(uri)

    const data = await this.store.readRequest(requestId)
    if (!data) throw new InvalidRequestError('Unknown request_uri')

    try {
      if (data.expiresAt < new Date()) {
        throw new AccessDeniedError(data.parameters, 'This request has expired')
      }
      if (!data.deviceId) {
        throw new AccessDeniedError(
          data.parameters,
          'This request was not initiated',
        )
      }
      if (data.deviceId !== deviceId) {
        throw new AccessDeniedError(
          data.parameters,
          'This request was initiated from another device',
        )
      }
      if (data.sub || data.code) {
        throw new AccessDeniedError(
          data.parameters,
          'This request was already authorized',
        )
      }

      // Only response_type=code is supported
      const code = await generateCode()

      // Bind the request to the account, preventing it from being used again.
      await this.store.updateRequest(requestId, {
        sub: account.sub,
        code,
        // Allow the client to exchange the code for a token within the next 60 seconds.
        expiresAt: new Date(Date.now() + AUTHORIZATION_INACTIVITY_TIMEOUT),
      })

      await callAsync(this.hooks.onAuthorized, {
        client,
        account,
        parameters: data.parameters,
        deviceId,
        deviceMetadata,
        requestId,
      })

      return code
    } catch (err) {
      await this.store.deleteRequest(requestId)
      throw err
    }
  }

  /**
   * @note If this method throws an error, any token previously generated from
   * the same `code` **must** me revoked.
   */
  public async consumeCode(code: Code): Promise<RequestDataAuthorized> {
    const result = await this.store.consumeRequestCode(code)
    if (!result) throw new InvalidGrantError('Invalid code')

    const { id, data } = result

    // Fool-proofing the store implementation against code replay attacks (in
    // case consumeRequestCode() does not delete the request).
    if (NODE_ENV !== 'production') {
      const result = await this.store.readRequest(id)
      if (result) {
        throw new Error('Invalid store implementation: request not deleted')
      }
    }

    if (!isRequestDataAuthorized(data) || data.code !== code) {
      // Should never happen: maybe the store implementation is faulty ?
      throw new Error('Unexpected request state')
    }

    if (data.expiresAt < new Date()) {
      throw new InvalidGrantError('This code has expired')
    }

    return data
  }

  async delete(uri: RequestUri): Promise<void> {
    const id = decodeRequestUri(uri)
    await this.store.deleteRequest(id)
  }
}
