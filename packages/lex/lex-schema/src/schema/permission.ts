import { Params } from './_parameters.js'

export type PermissionOptions = Params

export class Permission<
  const TResource extends string = any,
  const TOptions extends PermissionOptions = any,
> {
  constructor(
    readonly resource: TResource,
    readonly options: TOptions,
  ) {}
}
