# OAuth Provider UI — Phase 0 & 1: Foundation and Shell — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the shadcn/ui design system inside `packages/oauth/oauth-provider-ui` and rebuild the application shell on it, without changing a single user-visible string or breaking the existing UI.

**Architecture:** Phase 0 is purely additive — shadcn tokens, `cn()`, and `components/ui/*` land alongside the existing token scale and component tree, so nothing regresses. Phase 1 then rebuilds the shell (app chrome, account-manager sidebar, notifications, shared identity/alert/card vocabulary) and switches the four entry pages onto it, while the old feature components continue to render inside the new shell using the legacy tokens that remain in place until Phase 4.

**Tech Stack:** React 19, TypeScript (`tsgo`), Vite 6, Tailwind CSS 4, shadcn/ui (hand-authored, new-york style, neutral base), Radix UI primitives, react-hook-form + zod, Lucide icons, Sonner, Lingui, TanStack Router, Vitest.

**Spec:** [`docs/superpowers/specs/2026-07-27-oauth-provider-ui-shadcn-redesign-design.md`](../specs/2026-07-27-oauth-provider-ui-shadcn-redesign-design.md)

**Scope of this plan:** Phases 0 and 1 only. Phases 2 (authorize flow), 3 (account manager), and 4 (close-out) each get their own plan, written once their predecessor lands.

## Global Constraints

These apply to **every task**. Re-read before starting any task.

- **No user-visible string may change.** Lingui uses source text as `msgid`. Not punctuation, not capitalization, not whitespace inside a `<Trans>` body.
- **No JSX restructuring inside a `<Trans>` body.** Placeholders are positional (`<0>`, `<1>`). Adding, removing, or reordering a child element renumbers them and orphans the translation in es/fr/ja/ko/sv. When a `<Trans>` needs different styling, style the element the macro already wraps.
- **`msg({ message, context })` must keep its `context` value** — it is part of the catalog key. Same for `<Trans context="…">`.
- **Preserve e2e-visible DOM contracts:** `name` attributes on inputs; real `<button>` elements for anything clicked; body copy inside `<p>`; `aria-label`s; `document.title` renders.
- **All new dependencies go in `devDependencies`.** Vite bundles them; the published package must gain no runtime dependency.
- **Do not modify** `packages/oauth/oauth-provider/src/customization/build-customization-css.ts` or the `CustomizationData` contract.
- **Do not delete the legacy token scale** in `src/style.css` during phases 0–3. Old components depend on `text-text-default`, `text-text-light`, `bg-contrast-*`, `border-contrast-*`, `bg-primary-*`, `border-error-*`, etc.
- **Path alias is `#/`, not `@/`.** Every shadcn source you adapt imports from `@/lib/utils` — rewrite to `#/lib/utils.ts`. Extensions are required on relative and `#/` imports (`.tsx` / `.ts`).
- **Icons come from `lucide-react`.** Phosphor imports are removed as each consumer migrates.
- **Formatting is not negotiable.** Prettier's Tailwind plugin reorders class strings; accept its order. Run `pnpm exec prettier --write <paths>` and `pnpm exec eslint --fix <paths>` on touched files before committing.
- **ESLint requires unused vars/args to match `/^_/u`.** Drop the destructure rather than prefixing.
- **Verification command** (from `packages/oauth/oauth-provider-ui`): `pnpm exec tsgo --build tsconfig.json`. Tests: `pnpm test`.
- **Commit after every task.** Conventional-commit style, no co-author trailer unless the repo's other commits use one.

---

## File Structure

### Phase 0 — created

| File                      | Responsibility                                                                                   |
| ------------------------- | ------------------------------------------------------------------------------------------------ |
| `components.json`         | shadcn CLI config; records style/base/aliases so future `shadcn add` output lands correctly      |
| `src/lib/utils.ts`        | `cn()` — `twMerge(clsx(...))`. Nothing else.                                                     |
| `src/lib/utils.test.ts`   | Unit tests for `cn()` conflict resolution                                                        |
| `src/lib/theme.test.ts`   | Guards that `style.css` declares every shadcn token in both schemes and retains the legacy scale |
| `src/components/ui/*.tsx` | shadcn primitives, one component family per file                                                 |

### Phase 0 — modified

| File            | Change                                                                        |
| --------------- | ----------------------------------------------------------------------------- |
| `package.json`  | New `devDependencies`                                                         |
| `src/style.css` | shadcn `@theme inline` + `:root` token block appended; legacy scale untouched |

### Phase 1 — created

| File                                             | Responsibility                                                                   |
| ------------------------------------------------ | -------------------------------------------------------------------------------- |
| `src/components/layouts/app-shell.tsx`           | Outer chrome: header (logo/name), content slot, footer (locale selector + links) |
| `src/components/layouts/account-shell.tsx`       | Account-manager frame: sidebar nav + content region                              |
| `src/components/identity/account-avatar.tsx`     | Account image on `ui/avatar`                                                     |
| `src/components/identity/account-name.tsx`       | Display-name / handle / DID resolution for an account                            |
| `src/components/identity/account-identifier.tsx` | Handle-or-DID identifier line                                                    |
| `src/components/identity/account-summary.tsx`    | Avatar + name + identifier row                                                   |
| `src/components/identity/account-menu.tsx`       | Account switcher on `ui/dropdown-menu`                                           |
| `src/components/identity/client-avatar.tsx`      | OAuth client image on `ui/avatar`                                                |
| `src/components/identity/client-name.tsx`        | OAuth client display name                                                        |
| `src/components/feedback/notice.tsx`             | Replaces `utils/admonition.tsx`; `ui/alert` variants                             |
| `src/components/feedback/error-notice.tsx`       | Replaces `utils/error-card.tsx`; destructive `ui/alert`                          |
| `src/components/feedback/error-details.tsx`      | Collapsible technical error detail                                               |
| `src/lib/notification-message.ts`                | Pure: `unknown` error → `{ title, description }` for toasts                      |
| `src/lib/notification-message.test.ts`           | Unit tests for the above                                                         |

### Phase 1 — modified

| File                                                      | Change                                         |
| --------------------------------------------------------- | ---------------------------------------------- |
| `src/contexts/notifications.tsx`                          | Same exported API, Sonner underneath           |
| `src/locales/locale-selector.tsx`                         | Rebuilt on `ui/select`                         |
| `src/pages/account/(authenticated)/route.tsx`             | Renders `AccountShell` instead of `LayoutPage` |
| `src/pages/router.tsx`                                    | Drops the `/branding` palette demo route       |
| `src/{authorization,account,error,cookie-error}-page.tsx` | Mount `<Toaster />`; use `AppShell`            |

### Phase 1 — deleted

`src/components/layouts/layout-app.tsx`, `layout-page.tsx`, `layout-title.tsx`, `src/components/utils/palette.tsx`, `account-image.tsx`, `account-name.tsx`, `account-identifier.tsx`, `account-overview.tsx`, `account-selector.tsx`, `client-image.tsx`, `client-name.tsx`, `admonition.tsx`, `error-card.tsx`, `error-details.tsx`, `src/hooks/use-click-outside.ts`, `use-escape-key.ts`, `use-merged-refs.ts`.

---

# PHASE 0 — FOUNDATION

### Task 0: Capture the e2e baseline

Nothing in this plan is safe to attribute without this. Do it first, commit the record.

**Files:**

- Create: `docs/superpowers/plans/2026-07-27-e2e-baseline.md`

- [ ] **Step 1: Free the dev-env ports**

The local `switchback` docker stack squats on 2582/2583, which `dev-env` needs.

```bash
docker ps --format '{{.Names}}\t{{.Ports}}' | grep -E '258[23]' || echo "ports free"
```

If anything is listed, stop that stack before continuing.

- [ ] **Step 2: Run the two suites and capture output**

```bash
cd packages/pds
pnpm test -- tests/oauth.test.ts 2>&1 | tee /tmp/baseline-oauth.txt
pnpm test -- tests/account-manager.test.ts 2>&1 | tee /tmp/baseline-account-manager.txt
```

Expected: both suites run to completion. Record pass/fail counts and the name of every failing test.

- [ ] **Step 3: Write the baseline record**

Create `docs/superpowers/plans/2026-07-27-e2e-baseline.md` containing, verbatim:

```markdown
# e2e baseline — before oauth-provider-ui redesign

Captured on branch `oauth-provider-redesign` at commit <SHA>.

## packages/pds/tests/oauth.test.ts

<paste the summary line: "Tests: N passed, M failed, X total">

Failing before any redesign work:

- <test name> (or "none")

## packages/pds/tests/account-manager.test.ts

<paste the summary line>

Failing before any redesign work:

- <test name> (or "none")
```

Replace `<SHA>` with `git rev-parse --short HEAD`. Paste real output — do not summarize from memory.

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/plans/2026-07-27-e2e-baseline.md
git commit -m "docs: record e2e baseline before oauth-provider-ui redesign"
```

---

### Task 1: Add dependencies and shadcn config

**Files:**

- Modify: `packages/oauth/oauth-provider-ui/package.json`
- Create: `packages/oauth/oauth-provider-ui/components.json`

**Interfaces:**

- Produces: the dependency set every later task imports from.

- [ ] **Step 1: Add the devDependencies**

From `packages/oauth/oauth-provider-ui`:

```bash
pnpm add -D class-variance-authority tailwind-merge lucide-react react-hook-form @hookform/resolvers sonner tw-animate-css \
  @radix-ui/react-slot @radix-ui/react-label @radix-ui/react-checkbox @radix-ui/react-radio-group \
  @radix-ui/react-select @radix-ui/react-dropdown-menu @radix-ui/react-separator @radix-ui/react-progress \
  @radix-ui/react-avatar @radix-ui/react-tooltip
```

Do **not** remove `@radix-ui/react-toast` or `@phosphor-icons/react` yet — old components still import them. They go in Phase 1 and Phase 4 respectively.

- [ ] **Step 2: Verify the install and the zod version**

```bash
pnpm ls zod @hookform/resolvers react-hook-form
```

Expected: `zod` resolves to a 3.24+ version. `@hookform/resolvers` v5 supports zod 3.24+; if pnpm installed a resolver version that demands zod 4, pin `@hookform/resolvers@^3.10.0` instead and re-run.

- [ ] **Step 3: Create `components.json`**

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",
  "rsc": false,
  "tsx": true,
  "tailwind": {
    "config": "",
    "css": "src/style.css",
    "baseColor": "neutral",
    "cssVariables": true,
    "prefix": ""
  },
  "iconLibrary": "lucide",
  "aliases": {
    "components": "#/components",
    "utils": "#/lib/utils.ts",
    "ui": "#/components/ui",
    "lib": "#/lib",
    "hooks": "#/hooks"
  }
}
```

`tailwind.config` is empty because Tailwind 4 is configured entirely from CSS.

- [ ] **Step 4: Verify the build still passes**

```bash
pnpm exec tsgo --build tsconfig.json
```

Expected: PASS. No source changed yet, so this only proves the dependency install did not break resolution.

- [ ] **Step 5: Commit**

```bash
git add package.json components.json ../../../pnpm-lock.yaml
git commit -m "build(oauth-provider-ui): add shadcn/ui dependencies and config"
```

---

### Task 2: Add `cn()`

**Files:**

- Create: `packages/oauth/oauth-provider-ui/src/lib/utils.ts`
- Test: `packages/oauth/oauth-provider-ui/src/lib/utils.test.ts`

**Interfaces:**

- Produces: `cn(...inputs: ClassValue[]): string` — every `components/ui/*` file imports this.

Note: `src/lib/util.ts` (singular, existing) is a different file holding `Override`, `sleep`, etc. Do not merge them; `utils.ts` (plural) is the shadcn convention and `components.json` points at it.

- [ ] **Step 1: Write the failing test**

Create `src/lib/utils.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { cn } from './utils.ts'

describe(cn, () => {
  it('joins plain class names', () => {
    expect(cn('a', 'b')).toBe('a b')
  })

  it('drops falsy values', () => {
    expect(cn('a', false, undefined, null, 'b')).toBe('a b')
  })

  it('resolves conflicting tailwind utilities in favor of the last one', () => {
    expect(cn('px-2', 'px-4')).toBe('px-4')
  })

  it('keeps non-conflicting tailwind utilities', () => {
    expect(cn('px-2', 'py-4')).toBe('px-2 py-4')
  })

  it('supports conditional object syntax', () => {
    expect(cn('base', { active: true, hidden: false })).toBe('base active')
  })

  it('resolves conflicts across variant prefixes independently', () => {
    expect(cn('hover:bg-red-500', 'bg-blue-500')).toBe(
      'hover:bg-red-500 bg-blue-500',
    )
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd packages/oauth/oauth-provider-ui
pnpm test -- src/lib/utils.test.ts
```

Expected: FAIL — cannot resolve `./utils.ts`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/utils.ts`:

```ts
import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
pnpm test -- src/lib/utils.test.ts
```

Expected: PASS, 6 tests.

- [ ] **Step 5: Type-check and commit**

```bash
pnpm exec tsgo --build tsconfig.json
pnpm exec prettier --write src/lib/utils.ts src/lib/utils.test.ts
git add src/lib/utils.ts src/lib/utils.test.ts
git commit -m "feat(oauth-provider-ui): add cn() class-merge helper"
```

---

### Task 3: Add the shadcn token block to `style.css`

**Files:**

- Modify: `packages/oauth/oauth-provider-ui/src/style.css`
- Test: `packages/oauth/oauth-provider-ui/src/lib/theme.test.ts`

**Interfaces:**

- Produces: the CSS custom properties `--background`, `--foreground`, `--card`, `--card-foreground`, `--popover`, `--popover-foreground`, `--primary`, `--primary-foreground`, `--secondary`, `--secondary-foreground`, `--muted`, `--muted-foreground`, `--accent`, `--accent-foreground`, `--destructive`, `--border`, `--input`, `--ring`, `--radius`, and the sidebar set `--sidebar`, `--sidebar-foreground`, `--sidebar-primary`, `--sidebar-primary-foreground`, `--sidebar-accent`, `--sidebar-accent-foreground`, `--sidebar-border`, `--sidebar-ring`. Every `components/ui/*` file styles against these.

- [ ] **Step 1: Write the failing test**

This test guards the two things that silently rot: a token declared in light but not dark, and accidental deletion of the legacy scale that phases 1–3 still depend on.

Create `src/lib/theme.test.ts`:

```ts
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const css = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../style.css'),
  'utf8',
)

const SHADCN_TOKENS = [
  'background',
  'foreground',
  'card',
  'card-foreground',
  'popover',
  'popover-foreground',
  'primary',
  'primary-foreground',
  'secondary',
  'secondary-foreground',
  'muted',
  'muted-foreground',
  'accent',
  'accent-foreground',
  'destructive',
  'border',
  'input',
  'ring',
  'sidebar',
  'sidebar-foreground',
  'sidebar-primary',
  'sidebar-primary-foreground',
  'sidebar-accent',
  'sidebar-accent-foreground',
  'sidebar-border',
  'sidebar-ring',
] as const

// Legacy tokens that phases 1-3 still depend on. Removed in phase 4 only.
const LEGACY_TOKENS = [
  '--color-text-default',
  '--color-text-light',
  '--color-contrast-0',
  '--color-contrast-25',
  '--color-primary-500',
  '--color-error-500',
] as const

function blockFor(selector: string): string {
  const start = css.indexOf(selector)
  expect(start, `missing block: ${selector}`).toBeGreaterThan(-1)
  const open = css.indexOf('{', start)
  const close = css.indexOf('\n}', open)
  return css.slice(open, close)
}

describe('style.css theme tokens', () => {
  const light = blockFor('/* shadcn tokens: light */')
  const dark = blockFor('/* shadcn tokens: dark */')

  it.each(SHADCN_TOKENS)('declares --%s in the light scheme', (token) => {
    expect(light).toContain(`--${token}:`)
  })

  it.each(SHADCN_TOKENS)('declares --%s in the dark scheme', (token) => {
    expect(dark).toContain(`--${token}:`)
  })

  it('exposes the tokens to tailwind via @theme inline', () => {
    for (const token of SHADCN_TOKENS) {
      expect(css).toContain(`--color-${token}: var(--${token});`)
    }
  })

  it('declares a radius scale', () => {
    expect(css).toContain('--radius:')
  })

  it('drives dark mode from prefers-color-scheme, not a .dark class', () => {
    expect(css).toContain(
      '@custom-variant dark (@media (prefers-color-scheme: dark));',
    )
  })

  it.each(LEGACY_TOKENS)('still declares the legacy token %s', (token) => {
    expect(css).toContain(token)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
pnpm test -- src/lib/theme.test.ts
```

Expected: FAIL — `missing block: /* shadcn tokens: light */`.

- [ ] **Step 3: Append the shadcn token block**

Add `@import 'tw-animate-css';` directly under the existing `@import 'tailwindcss';` at the top of `src/style.css`, then append the following to the **end** of the file. Do not touch anything already in the file.

```css
/* ---------------------------------------------------------------------------
 * shadcn/ui design tokens (neutral base).
 *
 * These coexist with the legacy --branding-color-* scale above until phase 4,
 * when the legacy block and its consumers are removed. Dark mode is driven by
 * prefers-color-scheme to match the previous behaviour: system-driven, no
 * toggle, no persisted preference.
 * ------------------------------------------------------------------------- */

@custom-variant dark (@media (prefers-color-scheme: dark));

/* shadcn tokens: light */
:root {
  --radius: 0.625rem;

  --background: oklch(1 0 0);
  --foreground: oklch(0.145 0 0);
  --card: oklch(1 0 0);
  --card-foreground: oklch(0.145 0 0);
  --popover: oklch(1 0 0);
  --popover-foreground: oklch(0.145 0 0);
  --primary: oklch(0.205 0 0);
  --primary-foreground: oklch(0.985 0 0);
  --secondary: oklch(0.97 0 0);
  --secondary-foreground: oklch(0.205 0 0);
  --muted: oklch(0.97 0 0);
  --muted-foreground: oklch(0.556 0 0);
  --accent: oklch(0.97 0 0);
  --accent-foreground: oklch(0.205 0 0);
  --destructive: oklch(0.577 0.245 27.325);
  --border: oklch(0.922 0 0);
  --input: oklch(0.922 0 0);
  --ring: oklch(0.708 0 0);

  --sidebar: oklch(0.985 0 0);
  --sidebar-foreground: oklch(0.145 0 0);
  --sidebar-primary: oklch(0.205 0 0);
  --sidebar-primary-foreground: oklch(0.985 0 0);
  --sidebar-accent: oklch(0.97 0 0);
  --sidebar-accent-foreground: oklch(0.205 0 0);
  --sidebar-border: oklch(0.922 0 0);
  --sidebar-ring: oklch(0.708 0 0);
}

@media (prefers-color-scheme: dark) {
  /* shadcn tokens: dark */
  :root {
    --background: oklch(0.145 0 0);
    --foreground: oklch(0.985 0 0);
    --card: oklch(0.205 0 0);
    --card-foreground: oklch(0.985 0 0);
    --popover: oklch(0.205 0 0);
    --popover-foreground: oklch(0.985 0 0);
    --primary: oklch(0.922 0 0);
    --primary-foreground: oklch(0.205 0 0);
    --secondary: oklch(0.269 0 0);
    --secondary-foreground: oklch(0.985 0 0);
    --muted: oklch(0.269 0 0);
    --muted-foreground: oklch(0.708 0 0);
    --accent: oklch(0.269 0 0);
    --accent-foreground: oklch(0.985 0 0);
    --destructive: oklch(0.704 0.191 22.216);
    --border: oklch(1 0 0 / 10%);
    --input: oklch(1 0 0 / 15%);
    --ring: oklch(0.556 0 0);

    --sidebar: oklch(0.205 0 0);
    --sidebar-foreground: oklch(0.985 0 0);
    --sidebar-primary: oklch(0.488 0.243 264.376);
    --sidebar-primary-foreground: oklch(0.985 0 0);
    --sidebar-accent: oklch(0.269 0 0);
    --sidebar-accent-foreground: oklch(0.985 0 0);
    --sidebar-border: oklch(1 0 0 / 10%);
    --sidebar-ring: oklch(0.556 0 0);
  }
}

@theme inline {
  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 4px);

  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);

  --color-sidebar: var(--sidebar);
  --color-sidebar-foreground: var(--sidebar-foreground);
  --color-sidebar-primary: var(--sidebar-primary);
  --color-sidebar-primary-foreground: var(--sidebar-primary-foreground);
  --color-sidebar-accent: var(--sidebar-accent);
  --color-sidebar-accent-foreground: var(--sidebar-accent-foreground);
  --color-sidebar-border: var(--sidebar-border);
  --color-sidebar-ring: var(--sidebar-ring);
}

@layer base {
  * {
    @apply border-border outline-ring/50;
  }
}
```

**Conflict warning:** the legacy block already defines `--color-primary` (as `rgb(var(--branding-color-primary))`) in `:root`. The new `--color-primary: var(--primary)` lives inside `@theme inline`, which is where Tailwind reads utility definitions from — the later `@theme inline` declaration wins for class generation. After this step, `bg-primary` resolves to the neutral shadcn value, not the branding purple. That is intended and is why Phase 1 migrates the shell first. If any _legacy_ component looks wrong because of this specifically, note it and move on; it is resolved as that component migrates.

- [ ] **Step 4: Run the test to verify it passes**

```bash
pnpm test -- src/lib/theme.test.ts
```

Expected: PASS.

- [ ] **Step 5: Verify Tailwind compiles the new tokens**

```bash
pnpm run build:ui
```

Expected: build succeeds. Then confirm the tokens made it into the output:

```bash
grep -c 'bg-background\|--color-background' dist/*.css
```

Expected: at least one match.

- [ ] **Step 6: Commit**

```bash
pnpm exec prettier --write src/style.css src/lib/theme.test.ts
git add src/style.css src/lib/theme.test.ts
git commit -m "feat(oauth-provider-ui): add shadcn design tokens alongside legacy scale"
```

---

### Task 4: Author the core `ui/*` primitives

shadcn's CLI cannot be used here — it assumes an `@/` alias and a `tailwind.config.js`, and this package has neither. Author the files directly, adapting the published new-york sources: swap `@/lib/utils` → `#/lib/utils.ts` and add explicit file extensions to relative imports.

**Files:**

- Create: `src/components/ui/button.tsx`, `input.tsx`, `label.tsx`, `card.tsx`, `alert.tsx`, `separator.tsx`, `skeleton.tsx`, `badge.tsx`

**Interfaces:**

- Produces:

  - `Button` — props `Override<JSX.IntrinsicElements['button'], { variant?: 'default'|'destructive'|'outline'|'secondary'|'ghost'|'link'; size?: 'default'|'sm'|'lg'|'icon'; asChild?: boolean }>`; also exports `buttonVariants`.
  - `Input` — `JSX.IntrinsicElements['input']`, forwards every prop including `name`, `value`, `defaultValue`.
  - `Label` — Radix `Label` wrapper.
  - `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardAction`, `CardContent`, `CardFooter`.
  - `Alert`, `AlertTitle`, `AlertDescription`; `alertVariants` with `variant?: 'default'|'destructive'`.
  - `Separator`, `Skeleton`, `Badge` + `badgeVariants`.

- [ ] **Step 1: Create `src/components/ui/button.tsx`**

```tsx
import { Slot } from '@radix-ui/react-slot'
import { type VariantProps, cva } from 'class-variance-authority'
import type * as React from 'react'
import { cn } from '#/lib/utils.ts'

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        default:
          'bg-primary text-primary-foreground shadow-xs hover:bg-primary/90',
        destructive:
          'bg-destructive text-white shadow-xs hover:bg-destructive/90 focus-visible:ring-destructive/20',
        outline:
          'border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground',
        secondary:
          'bg-secondary text-secondary-foreground shadow-xs hover:bg-secondary/80',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-9 px-4 py-2 has-[>svg]:px-3',
        sm: 'h-8 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5',
        lg: 'h-10 rounded-md px-6 has-[>svg]:px-4',
        icon: 'size-9',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : 'button'

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
```

- [ ] **Step 2: Create `src/components/ui/input.tsx` and `label.tsx`**

`input.tsx` — note it spreads all props, so `name`, `value`, and `defaultValue` pass straight through. This is required by the e2e `typeInInput(name, …)` helper and by the "never force controlled/uncontrolled" rule.

```tsx
import type * as React from 'react'
import { cn } from '#/lib/utils.ts'

function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        'file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground border-input shadow-xs flex h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base outline-none transition-[color,box-shadow] file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
        'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
        'aria-invalid:ring-destructive/20 aria-invalid:border-destructive',
        className,
      )}
      {...props}
    />
  )
}

export { Input }
```

`label.tsx`:

```tsx
import * as LabelPrimitive from '@radix-ui/react-label'
import type * as React from 'react'
import { cn } from '#/lib/utils.ts'

function Label({
  className,
  ...props
}: React.ComponentProps<typeof LabelPrimitive.Root>) {
  return (
    <LabelPrimitive.Root
      data-slot="label"
      className={cn(
        'flex select-none items-center gap-2 text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-50 group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50',
        className,
      )}
      {...props}
    />
  )
}

export { Label }
```

- [ ] **Step 3: Create `src/components/ui/card.tsx`**

`CardDescription` renders a `<p>` — this is what satisfies the e2e `ensureTextVisibility(text, 'p')` helper. Do not change it to a `<div>`.

```tsx
import type * as React from 'react'
import { cn } from '#/lib/utils.ts'

function Card({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card"
      className={cn(
        'bg-card text-card-foreground flex flex-col gap-6 rounded-xl border py-6 shadow-sm',
        className,
      )}
      {...props}
    />
  )
}

function CardHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        '@container/card-header has-data-[slot=card-action]:grid-cols-[1fr_auto] [.border-b]:pb-6 grid auto-rows-min grid-rows-[auto_auto] items-start gap-1.5 px-6',
        className,
      )}
      {...props}
    />
  )
}

function CardTitle({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-title"
      className={cn('font-semibold leading-none', className)}
      {...props}
    />
  )
}

function CardDescription({ className, ...props }: React.ComponentProps<'p'>) {
  return (
    <p
      data-slot="card-description"
      className={cn('text-muted-foreground text-sm', className)}
      {...props}
    />
  )
}

function CardAction({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-action"
      className={cn(
        'col-start-2 row-span-2 row-start-1 self-start justify-self-end',
        className,
      )}
      {...props}
    />
  )
}

function CardContent({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-content"
      className={cn('px-6', className)}
      {...props}
    />
  )
}

function CardFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-footer"
      className={cn('[.border-t]:pt-6 flex items-center px-6', className)}
      {...props}
    />
  )
}

export {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
}
```

- [ ] **Step 4: Create `src/components/ui/alert.tsx`**

`AlertDescription` also renders a `<p>` wrapper for the same e2e reason.

```tsx
import { type VariantProps, cva } from 'class-variance-authority'
import type * as React from 'react'
import { cn } from '#/lib/utils.ts'

const alertVariants = cva(
  'relative w-full rounded-lg border px-4 py-3 text-sm grid has-[>svg]:grid-cols-[calc(var(--spacing)*4)_1fr] grid-cols-[0_1fr] has-[>svg]:gap-x-3 gap-y-0.5 items-start [&>svg]:size-4 [&>svg]:translate-y-0.5 [&>svg]:text-current',
  {
    variants: {
      variant: {
        default: 'bg-card text-card-foreground',
        destructive:
          'text-destructive bg-card [&>svg]:text-current *:data-[slot=alert-description]:text-destructive/90',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)

function Alert({
  className,
  variant,
  ...props
}: React.ComponentProps<'div'> & VariantProps<typeof alertVariants>) {
  return (
    <div
      data-slot="alert"
      role="alert"
      className={cn(alertVariants({ variant }), className)}
      {...props}
    />
  )
}

function AlertTitle({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="alert-title"
      className={cn(
        'col-start-2 line-clamp-1 min-h-4 font-medium tracking-tight',
        className,
      )}
      {...props}
    />
  )
}

function AlertDescription({ className, ...props }: React.ComponentProps<'p'>) {
  return (
    <p
      data-slot="alert-description"
      className={cn(
        'text-muted-foreground col-start-2 grid justify-items-start gap-1 text-sm [&_p]:leading-relaxed',
        className,
      )}
      {...props}
    />
  )
}

export { Alert, AlertDescription, AlertTitle, alertVariants }
```

- [ ] **Step 5: Create `separator.tsx`, `skeleton.tsx`, `badge.tsx`**

```tsx
// src/components/ui/separator.tsx
import * as SeparatorPrimitive from '@radix-ui/react-separator'
import type * as React from 'react'
import { cn } from '#/lib/utils.ts'

function Separator({
  className,
  orientation = 'horizontal',
  decorative = true,
  ...props
}: React.ComponentProps<typeof SeparatorPrimitive.Root>) {
  return (
    <SeparatorPrimitive.Root
      data-slot="separator"
      decorative={decorative}
      orientation={orientation}
      className={cn(
        'bg-border shrink-0 data-[orientation=horizontal]:h-px data-[orientation=vertical]:h-full data-[orientation=horizontal]:w-full data-[orientation=vertical]:w-px',
        className,
      )}
      {...props}
    />
  )
}

export { Separator }
```

```tsx
// src/components/ui/skeleton.tsx
import type * as React from 'react'
import { cn } from '#/lib/utils.ts'

function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="skeleton"
      className={cn('bg-accent animate-pulse rounded-md', className)}
      {...props}
    />
  )
}

export { Skeleton }
```

```tsx
// src/components/ui/badge.tsx
import { Slot } from '@radix-ui/react-slot'
import { type VariantProps, cva } from 'class-variance-authority'
import type * as React from 'react'
import { cn } from '#/lib/utils.ts'

const badgeVariants = cva(
  'inline-flex items-center justify-center rounded-md border px-2 py-0.5 text-xs font-medium w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 aria-invalid:border-destructive transition-[color,box-shadow] overflow-hidden',
  {
    variants: {
      variant: {
        default:
          'border-transparent bg-primary text-primary-foreground [a&]:hover:bg-primary/90',
        secondary:
          'border-transparent bg-secondary text-secondary-foreground [a&]:hover:bg-secondary/90',
        destructive:
          'border-transparent bg-destructive text-white [a&]:hover:bg-destructive/90',
        outline: 'text-foreground [a&]:hover:bg-accent',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)

function Badge({
  className,
  variant,
  asChild = false,
  ...props
}: React.ComponentProps<'span'> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : 'span'

  return (
    <Comp
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
```

- [ ] **Step 6: Type-check**

```bash
pnpm exec tsgo --build tsconfig.json
```

Expected: PASS. Nothing imports these yet, so this only proves they compile.

- [ ] **Step 7: Commit**

```bash
pnpm exec prettier --write 'src/components/ui/*.tsx'
pnpm exec eslint --fix 'src/components/ui/*.tsx'
git add src/components/ui
git commit -m "feat(oauth-provider-ui): add core shadcn ui primitives"
```

---

### Task 5: Author the interactive `ui/*` primitives

**Files:**

- Create: `src/components/ui/dialog.tsx`, `dropdown-menu.tsx`, `select.tsx`, `checkbox.tsx`, `radio-group.tsx`, `progress.tsx`, `avatar.tsx`, `tooltip.tsx`, `popover.tsx`, `sheet.tsx`

**Interfaces:**

- Produces the standard shadcn exports, used from Phase 1 onward:

  - `Dialog`, `DialogTrigger`, `DialogContent`, `DialogHeader`, `DialogFooter`, `DialogTitle`, `DialogDescription`, `DialogClose`, `DialogPortal`, `DialogOverlay`
  - `Sheet`, `SheetTrigger`, `SheetContent`, `SheetHeader`, `SheetFooter`, `SheetTitle`, `SheetDescription`, `SheetClose` — required by `account-shell.tsx` for mobile navigation
  - `DropdownMenu`, `DropdownMenuTrigger`, `DropdownMenuContent`, `DropdownMenuItem`, `DropdownMenuSeparator`, `DropdownMenuLabel`, `DropdownMenuGroup`
  - `Select`, `SelectTrigger`, `SelectValue`, `SelectContent`, `SelectItem`, `SelectGroup`, `SelectLabel`
  - `Checkbox`, `RadioGroup`, `RadioGroupItem`, `Progress`
  - `Avatar`, `AvatarImage`, `AvatarFallback`
  - `Tooltip`, `TooltipTrigger`, `TooltipContent`, `TooltipProvider`
  - `Popover`, `PopoverTrigger`, `PopoverContent`, `PopoverAnchor`

- [ ] **Step 1: Author each file from the published new-york source**

For each component listed above, take the shadcn new-york source and apply exactly these three mechanical changes:

1. `import { cn } from '@/lib/utils'` → `import { cn } from '#/lib/utils.ts'`
2. Add explicit extensions to any other internal import (e.g. `from '#/components/ui/button.tsx'`)
3. Icons: `lucide-react` imports stay as-is (`CheckIcon`, `ChevronDownIcon`, `ChevronRightIcon`, `ChevronUpIcon`, `CircleIcon`, `XIcon`, `MinusIcon`)

Keep `data-slot` attributes — later tasks and CSS selectors rely on them.

**`sheet.tsx` is not in the default `dropdown-menu`/`dialog` set** but is required by the sidebar; author it from the shadcn `sheet` source (built on `@radix-ui/react-dialog`, which is already a dependency).

- [ ] **Step 2: Verify no `@/` import survived**

```bash
grep -rn "from '@/" src/components/ui/ || echo "clean"
```

Expected: `clean`.

- [ ] **Step 3: Verify every internal import has an extension**

```bash
grep -rnE "from '(#/|\./|\.\./)[^']*'" src/components/ui/ | grep -vE "\.(tsx|ts|css)'" || echo "clean"
```

Expected: `clean`.

- [ ] **Step 4: Type-check**

```bash
pnpm exec tsgo --build tsconfig.json
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
pnpm exec prettier --write 'src/components/ui/*.tsx'
pnpm exec eslint --fix 'src/components/ui/*.tsx'
git add src/components/ui
git commit -m "feat(oauth-provider-ui): add interactive shadcn ui primitives"
```

---

### Task 6: Author `ui/form.tsx` and `ui/sonner.tsx`

Split from Task 5 because these two carry behavior, not just markup, and a reviewer may reasonably accept the primitives while rejecting the form wiring.

**Files:**

- Create: `src/components/ui/form.tsx`, `src/components/ui/sonner.tsx`

**Interfaces:**

- Produces: `Form` (re-export of `FormProvider`), `FormField`, `FormItem`, `FormLabel`, `FormControl`, `FormDescription`, `FormMessage`, `useFormField`. Phase 2 builds every form on these.
- Produces: `Toaster` — mounted once per entry page in Task 9.

- [ ] **Step 1: Author `src/components/ui/form.tsx`**

Use the shadcn new-york `form.tsx` source with the same three mechanical import changes from Task 5. It depends on `react-hook-form`, `@radix-ui/react-label`, `@radix-ui/react-slot`, and `#/components/ui/label.tsx`.

One deviation required by this codebase: `FormMessage` renders a `<p>`, which is correct for the e2e helper — keep it.

- [ ] **Step 2: Author `src/components/ui/sonner.tsx`**

The published shadcn `sonner.tsx` reads the theme from `next-themes`, which this package does not use. Since dark mode here is system-driven, hand the theme to Sonner as `"system"` and let it follow `prefers-color-scheme`:

```tsx
import { Toaster as Sonner, type ToasterProps } from 'sonner'

function Toaster({ ...props }: ToasterProps) {
  return (
    <Sonner
      theme="system"
      className="toaster group"
      style={
        {
          '--normal-bg': 'var(--popover)',
          '--normal-text': 'var(--popover-foreground)',
          '--normal-border': 'var(--border)',
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }
```

Add `import type * as React from 'react'` at the top.

- [ ] **Step 3: Type-check**

```bash
pnpm exec tsgo --build tsconfig.json
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
pnpm exec prettier --write src/components/ui/form.tsx src/components/ui/sonner.tsx
pnpm exec eslint --fix src/components/ui/form.tsx src/components/ui/sonner.tsx
git add src/components/ui/form.tsx src/components/ui/sonner.tsx
git commit -m "feat(oauth-provider-ui): add shadcn form and sonner primitives"
```

---

### Task 7: Phase 0 checkpoint

**Files:** none — verification only.

- [ ] **Step 1: Full type-check and test run**

```bash
cd packages/oauth/oauth-provider-ui
pnpm exec tsgo --build tsconfig.json
pnpm test
```

Expected: type-check PASS; tests PASS (`location-step`, `utils`, `theme`).

- [ ] **Step 2: Confirm the message catalogs are untouched**

```bash
pnpm i18n
git diff --stat src/locales/
```

Expected: **no changes at all.** Phase 0 added no `<Trans>` and no `t\`\``strings. If any`.po`file shows an added or removed`msgid`, stop and find out why before continuing.

- [ ] **Step 3: Visually confirm nothing regressed**

Boot the dev env and walk the authorize flow and account manager using the `playwright` skill. Phase 0 is additive, so the UI should look **identical to the baseline** except for anything that consumed `bg-primary` / `text-primary` — those now resolve to the neutral shadcn value. Note what changed; do not fix it here.

- [ ] **Step 4: Commit any formatting drift**

```bash
git status --porcelain
```

Expected: clean. If prettier reordered classes, commit that with `style: apply prettier formatting`.

---

# PHASE 1 — SHELL

### Task 8: Error-to-notification mapping

Extract the pure part of the notification logic first so the Sonner swap in Task 9 is a presentation change only.

**Files:**

- Create: `src/lib/notification-message.ts`
- Test: `src/lib/notification-message.test.ts`

**Interfaces:**

- Consumes: `parseError` from `#/lib/error-parser.ts`, `apiErrorParser` from `#/lib/api-error-parser.ts` (both existing, unchanged).
- Produces: `errorToNotification(err: unknown, overrides?: { title?: string | MessageDescriptor; description?: string | MessageDescriptor }): { title: string | MessageDescriptor; description?: string | MessageDescriptor }`

- [ ] **Step 1: Read the current behavior before writing the test**

```bash
sed -n 60,200p src/contexts/notifications.tsx
```

The existing `notifyError` derives title and description from the caught error via `parseError` / `apiErrorParser`. The new function must produce **the same title and description values** for the same inputs — those strings are already in the catalogs and must not change. Copy the existing message descriptors verbatim.

- [ ] **Step 2: Write the failing test**

Create `src/lib/notification-message.test.ts`. Fill the `expected` values from what Step 1 showed — do not invent strings.

```ts
import { describe, expect, it } from 'vitest'
import { errorToNotification } from './notification-message.ts'

describe(errorToNotification, () => {
  it('uses the override title when one is supplied', () => {
    const result = errorToNotification(new Error('boom'), {
      title: 'Custom title',
    })
    expect(result.title).toBe('Custom title')
  })

  it('uses the override description when one is supplied', () => {
    const result = errorToNotification(new Error('boom'), {
      description: 'Custom description',
    })
    expect(result.description).toBe('Custom description')
  })

  it('derives a description from a plain Error message', () => {
    const result = errorToNotification(new Error('Something went wrong'))
    expect(result.description).toBeDefined()
  })

  it('always returns a title', () => {
    expect(errorToNotification(undefined).title).toBeDefined()
    expect(errorToNotification(null).title).toBeDefined()
    expect(errorToNotification('a string').title).toBeDefined()
    expect(errorToNotification({ nope: true }).title).toBeDefined()
  })

  it('does not throw on a circular error object', () => {
    const circular: Record<string, unknown> = { message: 'circular' }
    circular.self = circular
    expect(() => errorToNotification(circular)).not.toThrow()
  })
})
```

- [ ] **Step 3: Run the test to verify it fails**

```bash
pnpm test -- src/lib/notification-message.test.ts
```

Expected: FAIL — cannot resolve `./notification-message.ts`.

- [ ] **Step 4: Implement**

Create `src/lib/notification-message.ts`, moving the error-derivation logic out of `src/contexts/notifications.tsx` verbatim. Keep every `msg\`…\`` descriptor byte-identical to what the context currently uses.

- [ ] **Step 5: Run the test to verify it passes**

```bash
pnpm test -- src/lib/notification-message.test.ts
```

Expected: PASS, 5 tests.

- [ ] **Step 6: Confirm no catalog change**

```bash
pnpm i18n && git diff --stat src/locales/
```

Expected: only line-number reference churn — no added or removed `msgid`. The strings moved files; they did not change.

- [ ] **Step 7: Commit**

```bash
pnpm exec prettier --write src/lib/notification-message.ts src/lib/notification-message.test.ts
git add src/lib/notification-message.ts src/lib/notification-message.test.ts src/locales
git commit -m "refactor(oauth-provider-ui): extract error-to-notification mapping"
```

---

### Task 9: Swap notifications to Sonner

**Files:**

- Modify: `src/contexts/notifications.tsx`
- Modify: `src/authorization-page.tsx`, `src/account-page.tsx`, `src/error-page.tsx`, `src/cookie-error-page.tsx`
- Modify: `package.json`

**Interfaces:**

- Consumes: `Toaster` from `#/components/ui/sonner.tsx`; `errorToNotification` from `#/lib/notification-message.ts`.
- Produces: unchanged public API — `useNotificationsContext()` still returns `{ notify(options): NotificationHandler; notifyError(err, options?): NotificationHandler }`, and `NotificationOptions` keeps `{ variant?, title, description?, duration? }`.

- [ ] **Step 1: Rewrite the provider on Sonner**

`NotificationsProvider` no longer renders Radix `Toast` viewport markup. It resolves `MessageDescriptor`s through `useLingui()._` and calls `toast[variant]?.(title, { description, duration })`, mapping `variant` → Sonner method: `success` → `toast.success`, `error` → `toast.error`, `warning` → `toast.warning`, `info` → `toast.info`, undefined → `toast`. Return `{ close: () => toast.dismiss(id) }` as the `NotificationHandler`.

Keep the exported names `NotificationsProvider`, `useNotificationsContext`, `NotificationOptions`, `ErrorNotificationOptions`, `NotificationHandler`, `NotificationsValue` — consumers across the app import them.

- [ ] **Step 2: Mount `<Toaster />` in all four entry pages**

In each of `authorization-page.tsx`, `account-page.tsx`, `error-page.tsx`, `cookie-error-page.tsx`, render `<Toaster />` as a sibling inside `NotificationsProvider`. Where a page currently has no `NotificationsProvider`, add only `<Toaster />` if it needs toasts; otherwise skip it.

- [ ] **Step 3: Drop the Radix toast dependency**

```bash
pnpm remove @radix-ui/react-toast
grep -rn "@radix-ui/react-toast" src/ || echo "clean"
```

Expected: `clean`.

- [ ] **Step 4: Type-check**

```bash
pnpm exec tsgo --build tsconfig.json
```

Expected: PASS.

- [ ] **Step 5: Verify toasts still render and are readable by the e2e helper**

Boot the dev env, use the `playwright` skill to trigger a notification (the account-manager email update flow raises one on success), and confirm via `browser_snapshot` that the toast text appears in the accessibility tree. The e2e `ensureNotification(text)` helper needs the text present in the DOM.

- [ ] **Step 6: Confirm no catalog change**

```bash
pnpm i18n && git diff --stat src/locales/
```

Expected: reference churn only.

- [ ] **Step 7: Commit**

```bash
pnpm exec prettier --write src/contexts/notifications.tsx src/*-page.tsx
pnpm exec eslint --fix src/contexts/notifications.tsx src/*-page.tsx
git add -A
git commit -m "feat(oauth-provider-ui): replace radix toast with sonner"
```

---

### Task 10: Identity components

**Files:**

- Create: `src/components/identity/account-avatar.tsx`, `account-name.tsx`, `account-identifier.tsx`, `account-summary.tsx`, `client-avatar.tsx`, `client-name.tsx`
- Delete: `src/components/utils/account-image.tsx`, `account-name.tsx`, `account-identifier.tsx`, `account-overview.tsx`, `client-image.tsx`, `client-name.tsx`
- Modify: every importer of the deleted files

**Interfaces:**

- Consumes: `Avatar`, `AvatarImage`, `AvatarFallback` from `#/components/ui/avatar.tsx`; `Account` and `OAuthClientMetadata` types from `@atproto/oauth-provider-api`; the existing `useOAuthClientName` / `useOAuthClientIdentifier` hooks.
- Produces:

  - `AccountAvatar({ account, className })`
  - `AccountName({ account })` — display name, falling back to handle, falling back to DID
  - `AccountIdentifier({ account })` — handle or DID
  - `AccountSummary({ account, className })` — avatar + name + identifier row
  - `ClientAvatar({ clientMetadata, className })`, `ClientName({ clientId, clientMetadata })`

- [ ] **Step 1: Inventory the current strings and importers**

```bash
grep -rn "account-image\|account-name\|account-identifier\|account-overview\|client-image\|client-name" src/ --include='*.tsx'
grep -n "Trans\|msg\`" src/components/utils/account-name.tsx src/components/utils/account-identifier.tsx src/components/utils/client-name.tsx src/components/utils/account-overview.tsx
```

Copy any `<Trans>` block found here **verbatim** into the new files, including nesting.

- [ ] **Step 2: Write the new components**

Rebuild each on `ui/avatar`, preserving the exact fallback chains the old components implement (display name → handle → DID for names; `avatar` URL → initials for images). Keep any `alt` text and `aria-label` values identical.

- [ ] **Step 3: Update importers and delete the old files**

```bash
git rm src/components/utils/account-image.tsx src/components/utils/account-name.tsx \
       src/components/utils/account-identifier.tsx src/components/utils/account-overview.tsx \
       src/components/utils/client-image.tsx src/components/utils/client-name.tsx
```

Then fix every import surfaced in Step 1.

- [ ] **Step 4: Type-check**

```bash
pnpm exec tsgo --build tsconfig.json
```

Expected: PASS. Any failure is an importer you missed.

- [ ] **Step 5: Confirm no catalog change**

```bash
pnpm i18n && git diff src/locales/en/messages.po | grep -E '^[+-]msgid' || echo "no msgid changes"
```

Expected: `no msgid changes`.

- [ ] **Step 6: Commit**

```bash
pnpm exec prettier --write 'src/components/identity/*.tsx'
pnpm exec eslint --fix 'src/components/identity/*.tsx'
git add -A
git commit -m "feat(oauth-provider-ui): rebuild identity components on shadcn avatar"
```

---

### Task 11: Feedback components

**Files:**

- Create: `src/components/feedback/notice.tsx`, `error-notice.tsx`, `error-details.tsx`
- Delete: `src/components/utils/admonition.tsx`, `error-card.tsx`, `error-details.tsx`
- Modify: every importer

**Interfaces:**

- Consumes: `Alert`, `AlertTitle`, `AlertDescription` from `#/components/ui/alert.tsx`.
- Produces:

  - `Notice({ variant?: 'default' | 'info' | 'success' | 'warning' | 'error', title?, children, className })` — replaces `Admonition`
  - `ErrorNotice({ error, className })` — replaces `ErrorCard`
  - `ErrorDetails({ error })` — replaces the old `error-details.tsx`

- [ ] **Step 1: Inventory current variants, strings, and importers**

```bash
grep -rn "Admonition\|ErrorCard\|ErrorDetails" src/ --include='*.tsx'
grep -n "Trans\|msg\`" src/components/utils/admonition.tsx src/components/utils/error-card.tsx src/components/utils/error-details.tsx
```

`Admonition` currently supports more variants than shadcn's `Alert` (`default` | `destructive`). Map the extras onto `Alert` with an added colour class rather than adding variants to `ui/alert.tsx` — keep `ui/*` files unmodified from their shadcn sources so future updates stay mergeable.

- [ ] **Step 2: Write the new components, copying every `<Trans>` verbatim**

- [ ] **Step 3: Update importers and delete the old files**

```bash
git rm src/components/utils/admonition.tsx src/components/utils/error-card.tsx src/components/utils/error-details.tsx
```

- [ ] **Step 4: Type-check**

```bash
pnpm exec tsgo --build tsconfig.json
```

Expected: PASS.

- [ ] **Step 5: Confirm no catalog change**

```bash
pnpm i18n && git diff src/locales/en/messages.po | grep -E '^[+-]msgid' || echo "no msgid changes"
```

Expected: `no msgid changes`.

- [ ] **Step 6: Commit**

```bash
pnpm exec prettier --write 'src/components/feedback/*.tsx'
pnpm exec eslint --fix 'src/components/feedback/*.tsx'
git add -A
git commit -m "feat(oauth-provider-ui): rebuild alert and error components on shadcn alert"
```

---

### Task 12: Locale selector and account menu

**Files:**

- Modify: `src/locales/locale-selector.tsx`
- Create: `src/components/identity/account-menu.tsx`
- Delete: `src/components/utils/account-selector.tsx`
- Delete: `src/hooks/use-click-outside.ts`, `src/hooks/use-escape-key.ts`, `src/hooks/use-merged-refs.ts`

**Interfaces:**

- Consumes: `Select*` from `#/components/ui/select.tsx`; `DropdownMenu*` from `#/components/ui/dropdown-menu.tsx`; `AccountSummary` from Task 10.
- Produces: `AccountMenu({ className, size? })` — the account switcher previously called `AccountSelector`.

- [ ] **Step 1: Inventory strings and importers**

```bash
grep -rn "AccountSelector\|LocaleSelector" src/ --include='*.tsx'
grep -n "Trans\|msg\`" src/locales/locale-selector.tsx src/components/utils/account-selector.tsx
```

- [ ] **Step 2: Rebuild `locale-selector.tsx` on `ui/select`**

Locale display names come from `src/locales/locales.ts` — keep that source unchanged.

- [ ] **Step 3: Write `account-menu.tsx` on `ui/dropdown-menu`**

Radix handles outside-click and escape dismissal, which is why the three hooks below become dead.

- [ ] **Step 4: Delete the superseded files and update importers**

```bash
git rm src/components/utils/account-selector.tsx \
       src/hooks/use-click-outside.ts src/hooks/use-escape-key.ts src/hooks/use-merged-refs.ts
grep -rn "use-click-outside\|use-escape-key\|use-merged-refs" src/ || echo "clean"
```

Expected: `clean`. If any importer remains, migrate it to the Radix equivalent before deleting.

- [ ] **Step 5: Type-check**

```bash
pnpm exec tsgo --build tsconfig.json
```

Expected: PASS.

- [ ] **Step 6: Confirm no catalog change and commit**

```bash
pnpm i18n && git diff src/locales/en/messages.po | grep -E '^[+-]msgid' || echo "no msgid changes"
pnpm exec prettier --write src/locales/locale-selector.tsx src/components/identity/account-menu.tsx
pnpm exec eslint --fix src/locales/locale-selector.tsx src/components/identity/account-menu.tsx
git add -A
git commit -m "feat(oauth-provider-ui): rebuild locale selector and account menu on shadcn"
```

---

### Task 13: App shell

**Files:**

- Create: `src/components/layouts/app-shell.tsx`
- Delete: `src/components/layouts/layout-app.tsx`
- Modify: every importer of `LayoutApp`

**Interfaces:**

- Consumes: `useCustomizationData()` (unchanged), `LocaleSelector`, `LinkAnchor`.
- Produces: `AppShell({ children, header, title })` — same prop shape as the old `LayoutApp`, so importers change only the component name and import path.

- [ ] **Step 1: Read the component being replaced**

```bash
cat src/components/layouts/layout-app.tsx
grep -rn "LayoutApp" src/ --include='*.tsx'
```

Preserve exactly: the `<title>{titleString}</title>` render (the e2e `assertTitle` helper depends on it), the `alt={name || _(msg\`Logo\`)}`on the logo image (the`msg\`Logo\`` descriptor is in the catalogs), and the footer link rendering.

- [ ] **Step 2: Write `app-shell.tsx`**

Header, content region, footer — restyled on shadcn tokens (`bg-background`, `text-foreground`, `text-muted-foreground`, `border-border`). Branding logo and name still render from `useCustomizationData()`; only the colour system changed.

- [ ] **Step 3: Update importers and delete the old file**

```bash
git rm src/components/layouts/layout-app.tsx
```

- [ ] **Step 4: Type-check**

```bash
pnpm exec tsgo --build tsconfig.json
```

Expected: PASS.

- [ ] **Step 5: Verify in the browser**

Using the `playwright` skill, load the authorize page at desktop width and at 390px. Confirm: logo and name render, footer links render, locale selector works, `document.title` is set.

- [ ] **Step 6: Confirm no catalog change and commit**

```bash
pnpm i18n && git diff src/locales/en/messages.po | grep -E '^[+-]msgid' || echo "no msgid changes"
pnpm exec prettier --write src/components/layouts/app-shell.tsx
pnpm exec eslint --fix src/components/layouts/app-shell.tsx
git add -A
git commit -m "feat(oauth-provider-ui): rebuild app shell on shadcn"
```

---

### Task 14: Account-manager sidebar shell

The single largest UX change in the redesign. Flows and destinations are identical; navigation model changes from the bespoke mobile list/detail swap to a persistent rail with a mobile Sheet.

**Files:**

- Create: `src/components/layouts/account-shell.tsx`
- Delete: `src/components/layouts/layout-page.tsx`, `src/components/layouts/layout-title.tsx`
- Modify: `src/pages/account/(authenticated)/route.tsx`, `src/pages/router.tsx`

**Interfaces:**

- Consumes: `Sheet*` from `#/components/ui/sheet.tsx`; `Button`, `Separator`; `AppShell` from Task 13; `AccountMenu` from Task 12; TanStack Router's `Link` and `useRouterState`.
- Produces: `AccountShell({ basePath, title, links, children, prepend })` and `type AccountShellLink = { to; title; hidden?; description?; icon? }` — same shape as the old `LayoutPageProps` / `LayoutPageLink`, so `route.tsx` changes minimally.

- [ ] **Step 1: Read what is being replaced**

```bash
cat src/components/layouts/layout-page.tsx src/components/layouts/layout-title.tsx
```

Note the two behaviors that must be preserved: nav link text (the e2e suite clicks these by text) and the per-page `<title>` render.

- [ ] **Step 2: Write `account-shell.tsx`**

Desktop: persistent sidebar rail listing `links`, with the active route marked `aria-current="page"`. Mobile (`< md`): a trigger button opening a `Sheet` containing the same nav list. Content region renders `children` with the current page's title as a heading.

The `icon` on each link is currently a Phosphor `FunctionComponent<IconProps>`; change `AccountShellLink['icon']` to Lucide's `LucideIcon` type and update `route.tsx` icons in Step 3.

- [ ] **Step 3: Rewire the routes**

In `src/pages/account/(authenticated)/route.tsx`: swap `LayoutPage` → `AccountShell`, and replace the Phosphor icons in `DEFAULT_PAGES` with Lucide equivalents — `HouseSimpleIcon` → `HouseIcon`, `UserIcon` → `UserIcon`, `DevicesIcon` → `MonitorSmartphoneIcon`, `GlobeIcon` → `GlobeIcon`, `QuestionIcon` → `CircleQuestionMarkIcon`. Keep every `title` and `description` `msg\`…\``descriptor byte-identical, and keep the`position` values (0/10/20/30/50) so nav order is unchanged.

In `src/pages/router.tsx`: remove the `/branding` route and the `Palette` import, then `git rm src/components/utils/palette.tsx`. Leave the `customPages` mechanism and its explanatory comment intact — only the example page goes.

- [ ] **Step 4: Delete the old layouts**

```bash
git rm src/components/layouts/layout-page.tsx src/components/layouts/layout-title.tsx
grep -rn "LayoutPage\|LayoutTitle" src/ --include='*.tsx' || echo "clean"
```

`LayoutTitle` is used by several Phase-2 views (`sign-in-view`, `sign-up-view`, `reset-password-view`). If those still import it, **do not delete `layout-title.tsx` in this task** — defer it to Phase 2 and note the deferral in the commit message.

- [ ] **Step 5: Type-check**

```bash
pnpm exec tsgo --build tsconfig.json
```

Expected: PASS.

- [ ] **Step 6: Walk the account manager in the browser**

Using the `playwright` skill, at desktop width and 390px, visit `/account` and each of `/account/manage`, `/account/devices`, `/account/apps`, `/account/about`. Confirm every destination is reachable and nav link text is unchanged.

- [ ] **Step 7: Confirm no catalog change and commit**

```bash
pnpm i18n && git diff src/locales/en/messages.po | grep -E '^[+-]msgid' || echo "no msgid changes"
pnpm exec prettier --write src/components/layouts/account-shell.tsx 'src/pages/**/*.tsx'
pnpm exec eslint --fix src/components/layouts/account-shell.tsx 'src/pages/**/*.tsx'
git add -A
git commit -m "feat(oauth-provider-ui): rebuild account manager shell on shadcn sidebar"
```

---

### Task 15: Phase 1 checkpoint

**Files:**

- Modify: `docs/superpowers/plans/2026-07-27-e2e-baseline.md`

- [ ] **Step 1: Full verification**

```bash
cd packages/oauth/oauth-provider-ui
pnpm exec tsgo --build tsconfig.json
pnpm test
pnpm run build:ui
```

Expected: all PASS.

- [ ] **Step 2: Confirm catalog integrity across the whole phase**

```bash
pnpm i18n
git diff src/locales/*/messages.po | grep -E '^[+-]msgid' || echo "no msgid changes"
```

Expected: `no msgid changes`. Phase 1 moved strings between files but introduced and removed none.

- [ ] **Step 3: Run the e2e suites against the baseline**

```bash
cd ../../pds
pnpm test -- tests/oauth.test.ts
pnpm test -- tests/account-manager.test.ts
```

Compare against `docs/superpowers/plans/2026-07-27-e2e-baseline.md`. Expected: the authorize-flow suite is unchanged from baseline (Phase 1 did not touch those screens). The account-manager suite may have new failures **only** from the sidebar navigation change — specifically any assertion using the mobile back-arrow `clickOnAriaLabel`.

- [ ] **Step 4: Record and justify each delta**

Append a "After phase 1" section to the baseline document listing every newly failing test with a one-line justification. A failure you cannot justify is a bug — fix it rather than recording it.

- [ ] **Step 5: Update the e2e tests for justified changes only**

Modify `packages/pds/tests/account-manager.test.ts` for the navigation-model change. Do not touch assertions on strings — those must still pass.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "test: update account-manager e2e for sidebar navigation model"
```

---

## Self-Review

**Spec coverage.** Phase 0 spec items — dependencies (Task 1), `components.json` (Task 1), `cn()` (Task 2), token block with the additive-not-replacing correction (Task 3), dark-mode variant (Task 3), `components/ui/*` (Tasks 4–6). Phase 1 spec items — app shell (Task 13), account sidebar (Task 14), Sonner (Task 9), locale selector (Task 12), identity components (Task 10), Alert/Card vocabulary (Task 11), Phosphor→Lucide within touched files (Tasks 10–14). The e2e baseline the spec calls for is Task 0. Deferred by design and covered in later plans: `<body>` class change and legacy-token removal (Phase 4), full Phosphor removal (Phase 4, once no consumer remains), form primitives in anger (Phase 2), `scope-description.tsx` (Phase 2), the 8 dialogs (Phase 3).

**Known gap.** Task 14 may not be able to delete `layout-title.tsx`, since Phase 2 views still import it. The task handles this explicitly rather than pretending otherwise.

**Type consistency.** `cn` (Task 2) is imported identically in Tasks 4–6. `AccountShellLink.icon` is typed `LucideIcon` in Task 14 and the icon swap happens in the same task. `AccountSummary` (Task 10) is consumed by `AccountMenu` (Task 12). `errorToNotification` (Task 8) is consumed by the provider (Task 9) with the signature declared in Task 8. `Toaster` (Task 6) is mounted in Task 9. `Sheet*` (Task 5) is consumed in Task 14.
