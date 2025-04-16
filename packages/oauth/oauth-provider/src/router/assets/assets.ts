import type { HydrationData as FeHydrationData } from '@atproto/oauth-provider-frontend/hydration-data'
import type { HydrationData as UiHydrationData } from '@atproto/oauth-provider-ui/hydration-data'
import { CspConfig } from '../../lib/csp/index.js'
import { combineMiddlewares } from '../../lib/http/middleware.js'
import { Simplify } from '../../lib/util/type.js'
import { parseAssetsManifest } from './assets-manifest.js'

// If the "ui" and "frontend" packages are ever unified, this can be replaced
// with a single expression:
//
// const { getAssets, assetsMiddleware } = parseAssetsManifest(
//   require.resolve('@atproto/oauth-provider-ui/bundle-manifest.json'),
// )

const ui = parseAssetsManifest(
  require.resolve('@atproto/oauth-provider-ui/bundle-manifest.json'),
)
const fe = parseAssetsManifest(
  require.resolve('@atproto/oauth-provider-frontend/bundle-manifest.json'),
)

export type HydrationData = Simplify<UiHydrationData & FeHydrationData>

export function getAssets(entryName: keyof HydrationData) {
  const assetRef = ui.getAssets(entryName) || fe.getAssets(entryName)
  if (assetRef) return assetRef

  // Fool-proof. Should never happen.
  throw new Error(`Entry "${entryName}" not found in assets`)
}

export const assetsMiddleware = combineMiddlewares([
  ui.assetsMiddleware,
  fe.assetsMiddleware,
])

export const SPA_CSP: CspConfig = {
  // API calls are made to the same origin
  'connect-src': ["'self'"],
  // Allow loading of PDS logo & User avatars
  'img-src': ['data:', 'https:'],
  // Prevent embedding in iframes
  'frame-ancestors': ["'none'"],
}

/**
 * @see {@link https://docs.hcaptcha.com/#content-security-policy-settings}
 */
export const HCAPTCHA_CSP: CspConfig = {
  'script-src': ['https://hcaptcha.com', 'https://*.hcaptcha.com'],
  'frame-src': ['https://hcaptcha.com', 'https://*.hcaptcha.com'],
  'style-src': ['https://hcaptcha.com', 'https://*.hcaptcha.com'],
  'connect-src': ['https://hcaptcha.com', 'https://*.hcaptcha.com'],
}
