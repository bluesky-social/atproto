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
