if (typeof process.env.REACT_APP_RELAY_HOST !== 'string') {
  throw new Error('ENV: No relay host provided')
}
export const RELAY_HOST = process.env.REACT_APP_RELAY_HOST

// @TODO: this is temporary for dev purposes
if (typeof process.env.REACT_APP_ROOT_USER !== 'string') {
  throw new Error('ENV: No root user provided')
}
export const ROOT_USER = process.env.REACT_APP_ROOT_USER

export const PRIV_KEY: string | null = process.env.REACT_APP_PRIV_KEY || null
