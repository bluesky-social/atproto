// typescript thinks it can't do import.meta, but it can <3

// @ts-ignore
if (typeof import.meta.env.VITE_AUTH_LOBBY !== 'string') {
  throw new Error('ENV: No relay host provided')
}
// @ts-ignore
export const AUTH_LOBBY = import.meta.env.VITE_AUTH_LOBBY
