export type $Type<I extends string, H extends string> = H extends 'main'
  ? I
  : `${I}#${H}`

export function $type<I extends string, H extends string>(
  nsid: I,
  hash: H,
): $Type<I, H> {
  return (hash === 'main' ? nsid : `${nsid}#${hash}`) as $Type<I, H>
}
