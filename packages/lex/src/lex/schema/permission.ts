import { LexParameterValue } from './_parameters.js'

export type LexPermissionOptions = Record<string, LexParameterValue>

export class LexPermission<
  const Resource extends string = any,
  const Options extends LexPermissionOptions = any,
> {
  constructor(
    readonly $resource: Resource,
    readonly $options: Options,
  ) {}
}
