import { Params } from './params.js'

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

/*@__NO_SIDE_EFFECTS__*/
export function permission<
  const R extends string,
  const O extends PermissionOptions,
>(resource: R, options: PermissionOptions & O = {} as O) {
  return new Permission<R, O>(resource, options)
}
