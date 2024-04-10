# React Native OAuth Client Implementation

This packages provides a simple way to authenticate users using OAuth in a React Native application. This implementation
supports both web and mobile platforms.

## Installation

First, install the dependencies for this library and run a `pod install` to add their native dependencies to your
project. Then, install the library.

```bash
yarn add react-native-mmkv
yarn add 'https://github.com/bluesky-social/react-native-quick-crypto.git'

yarn add @atproto/oauth-client-react-native
cd ios && pod install
```

We use a forked version of `react-native-quick-crypto` because the changes that added `subtle.digest` are recent and
not yet published to NPM. Once there is a stable release in NPM with these changes, you may install it directly from
NPM.

Next, update your `metro.config.js` to include the following. If you are using Expo and do not have a `metro.config.js`,
see the [Expo documentation](https://docs.expo.dev/guides/customizing-metro/) for how to create one.

```javascript
cfg.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'crypto' && platform !== 'web') {
    return context.resolveRequest(
      context,
      'react-native-quick-crypto',
      platform,
    )
  }
  return context.resolveRequest(context, moduleName, platform)
}
```

