const base = 'https://waverly.social/profile'
const subPath = 'w'

export default (handle: string, rkey: string) =>
  `${base}/${handle}/${subPath}/${rkey}`
