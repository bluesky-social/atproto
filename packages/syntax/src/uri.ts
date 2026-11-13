export type UriString = `${string}:${string}`

export function isValidUri<I>(input: I): input is I & UriString {
  return typeof input === 'string' && /^\w+:(?:\/\/)?[^\s/][^\s]*$/.test(input)
}
