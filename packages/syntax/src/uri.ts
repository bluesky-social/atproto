export type UriString = `${string}:${string}`

export function isValidUri<I extends string>(input: I): input is I & UriString {
  return /^\w+:(?:\/\/)?[^\s/][^\s]*$/.test(input)
}
