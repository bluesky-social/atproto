export function isValidPermission(value: string) {
  return (
    value === 'atproto' ||
    value === 'transition:email' ||
    value === 'transition:generic' ||
    value === 'transition:chat.bsky'
  )
}
