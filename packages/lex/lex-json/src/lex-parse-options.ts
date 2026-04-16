/**
 * Options for parsing JSON to Lex values.
 */
export type LexParseOptions = {
  /**
   * When enabled, forbids the presence of invalid Lex values such as:
   * - Non-integer numbers (only safe integers are valid in the Lex data model)
   * - Malformed `$link` objects
   * - Malformed `$bytes` objects
   * - Objects with invalid or empty `$type` properties
   * - Invalid {@link BlobRef} (`$type: 'blob'`) objects
   *
   * When disabled (default), invalid special objects are left as plain objects.
   *
   * @default false
   */
  strict?: boolean
}
