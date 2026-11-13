export const ifNumber = (value: unknown): undefined | number =>
  typeof value === 'number' ? value : undefined
