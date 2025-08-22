// @NOTE This is **not** using an import from "@atproto/lexicon" because it
// causes bundling issues with Vite due to the fact that "@atproto/lexicon" is
// not an esm module.

export type LexPermission = {
  type: 'permission'
  resource: string
} & Record<
  string,
  undefined | string | number | boolean | (string | number | boolean)[]
>
