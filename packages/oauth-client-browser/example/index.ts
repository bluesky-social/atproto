import { OAuthBrowserClient } from '..'

const OAuthClient = OAuthBrowserClient.create({
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

// Redirect the user to the PDS's login page
await OAuthClient.signIn('@matthieu.bsky.team', {
  state: '123',
})

// If the current url is the callback url, and contains "state" query param,
// call the callback() method to complete the OAuth flow
OAuthClient.signInCallback().then(async ({ sessionId, client, state }) => {
  console.log(state) // "123"
  console.log(sessionId) // Add this to the app's list of active sessions

  await client.request('/xrpc/com.atproto.goo', {
    method: 'get',
    headers: {},
  })
})

OAuthClient.signInPopup('@matthieu.bsky.team').then(async (client) => {
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
