import { browserOAuthClientFactory } from '..'

const OAuthClient = browserOAuthClientFactory({
  clientMetadata: {
    client_id: 'https://example.com',
    redirect_uris: ['https://example.com/cb'],
    grant_types: ['authorization_code', 'refresh_token'],
    response_types: ['code', 'code id_token'],
    scope: 'openid profile email phone offline_access',
    dpop_bound_access_tokens: true,
    application_type: 'web',
  },
})

// If the current url is the callback url, and contains "state" query param,
// call the callback() method to complete the OAuth flow
OAuthClient.callback().then(async ({ sessionId, client, state }) => {
  console.log(state) // "123"
  console.log(sessionId) // Add this to the app's list of active sessions

  await client.request('/xrpc/com.atproto.goo', {
    method: 'get',
    headers: {},
  })
})

OAuthClient.signIn('@matthieusieben.com').then(() => {
  // Never called (navigated to the login page)
})

OAuthClient.signInPopup('@matthieusieben.com').then(async (client) => {
  await client.request('/xrpc/com.atproto.goo', {
    method: 'get',
    headers: {},
  })
})

OAuthClient.restore('<sessionId>').then(async (client) => {
  await client.request('/xrpc/com.atproto.goo', {
    method: 'get',
    headers: {},
  })
  //
})
