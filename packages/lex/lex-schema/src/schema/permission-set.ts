import { NsidString } from '../core.js'
import { Permission } from './permission.js'

export type PermissionSetOptions = {
  title?: string
  'title:lang'?: Record<string, undefined | string>
  detail?: string
  'detail:lang'?: Record<string, undefined | string>
}

export class PermissionSet<
  const TNsid extends NsidString = any,
  const TPermissions extends readonly Permission[] = any,
> {
  constructor(
    readonly nsid: TNsid,
    readonly permissions: TPermissions,
    readonly options: PermissionSetOptions = {},
  ) {}
}

/*@__NO_SIDE_EFFECTS__*/
export function permissionSet<
  const N extends NsidString,
  const P extends readonly Permission[],
>(nsid: N, permissions: P, options?: PermissionSetOptions) {
  return new PermissionSet<N, P>(nsid, permissions, options)
}
