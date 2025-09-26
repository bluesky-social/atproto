# Expo Atproto OAuth

This is an Expo client library for Atproto OAuth. It implements the required
native crypto functions for supporting JWTs in React Native and uses the base
`OAuthClient` interface found in [the Atproto repository](https://github.com/bluesky-social/atproto/tree/main/packages/oauth/oauth-client).

### In bare React Native projects

For bare React Native projects, you must ensure that you have [installed and configured the `expo` package](https://docs.expo.dev/bare/installing-expo-modules/)
before continuing.

## Installation

Once you have satisfied the prerequisites, you can simply install the library with `npm install --save @atproto/oauth-client-expo`.

## Usage

### Serve your `oauth-client-metadata.json`

You will need to server an `oauth-client-metadata.json` from your application's website. An example of this metadata
would look like this:

```json
// assets/oauth-client-metadata.json
{
  "client_id": "https://example.com/oauth-client-metadata.json",
  "client_name": "React Native OAuth Client Demo",
  "client_uri": "https://example.com",
  "redirect_uris": ["com.example:/auth/callback"],
  "scope": "atproto repo:* rpc:*?aud=did:web:api.bsky.app#bsky_appview",
  "token_endpoint_auth_method": "none",
  "response_types": ["code"],
  "grant_types": ["authorization_code", "refresh_token"],
  "application_type": "native",
  "dpop_bound_access_tokens": true
}
```

- The `client_id` should be the same URL as where you are serving your
  `oauth-client-metadata.json` from
- The `client_uri` can be the home page of where you are serving your metadata
  from
- Your `redirect_uris` should contain a native redirect URI (for ios/android),
  as well as a web redirect URI (for web).
- native redirect URI must have a custom scheme, which is formatted as the
  _reverse_ of the domain you are serving the metadata from. Since I am serving
  mine from `example.com`, I use `com.example` as the scheme. If my domain were
  `atproto.expo.dev`, I would use `dev.expo.atproto`. Additionally, the scheme
  _must_ contain _only one trailing slash_ after the `:`. `com.example://` is
  invalid.
- The `application_type` must be `native`

For a real-world example, see [Skylight's client metadata](https://skylight.expo.app/oauth/client-metadata.json).

For more information about client metadata, see [the Atproto documentation](https://atproto.com/specs/oauth#client-id-metadata-document).

### Create a client

Next, you want to create an `ExpoOAuthClient`. You will need to pass in the same client metadata to the client as you are serving in your `oauth-client-metadata.json`.

```ts
// utils/oauth-client.ts
const clientMetadata = require('../assets/oauth-client-metadata.json')

const client = new ExpoOAuthClient({
  handleResolver: 'https://bsky.social',
  clientMetadata,
})
```

### Sign a user in

Whenever you are ready, you can initiate a sign in attempt for the user using the client using `client.signIn(input)`

`input` must be one of the following:

- A valid Atproto user handle, e.g. `hailey.bsky.team` or `example.com`
- A valid DID, e.g. `did:web:example.com` or `did:plc:oisofpd7lj26yvgiivf3lxsi`
- A valid PDS host, e.g. `https://cocoon.example.com` or `https://bsky.social`

> [!NOTE] If you wish to allow a user to _create_ an account instead of signing
> in, simply use a valid PDS hostname rather than a handle. They will be
> presented the option to either Sign In with an existing account, or create a
> new one, on the PDS's sign in page.

The response of `signIn` will be a promise resolving to the following:

```ts
    | { status: WebBrowserResultType } // See Expo Web Browser documentation
    | { status: 'error'; error: unknown }
    | { status: 'success'; session: OAuthSession }
```

For example:

```ts
try {
  const session = await client.signIn(input ?? '')
  setSession(session)
  const agent = new Agent(session)
  setAgent(agent)
} catch (err) {
  Alert.alert('Error', String(err))
}
```

### Create an `Agent`

To interface with the various Atproto APIs, you will need to create an `Agent`. You will pass your `OAuthSession` to the `Agent` or `XrpcClient` constructor.

```ts
const agent = new Agent(session)
// or
const xrpc = new XrpcClient(session)
```

Session refreshes will be handled for you for the lifetime of the agent.

### Restoring a session

After, for example, closing the application, you will probably need to restore the user's session. You can do this by using the user's DID on the `ExpoOAuthClient`.

```ts
const session = await client.restore('did:plc:oisofpd7lj26yvgiivf3lxsi')
const agent = new Agent(session)
```

If the session needs to be refreshed, `.restore()` will automatically do this for you before returning a session (based on the token's expiration date). In order to force a refresh, you can pass in `true` as the second argument to `restore`.

```ts
const session = await client.restore(
  'did:plc:oisofpd7lj26yvgiivf3lxsi',
  true, // force a refresh, ensuring tokens were not revoked
)
```

## Additional Reading

- [Atproto OAuth Spec](https://atproto.com/specs/oauth)
- [Atproto Web OAuth Example](https://github.com/bluesky-social/atproto/tree/main/packages/oauth/oauth-client-browser-example)
