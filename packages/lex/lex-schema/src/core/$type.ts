import { Nsid } from './string-format.js'

export type $Type<
  N extends Nsid = Nsid,
  H extends string = string,
> = N extends Nsid
  ? string extends H
    ? N | `${N}#${string}`
    : H extends 'main'
      ? N
      : `${N}#${H}`
  : never

export function $type<N extends Nsid, H extends string>(
  nsid: N,
  hash: H,
): $Type<N, H> {
  return (hash === 'main' ? nsid : `${nsid}#${hash}`) as $Type<N, H>
}
