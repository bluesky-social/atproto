// typescript thinks it can't do import.meta, but it can <3

// @ts-ignore
if (typeof import.meta.env.VITE_RELAY_HOST !== 'string') {
  throw new Error('ENV: No relay host provided')
}
// @ts-ignore
export const RELAY_HOST = import.meta.env.VITE_RELAY_HOST

// @TODO: this is temporary for dev purposes
export const ROOT_USER =
  'did:key:zDnaeuCmFYWLQymzoiAYzE6J9XC2CevkPFYsWMiuNLCRSqwWh'

// @TODO: this is temporary for dev purposes
export const PRIV_KEY = `{"crv":"P-256","d":"ulw8duh4C4hRbM-ZiaoIvL70tzR0FMaePKP8P5R8ziI","ext":true,"key_ops":["sign"],"kty":"EC","x":"q4EIvIEyCq4O74ASehU-NoGH6HDrcmeeVOyMjTkXHqI","y":"fngP6l5zfKX2jKHF7gIVZIltAEsZgNf48wzdF1QJPkc"}`
