// Like AtUri.make(...).toString() but without any validation, used to construct range queries.
// Unlike AtUri.make, it will leave a trailing slash when rkey is empty.
export function makeAtUriStringWithoutValidation(
  did: string,
  collection: string,
  rkey: string,
): string {
  return `at://${did}/${collection}/${rkey}`
}
