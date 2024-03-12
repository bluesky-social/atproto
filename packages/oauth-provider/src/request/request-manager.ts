import { DeviceAccountInfo } from '../account/account-store.js'
import { Account } from '../account/account.js'
import { ClientAuth } from '../client/client-auth.js'
import { Client } from '../client/client.js'
import { ClientId } from '../client/client-id.js'
import {
  AUTHORIZATION_INACTIVITY_TIMEOUT,
  PAR_EXPIRES_IN,
  TOKEN_MAX_AGE,
} from '../constants.js'
import { DeviceId } from '../device/device-id.js'
import { AccessDeniedError } from '../errors/access-denied-error.js'
import { InvalidRequestError } from '../errors/invalid-request-error.js'
import { OIDC_SCOPE_CLAIMS } from '../oidc/claims.js'
import { Sub } from '../oidc/sub.js'
import { AuthorizationParameters } from '../parameters/authorization-parameters.js'
import { Signer } from '../signer/signer.js'
import { Awaitable } from '../util/awaitable.js'
import { matchRedirectUri } from '../util/redirect-uri.js'
import { Code, generateCode } from './code.js'
import { RequestId, generateRequestId } from './request-id.js'
import { RequestStore, UpdateRequestData } from './request-store.js'
import {
  RequestUri,
  decodeRequestUri,
  encodeRequestUri,
} from './request-uri.js'

export type RequestInfo = {
  id: RequestId
  uri: RequestUri
  parameters: AuthorizationParameters
  expiresAt: Date
  clientAuth: ClientAuth
}

/**
 * Allows validating and modifying the authorization parameters before the
 * authorization request is processed.
 *
 * @throws {InvalidAuthorizationDetailsError}
 */
export type AuthorizationRequestHook = (
  this: null,
  parameters: AuthorizationParameters,
  data: {
    client: Client
    clientAuth: ClientAuth
  },
) => Awaitable<void>

export class RequestManager {
  constructor(
    protected readonly store: RequestStore,
    protected readonly signer: Signer,
    protected readonly hooks: {
      onAuthorizationRequest?: AuthorizationRequestHook
    },
    protected readonly pkceRequired = true,
    protected readonly tokenMaxAge = TOKEN_MAX_AGE,
  ) {}

  protected createTokenExpiry() {
    return new Date(Date.now() + this.tokenMaxAge)
  }

  async pushedAuthorizationRequest(
    client: Client,
    clientAuth: ClientAuth,
    input: AuthorizationParameters,
    dpopJkt: null | string,
  ): Promise<RequestInfo> {
    const params = await this.validate(client, clientAuth, input, dpopJkt)
    return this.create(client, clientAuth, params, null)
  }

  async authorizationRequest(
    client: Client,
    clientAuth: ClientAuth,
    input: AuthorizationParameters,
    deviceId: DeviceId,
  ): Promise<RequestInfo> {
    const params = await this.validate(client, clientAuth, input, null)
    return this.create(client, clientAuth, params, deviceId)
  }

  protected async create(
    client: Client,
    clientAuth: ClientAuth,
    parameters: AuthorizationParameters,
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
    parameters: Readonly<AuthorizationParameters>,
    dpopJkt: null | string,
    pkceRequired = this.pkceRequired,
  ): Promise<AuthorizationParameters> {
    const scopes = parameters.scope?.split(' ')
    const responseTypes = parameters.response_type.split(' ')

    if (parameters.authorization_details) {
      const cAuthDetailsTypes = client.metadata.authorization_details_types
      if (!cAuthDetailsTypes) {
        throw new InvalidRequestError(
          'Client does not support authorization_details',
        )
      }

      for (const detail of parameters.authorization_details) {
        if (!cAuthDetailsTypes?.includes(detail.type)) {
          throw new InvalidRequestError(
            `Unsupported authorization_details type "${detail.type}"`,
          )
        }
      }
    }

    const { redirect_uri } = parameters
    if (
      redirect_uri &&
      !client.metadata.redirect_uris.some((uri) =>
        matchRedirectUri(uri, redirect_uri),
      )
    ) {
      throw new InvalidRequestError(`Invalid redirect_uri ${redirect_uri}`)
    }

    // https://datatracker.ietf.org/doc/html/rfc9449#section-10
    if (!parameters.dpop_jkt) {
      if (dpopJkt) parameters = { ...parameters, dpop_jkt: dpopJkt }
    } else if (parameters.dpop_jkt !== dpopJkt) {
      throw new InvalidRequestError('DPoP header and dpop_jkt do not match')
    }

    if (
      clientAuth.method ===
      'urn:ietf:params:oauth:client-assertion-type:jwt-bearer'
    ) {
      if (parameters.dpop_jkt && clientAuth.jkt === parameters.dpop_jkt) {
        throw new InvalidRequestError(
          'The DPoP proof must be signed with a different key than the client assertion',
        )
      }
    }

    if (!client.metadata.response_types.includes(parameters.response_type)) {
      throw new InvalidRequestError(
        `Unsupported response_type "${parameters.response_type}"`,
      )
    }

    if (pkceRequired && responseTypes.includes('token')) {
      throw new InvalidRequestError(
        `${parameters.response_type} is not compatible with PKCE`,
      )
    }

    // https://datatracker.ietf.org/doc/html/rfc7636#section-4.4.1
    if (pkceRequired && !parameters.code_challenge) {
      throw new InvalidRequestError('code_challenge is required')
    }

    if (
      parameters.code_challenge &&
      clientAuth.method === 'none' &&
      (parameters.code_challenge_method ?? 'plain') === 'plain'
    ) {
      throw new InvalidRequestError(
        'code_challenge_method=plain requires client authentication',
      )
    }

    // https://datatracker.ietf.org/doc/html/rfc7636#section-4.3
    if (parameters.code_challenge_method && !parameters.code_challenge) {
      throw new InvalidRequestError(
        'code_challenge_method requires code_challenge',
      )
    }

    // https://openid.net/specs/openid-connect-core-1_0.html#HybridAuthRequest
    if (responseTypes.includes('id_token') && !parameters.nonce) {
      throw new InvalidRequestError('openid scope requires a nonce')
    }

    if (responseTypes.includes('id_token') && !scopes?.includes('openid')) {
      throw new InvalidRequestError(
        'id_token response_type requires openid scope',
      )
    }

    // TODO Validate parameters against **all** client metadata (are some checks
    // missing?) !!!

    if (!parameters.scope) {
      parameters = { ...parameters, scope: client.metadata.scope }
    }

    if (scopes) {
      const cScopes = client.metadata.scope?.split(' ')
      for (const scope of scopes) {
        if (!cScopes?.includes(scope)) {
          throw new InvalidRequestError(
            `Scope "${scope}" is not registered for this client`,
          )
        }
      }
    }

    for (const [scope, claims] of Object.entries(OIDC_SCOPE_CLAIMS)) {
      for (const claim of claims) {
        if (
          parameters?.claims?.id_token?.[claim]?.essential === true ||
          parameters?.claims?.userinfo?.[claim]?.essential === true
        ) {
          if (!scopes?.includes(scope)) {
            throw new InvalidRequestError(
              `Essential ${claim} claim requires "${scope}" scope`,
            )
          }
        }
      }
    }

    // Make "expensive" checks after the "cheaper" checks

    if (parameters.id_token_hint != null) {
      const { payload } = await this.signer.verify(parameters.id_token_hint, {
        // these are meant to be outdated when used as a hint
        clockTolerance: Infinity,
      })

      if (!payload.sub) {
        throw new InvalidRequestError(`Unexpected empty id_token_hint "sub"`)
      } else if (parameters.login_hint == null) {
        parameters = { ...parameters, login_hint: payload.sub }
      } else if (parameters.login_hint !== payload.sub) {
        throw new InvalidRequestError(
          'login_hint does not match "sub" of id_token_hint',
        )
      }
    }

    await this.hooks.onAuthorizationRequest?.call(
      null,
      // allow hooks to alter the parameters, without altering the (readonly) input
      (parameters = structuredClone(parameters)),
      { client, clientAuth },
    )

    return parameters
  }

  async get(
    uri: RequestUri,
    clientId: ClientId,
    deviceId: DeviceId,
  ): Promise<RequestInfo> {
    const id = decodeRequestUri(uri)

    const data = await this.store.readRequest(id)
    if (!data) {
      throw new InvalidRequestError('Invalid request_uri')
    }

    const updates: UpdateRequestData = {}

    try {
      if (data.sub || data.code) {
        // If an account was linked to the request, the next step is to exchange
        // the code for a token.
        throw new InvalidRequestError('This request was already authorized')
      }

      if (data.expiresAt < new Date()) {
        throw new InvalidRequestError('This request has expired')
      } else {
        updates.expiresAt = new Date(
          Date.now() + AUTHORIZATION_INACTIVITY_TIMEOUT,
        )
      }

      if (data.clientId !== clientId) {
        throw new InvalidRequestError(
          'This request was initiated for another client',
        )
      }

      if (!data.deviceId) {
        updates.deviceId = deviceId
      } else if (data.deviceId !== deviceId) {
        throw new InvalidRequestError(
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
  ): Promise<{ code?: Code; id_token?: string }> {
    const id = decodeRequestUri(uri)
    try {
      const data = await this.store.readRequest(id)
      if (!data) {
        throw new AccessDeniedError('This request was not initiated')
      }

      if (data.expiresAt < new Date()) {
        throw new AccessDeniedError('This request has expired')
      }
      if (!data.deviceId) {
        throw new AccessDeniedError('This request was not initiated')
      }
      if (data.deviceId !== deviceId) {
        throw new AccessDeniedError(
          'This request was initiated from another device',
        )
      }
      if (data.sub || data.code) {
        throw new AccessDeniedError('This request was already authorized')
      }

      const responseType = data.parameters.response_type.split(' ')

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
  ): Promise<{
    sub: Sub
    deviceId: DeviceId
    parameters: AuthorizationParameters
  }> {
    const result = await this.store.findRequestByCode(code)
    if (!result) throw new InvalidRequestError('Invalid code')

    try {
      const { data } = result

      if (data.sub == null || data.deviceId == null) {
        // Maybe the store implementation is faulty ?
        throw new Error('Unexpected request state')
      }

      if (data.clientId !== client.id) {
        throw new InvalidRequestError('This code was issued for another client')
      }

      if (data.expiresAt < new Date()) {
        throw new InvalidRequestError('This code has expired')
      }

      if (data.clientAuth.method === 'none') {
        // If the client did not use PAR, it was not authenticated when the
        // request was created (see authorize() method above). Since PAR is not
        // mandatory, and since the token exchange currently taking place *is*
        // authenticated (`clientAuth`), we allow "upgrading" the authentication
        // method (the token created will be bound to the current clientAuth).
      } else {
        if (clientAuth.method !== data.clientAuth.method) {
          throw new InvalidRequestError('Invalid client authentication')
        }

        if (!(await client.validateClientAuth(data.clientAuth))) {
          throw new InvalidRequestError('Invalid client authentication')
        }
      }

      return {
        sub: data.sub,
        deviceId: data.deviceId,
        parameters: data.parameters,
      }
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
