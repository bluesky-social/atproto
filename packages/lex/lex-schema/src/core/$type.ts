import { NsidString } from './string-format.js'

export type $Type<
  N extends NsidString = NsidString,
  H extends string = string,
> = N extends NsidString
  ? string extends H
    ? N | `${N}#${string}`
    : H extends 'main'
      ? N
      : `${N}#${H}`
  : never

export type $TypeOf<O extends { $type?: string }> = NonNullable<O['$type']>

/*@__NO_SIDE_EFFECTS__*/
export function $type<N extends NsidString, H extends string>(
  nsid: N,
  hash: H,
): $Type<N, H> {
  return (hash === 'main' ? nsid : `${nsid}#${hash}`) as $Type<N, H>
}
