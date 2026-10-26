import { type ClassValue, clsx } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

// @NOTE Every token the theme adds (`--text-*`, `--container-*` in style.css)
// must be listed here. An unknown `text-*` class is taken for a text color, so
// merging it in silently drops the color it was meant to sit next to; an
// unknown `max-w-*` is kept beside the width that should replace it.
const twMerge = extendTailwindMerge({
  extend: { theme: { text: ['action'], container: ['auth-card'] } },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
