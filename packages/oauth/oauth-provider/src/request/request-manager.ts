import {
  CLIENT_ASSERTION_TYPE_JWT_BEARER,
  OAuthAuthenticationRequestParameters,
  OAuthAuthorizationServerMetadata,
} from '@atproto/oauth-types'

import { Account } from '../account/account.js'
import { ClientAuth } from '../client/client-auth.js'
import { ClientId } from '../client/client-id.js'
import { Client } from '../client/client.js'
import {
  AUTHORIZATION_INACTIVITY_TIMEOUT,
  PAR_EXPIRES_IN,
  TOKEN_MAX_AGE,
} from '../constants.js'
import { DeviceId } from '../device/device-id.js'
import { AccessDeniedError } from '../errors/access-denied-error.js'
import { ConsentRequiredError } from '../errors/consent-required-error.js'
import { InvalidAuthorizationDetailsError } from '../errors/invalid-authorization-details-error.js'
import { InvalidGrantError } from '../errors/invalid-grant-error.js'
import { InvalidParametersError } from '../errors/invalid-parameters-error.js'
import { InvalidRequestError } from '../errors/invalid-request-error.js'
import { compareRedirectUri } from '../lib/util/redirect-uri.js'
import { OAuthHooks } from '../oauth-hooks.js'
import { Signer } from '../signer/signer.js'
import { Code, generateCode } from './code.js'
import {
  isRequestDataAuthorized,
  RequestDataAuthorized,
} from './request-data.js'
import { generateRequestId } from './request-id.js'
import { RequestInfo } from './request-info.js'
import { RequestStore, UpdateRequestData } from './request-store.js'
import {
  decodeRequestUri,
  encodeRequestUri,
  RequestUri,
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
    clientAuth: ClientAuth,
    input: Readonly<OAuthAuthenticationRequestParameters>,
    deviceId: null | DeviceId,
    dpopJkt: null | string,
  ): Promise<RequestInfo> {
    const parameters = await this.validate(client, clientAuth, input, dpopJkt)
    return this.create(client, clientAuth, parameters, deviceId)
  }

  protected async create(
    client: Client,
    clientAuth: ClientAuth,
    parameters: Readonly<OAuthAuthenticationRequestParameters>,
    deviceId: null | DeviceId = null,
  ): Promise<RequestInfo> {
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
    return { id, uri, expiresAt, parameters, clientId: client.id, clientAuth }
  }

  async validate(
    client: Client,
    clientAuth: ClientAuth,
    parameters: Readonly<OAuthAuthenticationRequestParameters>,
    dpopJkt: null | string,
  ): Promise<Readonly<OAuthAuthenticationRequestParameters>> {
    for (const k of [
      // Known unsupported OIDC parameters
      'claims',
      'id_token_hint',
      'nonce', // note that OIDC "nonce" is redundant with PKCE
    ] as const) {
      if (parameters[k]) {
        throw new InvalidParametersError(
          parameters,
          `Unsupported "${k}" parameter`,
        )
      }
    }

    if (parameters.response_type !== 'code') {
      throw new InvalidParametersError(
        parameters,
        'Only "code" response type is allowed',
      )
    }

    // https://datatracker.ietf.org/doc/html/draft-ietf-oauth-v2-1-10#section-1.4.1
    // > The authorization server MAY fully or partially ignore the scope
    // > requested by the client, based on the authorization server policy or
    // > the resource owner's instructions. If the issued access token scope is
    // > different from the one requested by the client, the authorization
    // > server MUST include the scope response parameter in the token response
    // > (Section 3.2.3) to inform the client of the actual scope granted.

    const cScopes = client.metadata.scope?.split(' ').filter(Boolean)
    const sScopes = this.metadata.scopes_supported

    const scopes = new Set(
      parameters.scope?.split(' ').filter(Boolean) || cScopes,
    )

    if (scopes.has('openid')) {
      throw new InvalidParametersError(
        parameters,
        'OpenID Connect is not supported',
      )
    }

    if (!scopes.has('atproto')) {
      throw new InvalidParametersError(
        parameters,
        'The "atproto" scope is required',
      )
    }

    for (const scope of scopes) {
      // Loopback clients do not define any scope in their metadata
      if (cScopes && !cScopes.includes(scope)) {
        throw new InvalidParametersError(
          parameters,
          `Scope "${scope}" is not registered for this client`,
        )
      }

      // Currently, the implementation requires all the scopes to be statically
      // defined in the server metadata. In the future, we might add support
      // for dynamic scopes.
      if (!sScopes?.includes(scope)) {
        throw new InvalidParametersError(
          parameters,
          `Scope "${scope}" is not supported by this server`,
        )
      }
    }

    parameters = { ...parameters, scope: [...scopes].join(' ') || undefined }

    if (parameters.authorization_details) {
      const clientAuthDetailsTypes = client.metadata.authorization_details_types
      if (!clientAuthDetailsTypes) {
        throw new InvalidAuthorizationDetailsError(
          parameters,
          'Client Metadata does not declare any "authorization_details"',
        )
      }

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
        if (!clientAuthDetailsTypes?.includes(detail.type)) {
          throw new InvalidAuthorizationDetailsError(
            parameters,
            `Client Metadata does not declare any "authorization_details" of type "${detail.type}"`,
          )
        }
      }
    }

    const { redirect_uri } = parameters
    if (
      redirect_uri &&
      !client.metadata.redirect_uris.some((uri) =>
        compareRedirectUri(uri, redirect_uri),
      )
    ) {
      throw new InvalidParametersError(
        parameters,
        `Invalid redirect_uri ${redirect_uri} (allowed: ${client.metadata.redirect_uris.join(' ')})`,
      )
    }

    // https://datatracker.ietf.org/doc/html/rfc9449#section-10
    if (!parameters.dpop_jkt) {
      if (dpopJkt) parameters = { ...parameters, dpop_jkt: dpopJkt }
    } else if (parameters.dpop_jkt !== dpopJkt) {
      throw new InvalidParametersError(
        parameters,
        'DPoP header and dpop_jkt do not match',
      )
    }

    if (clientAuth.method === CLIENT_ASSERTION_TYPE_JWT_BEARER) {
      if (parameters.dpop_jkt && clientAuth.jkt === parameters.dpop_jkt) {
        throw new InvalidParametersError(
          parameters,
          'The DPoP proof must be signed with a different key than the client assertion',
        )
      }
    }

    if (!client.metadata.response_types.includes(parameters.response_type)) {
      throw new InvalidParametersError(
        parameters,
        `Unsupported response_type "${parameters.response_type}"`,
        'unsupported_response_type',
      )
    }

    // https://datatracker.ietf.org/doc/html/rfc7636#section-4.4.1
    // PKCE is mandatory
    if (!parameters.code_challenge) {
      throw new InvalidParametersError(parameters, 'code_challenge is required')
    }

    if (
      parameters.code_challenge &&
      clientAuth.method === 'none' &&
      (parameters.code_challenge_method ?? 'plain') === 'plain'
    ) {
      throw new InvalidParametersError(
        parameters,
        'code_challenge_method=plain requires client authentication',
      )
    }

    // https://datatracker.ietf.org/doc/html/rfc7636#section-4.3
    if (parameters.code_challenge_method && !parameters.code_challenge) {
      throw new InvalidParametersError(
        parameters,
        'code_challenge_method requires code_challenge',
      )
    }

    // ATPROTO extension: if the client is not trusted, and not authenticated,
    // force users to consent to authorization requests. We do this to avoid
    // unauthenticated clients from being able to silently re-authenticate
    // users.
    if (
      !client.info.isTrusted &&
      !client.info.isFirstParty &&
      clientAuth.method === 'none'
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

    return parameters
  }

  async get(
    uri: RequestUri,
    clientId: ClientId,
    deviceId: DeviceId,
  ): Promise<RequestInfo> {
    const id = decodeRequestUri(uri)

    const data = await this.store.readRequest(id)
    if (!data) throw new InvalidRequestError(`Unknown request_uri "${uri}"`)

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

      if (data.clientId !== clientId) {
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
      id,
      uri,
      expiresAt: updates.expiresAt || data.expiresAt,
      parameters: data.parameters,
      clientId: data.clientId,
      clientAuth: data.clientAuth,
    }
  }

  async setAuthorized(
    client: Client,
    uri: RequestUri,
    deviceId: DeviceId,
    account: Account,
  ): Promise<Code> {
    const id = decodeRequestUri(uri)

    const data = await this.store.readRequest(id)
    if (!data) throw new InvalidRequestError(`Unknown request_uri "${uri}"`)

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
      await this.store.updateRequest(id, {
        sub: account.sub,
        code,
        // Allow the client to exchange the code for a token within the next 60 seconds.
        expiresAt: new Date(Date.now() + AUTHORIZATION_INACTIVITY_TIMEOUT),
      })

      return code
    } catch (err) {
      await this.store.deleteRequest(id)
      throw err
    }
  }

  /**
   * @note If this method throws an error, any token previously generated from
   * the same `code` **must** me revoked.
   */
  public async findCode(
    client: Client,
    clientAuth: ClientAuth,
    code: Code,
  ): Promise<RequestDataAuthorized> {
    const result = await this.store.findRequestByCode(code)
    if (!result) throw new InvalidGrantError('Invalid code')

    try {
      const { data } = result

      if (!isRequestDataAuthorized(data)) {
        // Should never happen: maybe the store implementation is faulty ?
        throw new Error('Unexpected request state')
      }

      if (data.clientId !== client.id) {
        throw new InvalidGrantError('This code was issued for another client')
      }

      if (data.expiresAt < new Date()) {
        throw new InvalidGrantError('This code has expired')
      }

      if (data.clientAuth.method === 'none') {
        // If the client did not use PAR, it was not authenticated when the
        // request was created (see authorize() method above). Since PAR is not
        // mandatory, and since the token exchange currently taking place *is*
        // authenticated (`clientAuth`), we allow "upgrading" the authentication
        // method (the token created will be bound to the current clientAuth).
      } else {
        if (clientAuth.method !== data.clientAuth.method) {
          throw new InvalidGrantError('Invalid client authentication')
        }

        if (!(await client.validateClientAuth(data.clientAuth))) {
          throw new InvalidGrantError('Invalid client authentication')
        }
      }

      return data
    } finally {
      // A "code" can only be used once
      await this.store.deleteRequest(result.id)
    }
  }

  async delete(uri: RequestUri): Promise<void> {
    const id = decodeRequestUri(uri)
    await this.store.deleteRequest(id)
  }
}
