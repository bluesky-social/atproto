# atproto OAuth Client for the Browser

This package provides a browser specific OAuth client implementation for
atproto. It implements all the OAuth features required by [ATPROTO] (PKCE, DPoP,
etc.).

`@atproto/oauth-client-browser` is designed for front-end applications that do
not have a backend server to manage OAuth sessions, a.k.a "Single Page
Applications" (SPA).

> [!IMPORTANT]
>
> When a backend server is available, it is recommended to use
> [`@atproto/oauth-client-node`](https://www.npmjs.com/package/@atproto/oauth-client-node)
> to manage OAuth sessions from the server side and use a session cookie to map
> the OAuth session to the front-end. Because this mechanism allows the backend
> to invalidate OAuth credentials at scale, this method is more secure than
> managing OAuth sessions from the front-end directly. Thanks to the added
> security, the OAuth server will provide longer lived tokens when issued to a
> BFF (Backend-for-frontend).

## Setup

### Client ID

The `client_id` is what identifies your application to the OAuth server. It is
used to fetch the client metadata and to initiate the OAuth flow. The
`client_id` must be a URL that points to the [client
metadata](#client-metadata).

### Client Metadata

Your OAuth client metadata should be hosted at a URL that corresponds to the
`client_id` of your application. This URL should return a JSON object with the
client metadata. The client metadata should be configured according to the
needs of your application and must respect the [ATPROTO] spec.

```json
{
  // Must be the same URL as the one used to obtain this JSON object
  "client_id": "https://my-app.com/client-metadata.json",
  "client_name": "My App",
  "client_uri": "https://my-app.com",
  "logo_uri": "https://my-app.com/logo.png",
  "tos_uri": "https://my-app.com/tos",
  "policy_uri": "https://my-app.com/policy",
  "redirect_uris": ["https://my-app.com/callback"],
  "scope": "atproto",
  "grant_types": ["authorization_code", "refresh_token"],
  "response_types": ["code"],
  "token_endpoint_auth_method": "none",
  "application_type": "web",
  "dpop_bound_access_tokens": true
}
```

The client metadata is used to instantiate an OAuth client. There are two ways
of doing this:

1. Either you "burn" the metadata into your application:

   ```typescript
   import { BrowserOAuthClient } from '@atproto/oauth-client-browser'

   const client = new BrowserOAuthClient({
     clientMetadata: {
       // Exact same JSON object as the one returned by the client_id URL
     },
     // ...
   })
   ```

2. Or you load it asynchronously from the URL:

   ```typescript
   import { OAuthClient } from '@atproto/oauth-client-browser'

   const client = await BrowserOAuthClient.load({
     clientId: 'https://my-app.com/client-metadata.json',
     // ...
   })
   ```

If performances are important to you, it is recommended to burn the metadata
into the script. Server side rendering techniques can also be used to inject the
metadata into the script at runtime.

### Handle Resolver

Whenever your application initiates an OAuth flow, it will start to resolve
the (user provider) APTROTO handle of the user. This is typically done though a
DNS request. However, because DNS resolution is not available in the browser, a
backend service must be provided.

> [!CAUTION]
>
> Using Bluesky-hosted services for handle resolution (eg, the `bsky.social`
> endpoint) will leak both user IP addresses and handle identifiers to Bluesky,
> a third party. While Bluesky has a declared privacy policy, both developers
> and users of applications need to be informed and aware of the privacy
> implications of this arrangement. Application developers are encouraged to
> improve user privacy by operating their own handle resolution service when
> possible. If you are a PDS self-hoster, you can use your PDS's URL for
> `handleResolver`.

If a `string` or `URL` object is used as `handleResolver`, the library will
expect this value to be the URL of a service running the
`com.atproto.identity.resolveHandle` XRPC Lexicon method.

> [!TIP]
>
> If you host your own PDS, you can use its URL as a handle resolver.

```typescript
import { BrowserOAuthClient } from '@atproto/oauth-client-browser'

const client = new BrowserOAuthClient({
  handleResolver: 'https://my-pds.example.com',
  // ...
})
```

Alternatively, if a "DNS over HTTPS" (DoH) service is available, it can be used
to resolve the handle. In this case, the `handleResolver` should be initialized
with a `AtprotoDohHandleResolver` instance:

```typescript
import {
  BrowserOAuthClient,
  AtprotoDohHandleResolver,
} from '@atproto/oauth-client-browser'

const client = new BrowserOAuthClient({
  handleResolver: new AtprotoDohHandleResolver('https://my-doh.example.com'),
  // ...
})
```

### Other configuration options

In addition to [Client Metadata](#client-metadata) and [Handle
Resolver](#handle-resolver), the `BrowserOAuthClient` constructor accepts the
following optional configuration options:

- `fetch`: A custom wrapper around the `fetch` function. This can be useful to
  add custom headers, logging, or to use a different fetch implementation.
  Defaults to `window.fetch`.

- `responseMode`: `query` or `fragment`. Determines how the authorization
  response is returned to the client. Defaults to `fragment`.

- `plcDirectoryUrl`: The URL of the PLC directory. This will typically not be
  needed unless you run an entire atproto stack locally. Defaults to
  `https://plc.directory`.

## Usage

Once the `client` is set up, it can be used to initiate & manage OAuth sessions.

### Initializing the client

The client will manage the sessions for you. In order to do so, it must first
initialize itself. Note that this operation must be performed once (and **only
once**) whenever the web app is loaded.

```typescript
const result: undefined | { session: OAuthSession; state?: string } =
  await client.init()

if (result) {
  const { session, state } = result
  if (state != null) {
    console.log(
      `${session.sub} was successfully authenticated (state: ${state})`,
    )
  } else {
    console.log(`${session.sub} was restored (last active session)`)
  }
}
```

The return value can be used to determine if the client was able to restore the
last used session (`session` is defined) or if the current navigation is the
result of an authorization redirect (both `session` and `state` are defined).

### Initiating an OAuth flow

In order to initiate an OAuth flow, we must first determine which PDS the
authentication flow will be initiated from. This means that the user must
provide one of the following information:

- The user's handle
- The user's DID
- A PDS/Entryway URL

Using that information, the OAuthClient will resolve all the needed information
to initiate the OAuth flow, and redirect the user to the OAuth server.

```typescript
try {
  await client.signIn('my.handle.com', {
    state: 'some value needed later',
    prompt: 'none', // Attempt to sign in without user interaction (SSO)
    ui_locales: 'fr-CA fr en', // Only supported by some OAuth servers (requires OpenID Connect support + i18n support)
    signal: new AbortController().signal, // Optional, allows to cancel the sign in (and destroy the pending authorization, for better security)
  })

  console.log('Never executed')
} catch (err) {
  console.log('The user aborted the authorization process by navigating "back"')
}
```

The returned promise will never resolve (because the user will be redirected to
the OAuth server). The promise will reject if the user cancels the sign in
(using an `AbortSignal`), or if the user navigates back from the OAuth server
(because of browser's back-forward cache).

### Handling the OAuth response

When the user is redirected back to the application, the OAuth response will be
available in the URL. The `BrowserOAuthClient` will automatically detect the
response and handle it when `client.init()` is called. Alternatively, the
application can manually handle the response using the
`client.callback(urlQueryParams)` method.

### Restoring a session

The client keeps track of all the sessions that it manages through an internal
store. Regardless of the session that was returned from the `client.init()`
call, any other session can be loaded using the `client.restore()` method. This
method will throw an error if the session is no longer available or if it has
become expired.

```ts
const aliceSession = await client.restore('did:plc:alice')
const bobSession = await client.restore('did:plc:bob')
```

In its current form, the client does not expose methods to list all sessions
in its store. The app will have to keep track of those itself.

### Watching for session invalidation

The client will emit events whenever a session becomes unavailable, allowing to
trigger global behaviors (e.g. show the login page).

```ts
client.addEventListener(
  'deleted',
  (
    event: CustomEvent<{
      sub: string
      cause: TokenRefreshError | TokenRevokedError | TokenInvalidError
    }>,
  ) => {
    const { sub, cause } = event.detail
    console.error(`Session for ${sub} is no longer available (cause: ${cause})`)
  },
)
```

## Usage with `@atproto/api`

The `@atproto/api` package provides a way to interact with multiple Bluesky
specific XRPC lexicons (`com.atproto`, `app.bsky`, `chat.bsky`, `tools.ozone`)
through the `Agent` interface. The `oauthSession` returned by the
`BrowserOAuthClient` can be used to instantiate an `Agent` instance.

```typescript
import { Agent } from '@atproto/api'

const session = await client.restore('did:plc:alice')

const agent = new Agent(session)

await agent.getProfile({ actor: agent.accountDid })
```

Any refresh of the credentials will happen under the hood, and the new tokens
will be saved in the session store (in the browser's indexed DB).

## Advances use-cases

### Using in development (localhost)

The OAuth server must be able to fetch the `client_metadata` object. The best
way to do this if you didn't already deployed your app is to use a tunneling
service like [ngrok](https://ngrok.com/).

The `client_id` will then be something like
`https://<your-ngrok-id>.ngrok.io/<path_to_your_client_metadata>`.

There is however a special case for loopback clients. A loopback client is a
client that runs on `localhost`. In this case, the OAuth server will not be able
to fetch the `client_metadata` object because `localhost` is not accessible from
the outside. To work around this, atproto OAuth servers are required to support
this case by providing an hard coded `client_metadata` object for the client.

This has several restrictions:

1. There is no way of configuring the client metadata (name, logo, etc.)
2. The validity of the refresh tokens (if any) will be very limited (typically 1
   day)
3. Silent-sign-in will not be allowed
4. Only `http://127.0.0.1:<any_port>` and `http://[::1]:<any_port>` can be used
   as origin for your app, and **not** `http://localhost:<any_port>`. This
   library will automatically redirect the user to an IP based origin
   (`http://127.0.0.1:<port>`) when visiting an origin with `localhost`.

Using a loopback client is only recommended for development purposes. A loopback
client can be instantiated like this:

```typescript
import { BrowserOAuthClient } from '@atproto/oauth-client-browser'

const client = new BrowserOAuthClient({
  handleResolver: 'https://bsky.social',
  // Only works if the current origin is a loopback address:
  clientMetadata: undefined,
})
```

If you need to use a special `redirect_uris`, you can configure them like this:

```typescript
import { BrowserOAuthClient } from '@atproto/oauth-client-browser'

const client = new BrowserOAuthClient({
  handleResolver: 'https://bsky.social',
  // Note that the origin of the "client_id" URL must be "http://localhost" when
  // using this configuration, regardless of the actual hostname ("127.0.0.1" or
  // "[::1]"), port or pathname. Only the `redirect_uris` must contain the
  // actual url that will be used to redirect the user back to the application.
  clientMetadata: `http://localhost?redirect_uri=${encodeURIComponent('http://127.0.0.1:8080/callback')}`,
})
```

[ATPROTO]: https://atproto.com/ 'AT Protocol'
