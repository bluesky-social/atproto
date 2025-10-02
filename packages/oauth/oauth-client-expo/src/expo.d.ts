// In order to avoid installing the whole of 'expo' just for types, we
// override the NPM dependency in the root package.json to point to a
// dummy package, and declare the minimal types we need here.

declare module 'expo' {
  export class NativeModule<_T> {}
  export function requireNativeModule<T>(name: string): T
}
