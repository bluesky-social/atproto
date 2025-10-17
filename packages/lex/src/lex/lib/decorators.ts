/**
 * Decorator to cache the result of a getter on a class instance.
 */
export const cachedGetter = <T extends object, V>(
  target: (this: T) => V,
  _context: ClassGetterDecoratorContext<T, V>,
) => {
  return function (this: T) {
    const value = target.call(this)
    Object.defineProperty(this, target.name, {
      get: () => value,
      enumerable: true,
      configurable: true,
    })
    return value
  }
}
