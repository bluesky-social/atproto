import {
  CLIENT_ASSERTION_TYPE_JWT_BEARER,
  OAuthAuthenticationRequestParameters,
  OAuthAuthorizationServerMetadata,
} from '@atproto/oauth-types'

import { DeviceAccountInfo } from '../account/account-store.js'
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
import { InvalidGrantError } from '../errors/invalid-grant-error.js'
import { InvalidParametersError } from '../errors/invalid-parameters-error.js'
import { InvalidRequestError } from '../errors/invalid-request-error.js'
import { compareRedirectUri } from '../lib/util/redirect-uri.js'
import { OAuthHooks } from '../oauth-hooks.js'
import { OIDC_SCOPE_CLAIMS } from '../oidc/claims.js'
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
    protected readonly pkceRequired = true,
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
    return { id, uri, expiresAt, parameters, clientAuth }
  }

  async validate(
    client: Client,
    clientAuth: ClientAuth,
    parameters: Readonly<OAuthAuthenticationRequestParameters>,
    dpopJkt: null | string,
    pkceRequired = this.pkceRequired,
  ): Promise<Readonly<OAuthAuthenticationRequestParameters>> {
    // https://datatracker.ietf.org/doc/html/draft-ietf-oauth-v2-1-10#section-1.4.1
    // > The authorization server MAY fully or partially ignore the scope
    // > requested by the client, based on the authorization server policy or
    // > the resource owner's instructions. If the issued access token scope is
    // > different from the one requested by the client, the authorization
    // > server MUST include the scope response parameter in the token response
    // > (Section 3.2.3) to inform the client of the actual scope granted.

    const cScopes = client.metadata.scope?.split(' ')
    const sScopes = this.metadata.scopes_supported

    const scopes =
      (parameters.scope || client.metadata.scope)
        ?.split(' ')
        .filter((scope) => !!scope && (sScopes?.includes(scope) ?? true)) ?? []

    for (const scope of scopes) {
      if (!cScopes?.includes(scope)) {
        throw new InvalidParametersError(
          parameters,
          `Scope "${scope}" is not registered for this client`,
        )
      }
    }

    for (const [scope, claims] of Object.entries(OIDC_SCOPE_CLAIMS)) {
      for (const claim of claims) {
        if (
          parameters?.claims?.id_token?.[claim]?.essential === true ||
          parameters?.claims?.userinfo?.[claim]?.essential === true
        ) {
          if (!scopes?.includes(scope)) {
            throw new InvalidParametersError(
              parameters,
              `Essential ${claim} claim requires "${scope}" scope`,
            )
          }
        }
      }
    }

    parameters = { ...parameters, scope: scopes.join(' ') }

    const responseTypes = parameters.response_type.split(' ')

    if (parameters.authorization_details) {
      const clientAuthDetailsTypes = client.metadata.authorization_details_types
      if (!clientAuthDetailsTypes) {
        throw new InvalidParametersError(
          parameters,
          'Client Metadata does not declare any "authorization_details"',
        )
      }

      for (const detail of parameters.authorization_details) {
        if (!clientAuthDetailsTypes?.includes(detail.type)) {
          throw new InvalidParametersError(
            parameters,
            `Unsupported "authorization_details" type "${detail.type}"`,
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

    if (pkceRequired && responseTypes.includes('token')) {
      throw new InvalidParametersError(
        parameters,
        `Response type "${parameters.response_type}" is incompatible with PKCE`,
        'unsupported_response_type',
      )
    }

    // https://datatracker.ietf.org/doc/html/rfc7636#section-4.4.1
    if (pkceRequired && !parameters.code_challenge) {
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

    // https://openid.net/specs/openid-connect-core-1_0.html#HybridAuthRequest
    //
    // > nonce: REQUIRED if the Response Type of the request is "code id_token" or
    // >   "code id_token token" and OPTIONAL when the Response Type of the
    // >   request is "code token". It is a string value used to associate a
    // >   Client session with an ID Token, and to mitigate replay attacks. The
    // >   value is passed through unmodified from the Authentication Request to
    // >   the ID Token. Sufficient entropy MUST be present in the nonce values
    // >   used to prevent attackers from guessing values. For implementation
    // >   notes, see Section 15.5.2.
    if (responseTypes.includes('id_token') && !parameters.nonce) {
      throw new InvalidParametersError(
        parameters,
        'nonce is required for implicit and hybrid flows',
      )
    }

    // Make "expensive" checks after the "cheaper" checks

    if (parameters.id_token_hint != null) {
      const { payload } = await this.signer.verify(parameters.id_token_hint, {
        // these are meant to be outdated when used as a hint
        clockTolerance: Infinity,
      })

      if (!payload.sub) {
        throw new InvalidParametersError(
          parameters,
          `Unexpected empty id_token_hint "sub"`,
        )
      } else if (parameters.login_hint == null) {
        parameters = { ...parameters, login_hint: payload.sub }
      } else if (parameters.login_hint !== payload.sub) {
        throw new InvalidParametersError(
          parameters,
          'login_hint does not match "sub" of id_token_hint',
        )
      }
    }

    // ATPROTO extension: if the client is not trusted, force users to consent
    // to authorization requests. We do this to avoid unauthenticated clients
    // from being able to silently re-authenticate users.
    if (clientAuth.method === 'none' && !client.info.isFirstParty) {
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
      clientAuth: data.clientAuth,
    }
  }

  async setAuthorized(
    client: Client,
    uri: RequestUri,
    deviceId: DeviceId,
    account: Account,
    info: DeviceAccountInfo,
  ): Promise<{ code?: Code; token?: string; id_token?: string }> {
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

      const responseType = data.parameters.response_type.split(' ')

      if (responseType.includes('token')) {
        throw new AccessDeniedError(
          data.parameters,
          'Implicit "token" forbidden (use "code" with PKCE instead)',
        )
      }

      const code = responseType.includes('code')
        ? await generateCode()
        : undefined

      // Bind the request to the account, preventing it from being used again.
      await this.store.updateRequest(id, {
        sub: account.sub,
        code,
        // Allow the client to exchange the code for a token within the next 60 seconds.
        expiresAt: new Date(Date.now() + AUTHORIZATION_INACTIVITY_TIMEOUT),
      })

      const id_token = responseType.includes('id_token')
        ? await this.signer.idToken(client, data.parameters, account, {
            auth_time: info.authenticatedAt,
            exp: this.createTokenExpiry(),
            code,
          })
        : undefined

      return { code, id_token }
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
