export function isValidPermission(value) {
  return (
    value === 'atproto' ||
    value === 'transition:email' ||
    value === 'transition:generic' ||
    value === 'transition:chat.bsky'
  )
}
