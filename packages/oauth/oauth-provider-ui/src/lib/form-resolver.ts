import { zodResolver } from '@hookform/resolvers/zod'
import type { FieldValues, Resolver } from 'react-hook-form'
import type { ZodType, ZodTypeDef } from 'zod'

/**
 * `zodResolver` with its return type stated rather than inferred.
 *
 * @NOTE This exists to keep the type-checker from falling over, not for
 * convenience. Calling `zodResolver(someSchema)` directly made every `useForm`
 * call report `TS2589: Type instantiation is excessively deep and possibly
 * infinite`; the resolver then degenerated to `never` and the errors cascaded
 * through `setValue`, `getValues` and `watch` in all twelve forms.
 *
 * Casting `zodResolver` to a non-generic signature before calling it means the
 * compiler never relates its conditional types to a concrete schema, which is
 * what avoids the error. Type safety is preserved by this function's own
 * parameter: the schema's output must still match `Values`.
 *
 * Two things worth knowing before touching this:
 *
 * - It reproduces *only on the linux-x64 tsgo binary*. The same commit
 *   type-checks clean on darwin-arm64, including a root `tsgo --build --force`.
 *   A local build passing proves nothing; CI is the check that matters.
 * - It is not about instantiation volume. Measured with
 *   `--extendedDiagnostics`, a direct `zodResolver` call at a call site costs
 *   ~1.1178M instantiations against ~1.1182M for this helper — marginally
 *   *cheaper*. TS2589 is a recursion-depth limit within a single type
 *   relationship, not a budget on the total.
 */
const applyZodResolver = zodResolver as unknown as (
  schema: unknown,
) => Resolver<FieldValues>

export function schemaResolver<Values extends FieldValues>(
  schema: ZodType<Values, ZodTypeDef, unknown>,
): Resolver<Values> {
  return applyZodResolver(schema) as unknown as Resolver<Values>
}
