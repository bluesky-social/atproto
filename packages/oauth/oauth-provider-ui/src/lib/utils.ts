import { type ClassValue, clsx } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

// @NOTE Custom theme tokens must be registered here, or tailwind-merge files an
// unknown `text-*` under text colour and drops the variant's colour class.
// Keep in sync with the `@theme` block in style.css.
const twMerge = extendTailwindMerge({
  extend: { theme: { text: ['action'] } },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
