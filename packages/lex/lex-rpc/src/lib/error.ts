export function* walkErrorCauses(
  error: unknown,
): Generator<Error, void, unknown> {
  let current: unknown = error
  for (let depth = 0; depth < 8 && current instanceof Error; depth++) {
    yield current
    current = current.cause
  }
}
