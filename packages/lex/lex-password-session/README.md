# @atproto/lex-password-agent

Password-based client authentication for AT Protocol Lexicons. See the [Changelog](./CHANGELOG.md) for version history.

```bash
npm install @atproto/lex-password-agent
```

- Session management with automatic token refresh
- Hooks for persisting and monitoring session state
- PDS endpoint discovery from DID documents
- Two-factor authentication support

> [!IMPORTANT]
>
> This package is currently in **preview**. The API and features are subject to change before the stable release.

**What is this?**

`@atproto/lex-password-agent` provides a `PasswordAgent` class that implements the `Agent` interface from `@atproto/lex-client`. It handles password-based authentication with AT Protocol services, including:

1. Creating sessions with username/password credentials
2. Automatic token refresh when access tokens expire
3. Session persistence through lifecycle hooks
4. Graceful logout with server-side session cleanup

```typescript
import { Client } from '@atproto/lex-client'
import { PasswordAgent } from '@atproto/lex-password-agent'
import * as app from './lexicons/app.js'

// Login with credentials
const result = await PasswordAgent.login({
  service: 'https://bsky.social',
  identifier: 'alice.bsky.social',
  password: 'app-password',
  hooks: {
    onRefreshed: (session) => saveToStorage(session),
    onDeleted: (session) => clearStorage(session),
  },
})

if (!result.success) throw result.error

const agent = result.value
const client = new Client(agent)

// Make authenticated requests
const profile = await client.call(app.bsky.actor.getProfile, {
  actor: agent.did,
})
```

<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->

- [Quick Start](#quick-start)
- [PasswordAgent](#passwordagent)
  - [Login](#login)
  - [Two-Factor Authentication](#two-factor-authentication)
  - [Resume Session](#resume-session)
  - [Logout](#logout)
  - [Static Delete](#static-delete)
- [Session Hooks](#session-hooks)
  - [onRefreshed](#onrefreshed)
  - [onRefreshFailure](#onrefreshfailure)
  - [onDeleted](#ondeleted)
  - [onDeleteFailure](#ondeletefailure)
- [Session Object](#session-object)
- [Error Handling](#error-handling)
- [Using with Client](#using-with-client)
- [License](#license)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

## Quick Start

**1. Install the package**

```bash
npm install @atproto/lex-password-agent @atproto/lex-client
```

**2. Login and make requests**

```typescript
import { Client } from '@atproto/lex-client'
import { PasswordAgent } from '@atproto/lex-password-agent'

const result = await PasswordAgent.login({
  service: 'https://bsky.social',
  identifier: 'your-handle.bsky.social',
  password: 'your-app-password',
})

if (result.success) {
  const agent = result.value
  const client = new Client(agent)

  // Make authenticated API calls
  console.log('Logged in as:', agent.did)
}
```

## PasswordAgent

The `PasswordAgent` class manages password-based authentication sessions.

### Login

Create a new session with username and password:

```typescript
import { PasswordAgent } from '@atproto/lex-password-agent'

const result = await PasswordAgent.login({
  service: 'https://bsky.social',
  identifier: 'alice.bsky.social', // handle or email
  password: 'app-password',
  hooks: {
    onRefreshed: (session) => {
      // Persist session for later restoration
      localStorage.setItem('session', JSON.stringify(session))
    },
    onDeleted: () => {
      localStorage.removeItem('session')
    },
  },
})

if (result.success) {
  const agent = result.value
  console.log('Logged in as:', agent.did)
} else {
  console.error('Login failed:', result.error, result.message)
}
```

The `login()` method returns a discriminated union:

- On success: `{ success: true, value: PasswordAgent }`
- On expected errors: `XrpcResponseError` with `success: false`
- On unexpected errors: throws the error

### Two-Factor Authentication

If the account has 2FA enabled, login will return an `AuthFactorTokenRequired` error:

```typescript
const result = await PasswordAgent.login({
  service: 'https://bsky.social',
  identifier: 'alice.bsky.social',
  password: 'app-password',
})

if (!result.success && result.error === 'AuthFactorTokenRequired') {
  // Prompt user for 2FA code, then retry
  const code = await prompt2FACode()

  const retryResult = await PasswordAgent.login({
    service: 'https://bsky.social',
    identifier: 'alice.bsky.social',
    password: 'app-password',
    authFactorToken: code,
  })
}
```

### Resume Session

Restore a previously saved session:

```typescript
import { PasswordAgent, Session } from '@atproto/lex-password-agent'

// Load session from storage
const savedSession: Session = JSON.parse(localStorage.getItem('session')!)

// Resume the session (automatically refreshes tokens)
const agent = await PasswordAgent.resume(savedSession, {
  hooks: {
    onRefreshed: (session) => {
      localStorage.setItem('session', JSON.stringify(session))
    },
    onDeleted: () => {
      localStorage.removeItem('session')
    },
  },
})

console.log('Session resumed for:', agent.did)
```

> [!NOTE]
>
> `resume()` automatically calls `refresh()` to ensure the session is valid and tokens are current.

### Logout

End the session and notify the server:

```typescript
await agent.logout()
```

After logout:

- The `onDeleted` hook is called
- The agent is marked as destroyed (`agent.destroyed === true`)
- Further requests will throw `'Logged out'`

### Static Delete

Delete a session without creating an agent instance:

```typescript
import { PasswordAgent, Session } from '@atproto/lex-password-agent'

const session: Session = JSON.parse(localStorage.getItem('session')!)

// Delete the session on the server
await PasswordAgent.delete(session)
```

This is useful for cleanup scenarios where you don't need to make additional requests.

## Session Hooks

Hooks provide callbacks for session lifecycle events. All hooks receive the agent as `this` context.

### onRefreshed

Called when tokens are successfully refreshed:

```typescript
const result = await PasswordAgent.login({
  service: 'https://bsky.social',
  identifier: 'alice.bsky.social',
  password: 'app-password',
  hooks: {
    onRefreshed(session) {
      // `this` is the PasswordAgent instance
      console.log('Session refreshed for:', this.did)

      // Persist the updated session
      saveSession(session)
    },
  },
})
```

> [!IMPORTANT]
>
> Requests are blocked while `onRefreshed` is running. Keep this callback fast to avoid delays.

### onRefreshFailure

Called when token refresh fails due to transient errors (network issues, server unavailability):

```typescript
hooks: {
  onRefreshFailure(session, error) {
    console.warn('Token refresh failed:', error.message)
    // Session may still be valid - consider retry logic
  }
}
```

### onDeleted

Called when the session is terminated (logout or server-side invalidation):

```typescript
hooks: {
  onDeleted(session) {
    console.log('Session ended for:', session.data.did)
    clearPersistedSession(session.data.did)
    redirectToLogin()
  }
}
```

### onDeleteFailure

Called when logout fails due to transient errors:

```typescript
hooks: {
  onDeleteFailure(session, error) {
    console.error('Logout failed:', error.message)
    // Consider queuing for retry to avoid orphaned sessions
    queueLogoutRetry(session)
  }
}
```

> [!WARNING]
>
> Ignoring delete failures can leave sessions active on the server. Implement retry logic for security-sensitive applications.

## Session Object

The `Session` type contains all data needed to authenticate and restore sessions:

```typescript
type Session = {
  // Session credentials and user info from createSession response
  data: {
    accessJwt: string
    refreshJwt: string
    did: string
    handle: string
    email?: string
    emailConfirmed?: boolean
    didDoc?: object
    // ... other fields from createSession
  }

  // When tokens were last refreshed
  refreshedAt: string // ISO 8601 datetime

  // PDS URL extracted from DID document (for routing requests)
  pdsUrl: string | null

  // Original service URL used for login
  service: string
}
```

## Error Handling

Login errors are returned as `XrpcResponseError` objects:

```typescript
const result = await PasswordAgent.login({
  service: 'https://bsky.social',
  identifier: 'alice.bsky.social',
  password: 'wrong-password',
})

if (!result.success) {
  switch (result.error) {
    case 'AuthenticationRequired':
      console.error('Invalid credentials')
      break
    case 'AuthFactorTokenRequired':
      console.error('2FA required')
      break
    case 'AccountTakedown':
      console.error('Account has been suspended')
      break
    default:
      console.error('Login failed:', result.message)
  }
}
```

Common error codes:

| Error Code                | Description                    |
| ------------------------- | ------------------------------ |
| `AuthenticationRequired`  | Invalid username or password   |
| `AuthFactorTokenRequired` | 2FA code needed                |
| `AccountTakedown`         | Account suspended              |
| `ExpiredToken`            | Token has expired (on refresh) |
| `InvalidToken`            | Token is invalid               |

## Using with Client

The `PasswordAgent` implements the `Agent` interface and can be used directly with `Client`:

```typescript
import { Client } from '@atproto/lex-client'
import { PasswordAgent } from '@atproto/lex-password-agent'
import * as app from './lexicons/app.js'

const result = await PasswordAgent.login({
  service: 'https://bsky.social',
  identifier: 'alice.bsky.social',
  password: 'app-password',
})

if (result.success) {
  const client = new Client(result.value)

  // The client automatically uses the agent for authentication
  const profile = await client.call(app.bsky.actor.getProfile, {
    actor: client.assertDid,
  })

  // Tokens are automatically refreshed when expired
  const timeline = await client.call(app.bsky.feed.getTimeline, {
    limit: 50,
  })

  // Create records
  await client.create(app.bsky.feed.post, {
    text: 'Hello from lex-password-agent!',
    createdAt: new Date().toISOString(),
  })
}
```

The agent handles:

- Adding `Authorization` headers to requests
- Detecting expired tokens (401 responses or `ExpiredToken` errors)
- Automatically refreshing tokens and retrying failed requests
- Routing requests to the correct PDS based on DID document

## License

MIT or Apache2
