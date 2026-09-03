# Design principles

What this fork's OAuth redesign settled on, so the next screen matches the
last one without re-deciding anything. Values are the ones in the code; when
the code and this file disagree, fix one of them.

## The card is the product

Every auth screen is one card on the branded background: logo, heading, at
most one line of copy, the content, an action stack, the footer. Nothing else.
If a screen needs a paragraph to explain itself, the screen is wrong, not the
paragraph.

- Card: 26rem cap, 24px inner padding, 16px page gutter on phones. The
  consent card alone is 28rem so its scope rows and terms line fit.
- Logo stands alone, 36px, no wordmark beside it. The service name is the
  image's alt text.
- Heading: 24px semibold, balanced. When a break matters, put `\n` in the
  message and let translators place theirs.
- The subtitle is the only sentence. It says what to do here, not why.

## One size for things you tap

- Action buttons: 40px tall, 15px text, full width, stacked with 8px between
  them. Primary first, then secondary. `actionButton` in `form-shell.tsx` is
  the single source.
- Text inputs: 44px tall, 16px text at every breakpoint. 16px is also what
  stops iOS zooming into a focused field. `inputSize` in `text-field.tsx`.
- The language pill matches the buttons: 40px.
- Anything that looks like a row you can tap uses the picker row: 48px
  media, 18px semibold title, 16px muted value underneath, muted chevron,
  outlined with a faint fill. `accountRowClassName` and friends in
  `account-card.tsx`. Icons sit in a 48px disc with the same hairline ring
  as an avatar, and fill it the way the avatar's placeholder glyph does.

## Say less

- Cut any sentence that restates the heading, the button, or something the
  person just did. "Enter your username and password" under "Sign in" is
  three words of information the fields already carry.
- Placeholders do the instructing: `yourname.example.com`, `Enter your
password`.
- Legal and safety lines are one sentence, muted, 14px: "Only enter your
  password on sites you trust." "Subject to the app's terms of service and
  privacy policy."
- Name the account once per screen. On consent it lives under the heading;
  the client card just says who is asking.
- Name apps by their domain. The full client id belongs in the details
  dialog.
- Don't say "Please try again" when there is a Try again button.

## Errors and notices are lines, not boxes

- A form error is one line in the error colour with a 16px icon, using the
  same 12px gap as the checkbox row so the copy shares its left edge.
- The error page and the cookie page are ordinary cards: heading, the
  message as the subtitle, a small mono line for the code, Try again and
  Go back. No red discs, no filled panels.
- Something that needs an action gets a row with the button in it, not an
  alert with a button bolted on: "Email not verified — Verify".

## Alignment beats decoration

- Lines under the fields (reminder, error, checkbox) share one left edge.
  If one has an icon, they all get the same icon slot, even when the icon
  is absent.
- A row's helper text sits 12px below its input.
- The footer is the quietest thing on the card: language pill, then Home ·
  Terms · Privacy · Support in one 16px line. Labels come from the link's
  role, not its configured title, so they stay one word each.

## Icons carry meaning, not mood

- No icon inside inputs unless it disambiguates (the `@` on username, the
  envelope on email). Password and code fields have none.
- Deactivate is a moon, reactivate a sun: asleep and awake, reversible.
  Delete is the only trash can.
- The deactivated badge is grey. A paused account is not a fault.
- The show/hide password toggle is 16px.

## Translate as you go

Every string added or changed ships with all six other locales in the same
commit, in the register that locale already uses (formal in Romanian,
informal in Spanish). A `\n` or a placeholder in the source is copied into
each translation by hand. Never leave `msgstr ""` behind.

## Keep the contract

Field `name`s (`username`, `password`, `remember`, `code`, `email`,
`newEmail`, `handle`, `domain`, `inviteCode`), the heading tags and the
"real `<button>`" rule from `CLAUDE.md` are load-bearing for the PDS
end-to-end tests. Restyle around them, never through them.

## How we check

`pnpm dev:ui` against the mock, one commit per change, headless captures of
every reachable state at 390×844 dark and light plus 1280×800, published to a
gallery after each change. If a state can't be reached in the mock, extend
the mock rather than skipping the state.
