import {
  BrowserOAuthClientFactory,
  LoginContinuedInParentWindowError,
} from '..'

// It is also possible to fetch clientMetadata from
// '/.well-known/oauth-client-metadata'. This is slower than bundling the client
// metadata with the app, as the app will have to wait for the fetch to complete
// on every load:

// const oauthFactory = await BrowserOAuthClientFactory.load()

const oauthFactory = new BrowserOAuthClientFactory({
  clientMetadata: {
    client_id: 'https://example.com',
    redirect_uris: ['https://example.com/cb'],
    grant_types: ['authorization_code', 'refresh_token'],
    response_types: ['code id_token', 'code'],
    scope: 'openid profile email phone offline_access',
    dpop_bound_access_tokens: true,
    application_type: 'web',
  },
})

/**
 * @param input a did, a handle (without @) or a pds url (starting with https://)
 */
export async function login(input = 'matthieu.bsky.team') {
  // Redirect the user to the PDS's login page
  return oauthFactory
    .signIn(input, {
      state: '123', // Use this to restore the state of the app (e.g. navigation, etc.) after signInCallback() (will be ignored in "popup" mode)
      display: 'popup', // or 'page'
    })
    .then(async (client) => {
      // Note: this will only be called in "popup" display mode. In any other
      // mode, the current page will be redirected to the PDS's login page.
      await client.request('/xrpc/com.atproto.foo.bar', {
        method: 'get',
        headers: {},
      })
    })
    .catch((err) => {
      // May happen if the user navigates back from the login page (because of
      // back-forward cache), or in popup mode, if the login resulted in an
      // error.
      console.error('Failed to sign in:', err)
    })
}

// If the current url is a redirect url, and contains oauth response params,
// complete the sign in process.
oauthFactory
  .signInCallback()
  .catch((err) => {
    // This page is being used as a popup: Prompt the user to close the popup.
    if (err instanceof LoginContinuedInParentWindowError) {
      // Prevent the user from loading the app in the popup by reloading the
      // page or navigating back.

      // Replace the current history entry so that reloading the page does not load this script
      history.replaceState(null, '', '/close-popup.html')

      // Display a "plz close this popup" message to the user
      window.open('/close-popup.html', '_self')

      // Prevent back-forward cache from restoring the page and continuing the current promise chain
      return new Promise<never>(() => {})
    }

    console.error('OAuth callback error:', err)
    throw err
  })
  .then(async (result) => {
    const currentSessionId = localStorage.getItem('currentSessionId')

    if (currentSessionId) {
      if (!result) {
        try {
          return await oauthFactory.restore(currentSessionId, true)
        } catch (err) {
          // Session expired ? Network error ?
          console.error('Failed to restore session:', err)

          // Only remove the item if the session has expired
          // TODO: add example on how to detect this
          // localStorage.removeItem('currentSessionId')

          return null
        }
      } else {
        // Make sure to revoke any credentials we no longer need
        try {
          await oauthFactory.revoke(currentSessionId)
        } catch {
          // revoke should never throw...
        } finally {
          localStorage.removeItem('currentSessionId')
        }
      }
    }

    if (!result) return null

    const { client, state } = result

    // Remember sessionId for next app load
    localStorage.setItem('currentSessionId', client.sessionId)

    console.log(state) // "123"

    return client
  })
  .then(async (client) => {
    // User is not signed in...
    if (!client) return

    // User is signed in, do something with the client
    await client.request('/xrpc/com.atproto.foo.bar', {
      method: 'get',
      headers: {},
    })
  })
