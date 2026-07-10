// Directional embedding/override/isolate characters. These can make text
// render in an order different from its logical character order, the
// mechanism behind the "Trojan Source" disclosure (CVE-2021-42574) and the
// class of bug reported in bluesky-social/atproto#1480, where a display
// name containing one of these characters made notification text render in
// a confusing or reversed direction for other users.
//
// Single-character directional *marks* (U+200E LRM, U+200F RLM, U+061C ALM)
// are intentionally excluded: they have no reordering power on their own,
// and real Arabic/Hebrew text can legitimately contain them.
const BIDI_CONTROL_CHARS = /[\u202A-\u202E\u2066-\u2069]/
const BIDI_CONTROL_CHARS_G = /[\u202A-\u202E\u2066-\u2069]/g

export function hasBidiControls(input: string): boolean {
  return BIDI_CONTROL_CHARS.test(input)
}

export function stripBidiControls(input: string): string {
  return input.replace(BIDI_CONTROL_CHARS_G, '')
}
