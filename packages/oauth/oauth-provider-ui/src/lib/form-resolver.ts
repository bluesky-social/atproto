import { zodResolver } from '@hookform/resolvers/zod'
import type { FieldValues, Resolver } from 'react-hook-form'
import type { ZodType, ZodTypeDef } from 'zod'

/**
 * `zodResolver` with its return type stated rather than inferred.
 *
 * @NOTE This exists to keep the type-checker from falling over, not for
 * convenience. Calling `zodResolver(someSchema)` directly makes the compiler
 * instantiate its conditional types against each concrete schema, and with a
 * dozen forms that crossed tsgo's instantiation limit: every `useForm` call
 * reported `TS2589: Type instantiation is excessively deep and possibly
 * infinite`, the resolver degenerated to `never`, and the errors cascaded
 * through `setValue`, `getValues` and `watch` in each form.
 *
 * It crossed that limit *only on the linux-x64 tsgo binary* — CI failed while
 * the same commit type-checked clean on darwin-arm64, because TS2589 is a
 * threshold and the forms sat right on it. So a local `tsgo --build` passing
 * proves nothing here.
 *
 * Instantiating those generics even *once* is too expensive, so this erases
 * `zodResolver`'s signature before calling it rather than calling it
 * generically. The schema's output type still has to match `Values` through
 * this function's own parameter, so a schema that disagrees with the form's
 * value type is still an error.
 */
const applyZodResolver = zodResolver as unknown as (
  schema: unknown,
) => Resolver<FieldValues>

export function schemaResolver<Values extends FieldValues>(
  schema: ZodType<Values, ZodTypeDef, unknown>,
): Resolver<Values> {
  return applyZodResolver(schema) as unknown as Resolver<Values>
}
