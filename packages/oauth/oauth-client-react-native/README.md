# atproto OAuth Client for React Native

This package implements an atproto OAuth client usable on the React Native
platform. It uses [react-native-quick-crypto] for cryptographic operations and
[expo-sqlite] for persistence. Its usage is very similar to the atproto OAuth
client for the browser, so refer to that [README] and [example] for general
usage. Some differences are noted below.

## expo-sqlite

This library uses [expo-sqlite] to store the OAuth state and session data in a
SQLite database. The schema is automatically created when the client is
instantiated.

Because this database is storing sensitive cryptographic keys, it is highly
reccomended to use the optional SQLCipher extension. This can be accomplished in
your app.json file:

```json
{
  "expo": {
    "plugins": [
      [
        "expo-sqlite",
        {
          "useSQLCipher": true
        }
      ]
    ]
  }
}
```

## Login and session restore flow

The basic login flow will involve popping up a web browser and allowing users to
authenticate with their selected PDS. This can be accomplished with the
`expo-web-browser` library:

```tsx
import { openAuthSessionAsync } from 'expo-web-browser'

// inside your login onPress, perhaps:
const loginUrl = await oauthClient.authorize(pds)
const res = await openAuthSessionAsync(loginUrl)
if (res.type === 'success') {
  const params = new URLSearchParams(url.split('?')[1])
  const { session, state } = await oauthClient.callback(params)
  console.log(`logged in as ${session.sub}`)
}
```

## Development on localhost

The atproto OAuth specification has a special case for development on localhost,
but it is required to use a redirectUrl that returns to `127.0.0.1` or `[::1]`.
This prevents the localhost OAuth flow from returning you directly to your app.
As a workaround, you can host a static HTML server on 127.0.0.1 that recieves
the incoming OAuth callback and then redirects to your app. (If you have a web
version of your React Native app, you can just use that.) Such a redirect page
might look something like this:

```tsx
import { useEffect } from 'react'
import { View, Text } from 'react-native'

export default function AppReturnScreen({ route }) {
  useEffect(() => {
    document.location.href = `com.example.app:/app-return${document.location.search}`
  }, [])
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Text>Redirecting you back to the app...</Text>
    </View>
  )
}
```

This flow will work on the iOS simulator and on Android devices provided you've
forwarded the port with `adb reverse`. For testing on iOS hardware, you'll
instead need to set up TLS.

[react-native-quick-crypto]:
  https://github.com/margelo/react-native-quick-crypto
[expo-sqlite]: https://docs.expo.dev/versions/latest/sdk/sqlite/
[README]:
  https://github.com/bluesky-social/atproto/tree/main/packages/oauth/oauth-client-browser
[example]:
  https://github.com/bluesky-social/atproto/tree/main/packages/oauth/oauth-client-browser-example
