import type { IncomingMessage, ServerResponse } from 'node:http'
import {
  OAuthAuthorizationRequestQuery,
  oauthAuthorizationRequestQuerySchema,
} from '@atproto/oauth-types'
import { AuthorizationError } from '../errors/authorization-error.js'
import { InvalidRequestError } from '../errors/invalid-request-error.js'
import {
  Middleware,
  Router,
  RouterCtx,
  getCookie,
  setCookie,
  validateFetchDest,
  validateFetchMode,
  validateFetchSite,
  validateOrigin,
  validateReferrer,
} from '../lib/http/index.js'
import { SecurityHeadersOptions } from '../lib/http/security-headers.js'
import { formatError } from '../lib/util/error.js'
import type { Awaitable } from '../lib/util/type.js'
import { writeFormRedirect } from '../lib/write-form-redirect.js'
import type { OAuthProvider } from '../oauth-provider.js'
import { parseRequestUri, requestUriSchema } from '../request/request-uri.js'
import { sendAuthorizePageFactory } from './assets/send-authorization-page.js'
import { sendCookieErrorPageFactory } from './assets/send-cookie-error-page.js'
import { sendErrorPageFactory } from './assets/send-error-page.js'
import {
  sendAuthorizationResultRedirect,
  sendRedirect,
} from './assets/send-redirect.js'
import { parseRedirectUrl } from './create-api-middleware.js'
import type { MiddlewareOptions } from './middleware-options.js'

export function createAuthorizationPageMiddleware<
  Ctx extends object | void = void,
  Req extends IncomingMessage = IncomingMessage,
  Res extends ServerResponse = ServerResponse,
>(
  server: OAuthProvider,
  { onError }: MiddlewareOptions<Req, Res>,
): Middleware<Ctx, Req, Res> {
  const issuerUrl = new URL(server.issuer)
  const issuerOrigin = issuerUrl.origin

  const securityOptions: SecurityHeadersOptions = {
    hsts: issuerUrl.protocol === 'http:' ? false : undefined,
  }

  const sendAuthorizePage = sendAuthorizePageFactory(
    server.customization,
    securityOptions,
  )
  const sendErrorPage = sendErrorPageFactory(
    server.customization,
    securityOptions,
  )
  const sendCookieErrorPage = sendCookieErrorPageFactory(
    server.customization,
    securityOptions,
  )

  const router = new Router<Ctx, Req, Res>(issuerUrl)

  router.get(
    '/oauth/authorize',
    withErrorHandler(async function (req, res) {
      res.setHeader('Cache-Control', 'no-store')
      res.setHeader('Pragma', 'no-cache')

      // "same-origin" is required to support the redirect test logic below (as
      // well as refreshing the authorization page).

      // @TODO Consider removing this altogether to allow hosting PDS and app on
      // the same site but different origins (different subdomains).
      validateFetchSite(req, ['same-origin', 'cross-site', 'none'])
      validateFetchMode(req, ['navigate'])
      validateFetchDest(req, ['document'])
      validateOrigin(req, issuerOrigin)

      // Do not perform any of the following logic if the request is invalid
      const query = parseOAuthAuthorizationRequestQuery(this.url)

      // @NOTE For some reason, even when loaded through a
      // ASWebAuthenticationSession, iOS will sometimes fail to properly save
      // cookies set during the rendering of the page. When this happens, the
      // authorization page logic, which relies on cookies to maintain the session,
      // will fail. To work around this, we perform an initial redirect to ourselves
      // using a form GET submit, in an attempt to verify if the browser saves
      // cookies on redirect or not. If it does, we proceed as normal. If it
      // doesn't, we redirect the user back to the client with an error message.
      if (
        // Only for iOS users
        req.headers['user-agent']?.includes('iPhone OS') &&
        // Disabled if the user already passed the test, which means their browser preserves cookies on redirect
        !(getCookie(req, 'cookie-test') === 'succeeded') &&
        // Disabled if the user already has a session
        !(await server.deviceManager.hasSession(req))
      ) {
        // @TODO Another possible solution would be to avoid relying on cookies if we
        // detect that they are not being preserved. This would mean that preserving
        // sessions (SSO) would not be possible for browsers that don't preserve
        // cookies on redirect, but at least the authorization request could still be
        // completed. This was not implemented yet due to the extra complexity
        // involved in supporting this.

        // 1) When the user first comes here, we will test if their browser
        // preserves cookies by redirecting back to ourselves
        if (!this.url.searchParams.has('redirect-test')) {
          // 2) Set a testing cookie
          setCookie(res, 'cookie-test', 'testing', {
            sameSite: 'lax',
            httpOnly: true,
          })

          // 3) And send an auto-submit form redirecting back to ourselves
          return writeFormRedirect(
            res,
            'get',
            this.url.href,
            // 4) We add an extra query parameter to trigger the test logic after
            // the redirect occurred.
            [...this.url.searchParams, ['redirect-test', '1']],
            securityOptions,
          )
        } else {
          // 5) We just got redirected back to ourselves. Verify that the
          // browser preserved cookies during the redirect
          if (getCookie(req, 'cookie-test')) {
            // 6) Success! The browser preserved cookies. Proceed with the
            // normal authorization flow.

            // 7) Set a long lasting cookie to skip the test next time
            setCookie(res, 'cookie-test', 'succeeded', {
              sameSite: 'lax',
              maxAge: 31 * 24 * 60 * 60,
              httpOnly: true,
            })
          } else {
            // The browser did NOT preserve cookies. We have to abort the
            // authorization request.

            if (this.url.searchParams.get('redirect-test') === '1') {
              // 8) Show an error page to the user explaining the situation

              // Give the browser another chance to save cookies after the use
              // pressed "Continue"
              setCookie(res, 'cookie-test', 'testing', {
                sameSite: 'lax',
                httpOnly: true,
              })

              // Make sure next time we reach the other branch and redirect back
              // to the client
              const continueUrl = new URL(this.url.href)
              continueUrl.searchParams.set('redirect-test', '2')
              return sendCookieErrorPage(req, res, { continueUrl })
            } else {
              // 9) Once the use acknowledges the error, redirect them back to
              // the client with an error message.

              // Allow the client to understand what happened (the `error`
              // response parameter value is constrained by the OAuth2 spec)
              const message = 'ERR_COOKIES_UNSUPPORTED'

              // @NOTE AuthorizationError thrown here will be caught by the
              // error handler middleware defined below, and cause a redirect
              // back to the client with the error parameters.
              if ('request_uri' in query) {
                // Load and delete the authorization request
                const requestUri = parseRequestUri(query.request_uri, {
                  path: ['query', 'request_uri'],
                })
                const data = await server.requestManager.get(
                  requestUri,
                  undefined,
                  query.client_id,
                )
                await server.requestManager.delete(requestUri)
                throw new AuthorizationError(data.parameters, message)
              } else if ('request' in query) {
                const client = await server.clientManager.getClient(
                  query.client_id,
                )
                const parameters = await server.decodeJAR(client, query)
                throw new AuthorizationError(parameters, message)
              } else {
                throw new AuthorizationError(query, message)
              }
            }
          }
        }
      }

      // Normal authorization flow
      const device = await server.deviceManager.load(req, res)

      const result = await server.authorize(query, device)

      if ('redirect' in result) {
        return sendAuthorizationResultRedirect(res, result, securityOptions)
      } else {
        return sendAuthorizePage(req, res, result)
      }
    }),
  )

  // This is a private endpoint that will be called by the user after the
  // authorization request was either approved or denied. The logic performed
  // here **could** be performed directly in the frontend. We decided to
  // implement it here to avoid duplicating the logic.
  router.get(
    '/oauth/authorize/redirect',
    withErrorHandler(async function (req, res) {
      // Ensure we come from the authorization page
      validateFetchSite(req, ['same-origin'])
      validateFetchMode(req, ['navigate'])
      validateFetchDest(req, ['document'])
      validateOrigin(req, issuerOrigin)

      const referrer = validateReferrer(req, {
        origin: issuerOrigin,
        pathname: '/oauth/authorize',
      })

      // Ensure we are coming from the authorization page
      requestUriSchema.parse(referrer.searchParams.get('request_uri'))

      return sendRedirect(res, parseRedirectUrl(this.url), securityOptions)
    }),
  )

  return router.buildMiddleware()

  function withErrorHandler<T extends RouterCtx>(
    handler: (this: T, req: Req, res: Res) => Awaitable<void>,
  ): Middleware<T, Req, Res> {
    return async function (req, res) {
      try {
        await handler.call(this, req, res)
      } catch (err) {
        onError?.(req, res, err, `Authorization Request Error`)

        if (!res.headersSent) {
          if (err instanceof AuthorizationError) {
            return sendAuthorizationResultRedirect(
              res,
              {
                issuer: server.issuer,
                parameters: err.parameters,
                redirect: err.toJSON(),
              },
              securityOptions,
            )
          } else {
            return sendErrorPage(req, res, err)
          }
        } else if (!res.destroyed) {
          res.end()
        }
      }
    }
  }
}

function parseOAuthAuthorizationRequestQuery(
  url: URL,
): OAuthAuthorizationRequestQuery {
  const query = Object.fromEntries(url.searchParams)
  const result = oauthAuthorizationRequestQuerySchema.safeParse(query, {
    path: ['query'],
  })

  if (!result.success) {
    const message = 'Invalid request parameters'
    const err = result.error
    throw new InvalidRequestError(formatError(err, message), err)
  }

  return result.data
}
