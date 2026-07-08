// @NOTE Order matters: clients that do not specify an explicit redirect URI
// default to the first entry.
export const DEFAULT_LOOPBACK_CLIENT_REDIRECT_URIS = Object.freeze([
  `http://127.0.0.1/`,
  `http://[::1]/`,
  `http://localhost/`,
] as const)
