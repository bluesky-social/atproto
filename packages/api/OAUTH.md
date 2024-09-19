# OAuth Client Quickstart

This document describes how to implement OAuth based authentication in a
browser-based Single Page App (SPA), to communicate with
[atproto](https://atproto.com) API services.

## Prerequisites

- You need a web server - or at the very least a static file server - to host your SPA.

> [!TIP]
>
> During development, you can use a local server to host your client metadata.
> You will need to use a tunneling service like [ngrok](https://ngrok.com/) to
> make your local server accessible from the internet.

> [!TIP]
>
> You can use a service like [GitHub Pages](https://pages.github.com/) to host
> your client metadata and SPA for free.

- You must be able to build and deploy a SPA to your server.

## Step 1: Create your client metadata

Based on your hosting server endpoint, you will first need to choose a
`client_id`. That `client_id` will be used to identify your client to
Authorization Servers. A `client_id` must be a URL pointing to a JSON file
which contains your client metadata. The client metadata **must** contain a
`client_id` that is the URL used to access the metadata.

Here is an example client metadata.

```json
{
  "client_id": "https://example.com/client-metadata.json",
  "client_name": "Example atproto Browser App",
  "client_uri": "https://example.com",
  "logo_uri": "https://example.com/logo.png",
  "tos_uri": "https://example.com/tos",
  "policy_uri": "https://example.com/policy",
  "redirect_uris": ["https://example.com/callback"],
  "scope": "atproto",
  "grant_types": ["authorization_code", "refresh_token"],
  "response_types": ["code"],
  "token_endpoint_auth_method": "none",
  "application_type": "web",
  "dpop_bound_access_tokens": true
}
```

- `redirect_uris`: An array of URLs that will be used as the redirect URIs for
  the OAuth flow. This should typically contain a single URL that points to a
  page on your SPA that will handle the OAuth response. This URL must be HTTPS.

- `client_id`: The URL where the client metadata is hosted. This field must be
  the exact same as the URL used to access the metadata.

- `client_name`: The name of your client. Will be displayed to the user during
  the authentication process.

- `client_uri`: The URL of your client. Whether or not this value is actually
  displayed / used is up to the Authorization Server.

- `logo_uri`: The URL of your client's logo. Should be displayed to the user
  during the authentication process. Whether your logo is actually displayed
  during the authentication process or not is up to the Authorization Server.

- `tos_uri`: The URL of your client's terms of service. Will be displayed to
  the user during the authentication process.

- `policy_uri`: The URL of your client's privacy policy. Will be displayed to
  the user during the authentication process.

- If you don't want or need the user to stay authenticated for long periods
  (better for security), you can remove `refresh_token` from the `grant_types`.

> [!NOTE]
>
> To mitigate phishing attacks, the Authentication Server will typically _not_
> display the `client_uri` or `logo_uri` to the user. If you don't see your logo
> or client name during the authentication process, don't worry. This is normal.
> The `client_name` _is_ generally displayed for all clients.

Upload this JSON file so that it is accessible at the URL you chose for your
`client_id`.

## Step 2: Setup your SPA

Start by setting up your SPA. You can use any framework you like, or none at
all. In this example, we will use TypeScript and Parcel, with plain JavaScript.

```bash
npm init -y
npm install --save-dev @atproto/oauth-client-browser
npm install --save-dev @atproto/api
npm install --save-dev parcel
npm install --save-dev parcel-reporter-static-files-copy
mkdir -p src
mkdir -p static
```

Create a `.parcelrc` file with the following (exact) content:

```json
{
  "extends": ["@parcel/config-default"],
  "reporters": ["...", "parcel-reporter-static-files-copy"]
}
```

Create an `src/index.html` file with the following content:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>My First OAuth App</title>
    <script type="module" src="app.ts"></script>
  </head>
  <body>
    Loading...
  </body>
</html>
```

And an `src/app.ts` file, with the following content:

```typescript
console.log('Hello from atproto OAuth example app!')
```

Start the app in development mode:

```bash
npx parcel src/index.html
```

In another terminal, open a tunnel to your local server:

```bash
ngrok http 1234
```

Create a `static/client-metadata.json` file with the client metadata you created
in [Step 1](#step-1-create-your-client-metadata). Use the hostname provided by
ngrok as the `client_id`:

```json
{
  "client_id": "https://<RANDOM_VALUE>.ngrok.app/client-metadata.json",
  "client_name": "My First atproto OAuth App",
  "client_uri": "https://<RANDOM_VALUE>.ngrok.app",
  "redirect_uris": ["https://<RANDOM_VALUE>.ngrok.app/"],
  "grant_types": ["authorization_code"],
  "response_types": ["code"],
  "token_endpoint_auth_method": "none",
  "application_type": "web",
  "dpop_bound_access_tokens": true
}
```

## Step 3: Implement the OAuth flow

Replace the content of the `src/app.ts` file, with the following content:

```typescript
import { Agent } from '@atproto/api'
import { BrowserOAuthClient } from '@atproto/oauth-client-browser'

async function main() {
  const oauthClient = await BrowserOAuthClient.load({
    clientId: '<YOUR_CLIENT_ID>',
    handleResolver: 'https://bsky.social/',
  })

  // TO BE CONTINUED
}

document.addEventListener('DOMContentLoaded', main)
```

> [!CAUTION]
>
> Using Bluesky-hosted services for handle resolution (eg, the `bsky.social`
> endpoint) will leak both user IP addresses and handle identifier to Bluesky,
> a third party. While Bluesky has a declared privacy policy, both developers
> and users of applications need to be informed of and aware of the privacy
> implications of this arrangement. Application developers are encouraged to
> improve user privacy by operating their own handle resolution service when
> possible. If you are a PDS self-hoster, you can use your PDS's URL for
> `handleResolver`.

The `oauthClient` is now configured to communicate with the user's
Authorization Service. You can now initialize it in order to detect if the user
is already authenticated. Replace the `// TO BE CONTINUED` comment with the
following code:

```typescript
const result = await oauthClient.init()

if (result) {
  if ('state' in result) {
    console.log('The user was just redirected back from the authorization page')
  }

  console.log(`The user is currently signed in as ${result.session.did}`)
}

const session = result?.session

// TO BE CONTINUED
```

At this point you can detect if the user is already authenticated or not (by
checking if `session` is `undefined`).

Let's initiate an authentication flow if the user is not authenticated. Replace
the `// TO BE CONTINUED` comment with the following code:

```typescript
if (!session) {
  const handle = prompt('Enter your atproto handle to authenticate')
  if (!handle) throw new Error('Authentication process canceled by the user')

  const url = await oauthClient.authorize(handle)

  // Redirect the user to the authorization page
  window.open(url, '_self', 'noopener')

  // Protect against browser's back-forward cache
  await new Promise<never>((resolve, reject) => {
    setTimeout(
      reject,
      10_000,
      new Error('User navigated back from the authorization page'),
    )
  })
}

// TO BE CONTINUED
```

At this point in the script, the user **will** be authenticated. Authenticated
API calls can be made using the `session`. The `session` can be used to instantiate the
`Agent` class from `@atproto/api`. Let's make a simple call to the API to
retrieve the user's profile. Replace the `// TO BE CONTINUED` comment with the
following code:

```typescript
if (session) {
  const agent = new Agent(session)

  const fetchProfile = async () => {
    const profile = await agent.getProfile({ actor: agent.did })
    return profile.data
  }

  // Update the user interface

  document.body.textContent = `Authenticated as ${agent.did}`

  const profileBtn = document.createElement('button')
  document.body.appendChild(profileBtn)
  profileBtn.textContent = 'Fetch Profile'
  profileBtn.onclick = async () => {
    const profile = await fetchProfile()
    outputPre.textContent = JSON.stringify(profile, null, 2)
  }

  const logoutBtn = document.createElement('button')
  document.body.appendChild(logoutBtn)
  logoutBtn.textContent = 'Logout'
  logoutBtn.onclick = async () => {
    await session.signOut()
    window.location.reload()
  }

  const outputPre = document.createElement('pre')
  document.body.appendChild(outputPre)
}
```

[API]: ./README.md
