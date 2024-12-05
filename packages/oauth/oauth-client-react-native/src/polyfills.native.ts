import { Event, EventTarget } from 'event-target-shim'
import { install as installRNQC } from 'react-native-quick-crypto'

// Polyfill for the `throwIfAborted` method of the AbortController
// used in @atproto/oauth-client
import 'abortcontroller-polyfill/dist/polyfill-patch-fetch'

// Polyfill for jose. It tries to detect whether it's been passed a CryptoKey
// instance, and isn't willing to accept RNQC's equivalent. So, this ensures that
// `key instanceof CryptoKey` will always be true.
// @ts-ignore
global.CryptoKey = Object

// This is needed to populate the `crypto` global for jose's export here
// https://github.com/panva/jose/blob/1e8b430b08a18a18883a69e7991832c9c602ca1a/src/runtime/browser/webcrypto.ts#L1
installRNQC()

// These two are needed for @atproto/oauth-client's `CustomEventTarget` to work.
// @ts-ignore
global.EventTarget = EventTarget
// @ts-ignore
global.Event = Event

// And finally, this happens on React Native with every possible input:
// URL.canParse("http://example.com") => false
// I do not know why. Used in @atproto/oauth and @atproto/common-web
if (!URL.canParse('http://example.com')) {
  URL.canParse = (url: string | URL, base?: string) => {
    try {
      new URL(url, base)
      return true
    } catch (e) {
      return false
    }
  }
}
