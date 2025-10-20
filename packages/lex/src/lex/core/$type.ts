export type $Type<
  Nsid extends string,
  Hash extends string,
> = Hash extends 'main' ? Nsid : `${Nsid}#${Hash}`

export function $type<Nsid extends string, Hash extends string>(
  nsid: Nsid,
  hash: Hash,
): $Type<Nsid, Hash> {
  return (hash === 'main' ? nsid : `${nsid}#${hash}`) as $Type<Nsid, Hash>
}
