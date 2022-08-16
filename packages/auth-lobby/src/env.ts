// typescript thinks it can't do import.meta, but it can <3

// @ts-ignore
if (typeof import.meta.env.VITE_RELAY_HOST !== 'string') {
  throw new Error('ENV: No relay host provided')
}
// @ts-ignore
export const RELAY_HOST = import.meta.env.VITE_RELAY_HOST
