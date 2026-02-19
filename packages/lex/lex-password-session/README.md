# @atproto/lex-password-session

Password-based session authentication for AT Protocol Lexicons. See the [Changelog](./CHANGELOG.md) for version history.

```bash
npm install @atproto/lex-password-session
```

- Session management with automatic token refresh
- Hooks for persisting and monitoring session state
- PDS endpoint discovery from DID documents
- Two-factor authentication support

> [!IMPORTANT]
>
> This package is currently in **preview**. The API and features are subject to change before the stable release.

**What is this?**

`@atproto/lex-password-session` provides a `PasswordSession` class that implements the `Agent` interface from `@atproto/lex-client`. It handles password-based authentication with AT Protocol services, including:

1. Creating sessions with username/password credentials
2. Automatic token refresh when access tokens expire
3. Session persistence through lifecycle hooks
4. Graceful logout with server-side session cleanup

```typescript
import { Client } from '@atproto/lex-client'
import { PasswordSession } from '@atproto/lex-password-session'
import * as app from './lexicons/app.js'

// Login with credentials
const session = await PasswordSession.login({
  service: 'https://bsky.social',
  identifier: 'alice.bsky.social',
  password: 'app-password',
  onUpdated: (data) => saveToStorage(data),
  onDeleted: (data) => clearStorage(data.did),
})

const client = new Client(session)

// Make authenticated requests
const profile = await client.call(app.bsky.actor.getProfile, {
  actor: session.did,
})
```

<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->

- [Quick Start](#quick-start)
- [PasswordSession](#passwordsession)
  - [Login](#login)
  - [Two-Factor Authentication](#two-factor-authentication)
  - [Resume Session](#resume-session)
  - [Logout](#logout)
  - [Static Delete](#static-delete)
  - [Create Account](#create-account)
- [Session Hooks](#session-hooks)
  - [onUpdated](#onupdated)
  - [onUpdateFailure](#onupdatefailure)
  - [onDeleted](#ondeleted)
  - [onDeleteFailure](#ondeletefailure)
- [Session Data](#session-data)
- [Error Handling](#error-handling)
- [Using with Client](#using-with-client)
- [License](#license)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

## Quick Start

**1. Install the package**

```bash
npm install @atproto/lex-password-session @atproto/lex-client
```

**2. Login and make requests**

```typescript
import { Client } from '@atproto/lex-client'
import { PasswordSession } from '@atproto/lex-password-session'

const session = await PasswordSession.login({
  service: 'https://bsky.social',
  identifier: 'your-handle.bsky.social',
  password: 'your-app-password',
})

const client = new Client(session)

// Make authenticated API calls
console.log('Logged in as:', session.did)
```

## PasswordSession

The `PasswordSession` class manages password-based authentication sessions.

### Login

Create a new session with username and password:

```typescript
import { PasswordSession } from '@atproto/lex-password-session'

const session = await PasswordSession.login({
  service: 'https://bsky.social',
  identifier: 'alice.bsky.social', // handle or email
  password: 'app-password',
  onUpdated: (data) => {
    // Persist session for later restoration
    localStorage.setItem('session', JSON.stringify(data))
  },
  onDeleted: () => {
    localStorage.removeItem('session')
  },
})

console.log('Logged in as:', session.did)
```

The `login()` method throws on failure. For expected errors like invalid credentials, an `XrpcResponseError` is thrown. For 2FA requirements, a `LexAuthFactorError` is thrown.

### Two-Factor Authentication

> [!CAUTION]
>
> Two-factor authentication only applies when using **main account credentials**, which is **strongly discouraged**. Password authentication should be used with [app passwords](https://bsky.app/settings/app-passwords) only because they are designed for programmatic access (bots, scripts, CLI tools). For user-facing applications, use OAuth via [@atproto/oauth-client](../../../oauth/oauth-client) which provides better security and user control.

If the account has 2FA enabled, login will throw a `LexAuthFactorError`:

```typescript
import {
  PasswordSession,
  LexAuthFactorError,
} from '@atproto/lex-password-session'

async function loginWith2FA(
  identifier: string,
  password: string,
  authFactorToken?: string,
): Promise<PasswordSession> {
  try {
    return await PasswordSession.login({
      service: 'https://bsky.social',
      identifier,
      password,
      authFactorToken,
      onUpdated: (data) => saveToStorage(data),
      onDeleted: (data) => removeFromStorage(data.did),
    })
  } catch (err) {
    if (err instanceof LexAuthFactorError && !authFactorToken) {
      // 2FA required - prompt user for code
      const token = await promptUserFor2FACode(err.message)
      return loginWith2FA(identifier, password, token)
    }
    throw err
  }
}
```

### Resume Session

Restore a previously saved session:

```typescript
import { PasswordSession, SessionData } from '@atproto/lex-password-session'

// Load session from storage
const savedSession: SessionData = JSON.parse(localStorage.getItem('session')!)

// Resume the session (automatically refreshes tokens)
const session = await PasswordSession.resume(savedSession, {
  onUpdated: (data) => {
    localStorage.setItem('session', JSON.stringify(data))
  },
  onDeleted: () => {
    localStorage.removeItem('session')
  },
})

console.log('Session resumed for:', session.did)

// Access session properties
console.log(session.did) // User's DID
console.log(session.handle) // User's handle
console.log(session.destroyed) // false (session is active)
```

> [!NOTE]
>
> `resume()` automatically calls `refresh()` to ensure the session is valid and tokens are current.

### Logout

End the session and notify the server:

```typescript
await session.logout()
```

After logout:

- The `onDeleted` hook is called
- The session is marked as destroyed (`session.destroyed === true`)
- Further requests will throw `'Logged out'`

### Static Delete

Delete a session without creating a session instance:

```typescript
import { PasswordSession, SessionData } from '@atproto/lex-password-session'

const data: SessionData = JSON.parse(localStorage.getItem('session')!)

// Delete the session on the server
await PasswordSession.delete(data)
```

This is useful for cleanup scenarios where you don't need to make additional requests.

### Create Account

Create a new account and get an authenticated session:

```typescript
import { PasswordSession } from '@atproto/lex-password-session'

const session = await PasswordSession.createAccount(
  {
    handle: 'alice.bsky.social',
    email: 'alice@example.com',
    password: 'secure-password',
  },
  {
    service: 'https://bsky.social',
    onUpdated: (data) => saveToStorage(data),
    onDeleted: (data) => removeFromStorage(data.did),
  },
)

console.log('Account created:', session.did)
```

## Session Hooks

Hooks provide callbacks for session lifecycle events. All hooks receive the session instance as `this` context.

### onUpdated

Called when the session is successfully created or refreshed:

```typescript
const session = await PasswordSession.login({
  service: 'https://bsky.social',
  identifier: 'alice.bsky.social',
  password: 'app-password',
  onUpdated(data) {
    // `this` is the PasswordSession instance
    console.log('Session updated for:', this.did)

    // Persist the updated session
    saveSession(data)
  },
})
```

> [!IMPORTANT]
>
> Requests are blocked while `onUpdated` is running. Keep this callback fast to avoid delays.

### onUpdateFailure

Called when token refresh fails due to transient errors (network issues, server unavailability):

```typescript
{
  onUpdateFailure(data, error) {
    console.warn('Token refresh failed:', error.message)
    // Session may still be valid - consider retry logic
  }
}
```

### onDeleted

Called when the session is terminated (logout or server-side invalidation):

```typescript
{
  onDeleted(data) {
    console.log('Session ended for:', data.did)
    clearPersistedSession(data.did)
    redirectToLogin()
  }
}
```

### onDeleteFailure

Called when logout fails due to transient errors:

```typescript
{
  onDeleteFailure(data, error) {
    console.error('Logout failed:', error.message)
    // Consider queuing for retry to avoid orphaned sessions
    queueLogoutRetry(data)
  }
}
```

> [!WARNING]
>
> Ignoring delete failures can leave sessions active on the server. Implement retry logic for security-sensitive applications.

## Session Data

The `SessionData` type contains all data needed to authenticate and restore sessions:

```typescript
type SessionData = {
  // Session credentials and user info from createSession response
  accessJwt: string
  refreshJwt: string
  did: string
  handle: string
  email?: string
  emailConfirmed?: boolean
  didDoc?: object
  // ... other fields from createSession

  // Original service URL used for login
  service: string
}
```

## Error Handling

The `PasswordSession` class uses exception-based error handling:

```typescript
import {
  PasswordSession,
  LexAuthFactorError,
} from '@atproto/lex-password-session'
import { XrpcResponseError } from '@atproto/lex-client'

try {
  const session = await PasswordSession.login({
    service: 'https://bsky.social',
    identifier: 'alice.bsky.social',
    password: 'wrong-password',
  })
} catch (err) {
  if (err instanceof LexAuthFactorError) {
    console.error('2FA required')
  } else if (err instanceof XrpcResponseError) {
    switch (err.error) {
      case 'AuthenticationRequired':
        console.error('Invalid credentials')
        break
      case 'AccountTakedown':
        console.error('Account has been suspended')
        break
      default:
        console.error('Login failed:', err.message)
    }
  } else {
    throw err
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

The `PasswordSession` implements the `Agent` interface and can be used directly with `Client`:

```typescript
import { Client } from '@atproto/lex-client'
import { PasswordSession } from '@atproto/lex-password-session'
import * as app from './lexicons/app.js'

const session = await PasswordSession.login({
  service: 'https://bsky.social',
  identifier: 'alice.bsky.social',
  password: 'app-password',
})

const client = new Client(session)

// The client automatically uses the session for authentication
const profile = await client.call(app.bsky.actor.getProfile, {
  actor: client.assertDid,
})

// Tokens are automatically refreshed when expired
const timeline = await client.call(app.bsky.feed.getTimeline, {
  limit: 50,
})

// Create records
await client.create(app.bsky.feed.post, {
  text: 'Hello from lex-password-session!',
  createdAt: new Date().toISOString(),
})
```

The session handles:

- Adding `Authorization` headers to requests
- Detecting expired tokens (401 responses or `ExpiredToken` errors)
- Automatically refreshing tokens and retrying failed requests
- Routing requests to the correct PDS based on DID document

## License

MIT or Apache2
