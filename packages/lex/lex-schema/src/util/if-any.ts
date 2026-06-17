export type IfAny<T, TrueValue, FalseValue> = 0 extends 1 & T
  ? TrueValue
  : FalseValue
