export type UriString = `${string}:${string}`

export function isValidUri<I>(input: I): input is I & UriString {
  return (
    typeof input === 'string' &&
    /^[A-Za-z][A-Za-z0-9+.-]*:(?:\/\/)?[^\s/][^\s]*$/.test(input)
  )
}
