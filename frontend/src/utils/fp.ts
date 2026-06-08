/**
 * Performs a deep structural clone of a value using native structuredClone if available,
 * falling back to JSON serialization.
 * 
 * @param value The value to clone.
 * @returns A deep clone of the value.
 */
export function clone<T>(value: T): T {
  if (typeof structuredClone === 'function') {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value)) as T;
}

/**
 * Pipes a value through a sequence of unary functions.
 * 
 * @param value The initial value.
 * @param fns The unary functions to apply sequentially.
 * @returns The final result.
 */
export function pipe<T>(value: T, ...fns: Array<(v: T) => T>): T {
  return fns.reduce((acc, fn) => fn(acc), value);
}

/**
 * Composes a sequence of unary functions from right to left.
 * 
 * @param fns The unary functions to compose.
 * @returns A composed function.
 */
export function compose<T>(...fns: Array<(v: T) => T>): (v: T) => T {
  return (value: T) => fns.reduceRight((acc, fn) => fn(acc), value);
}

/**
 * Curried map function.
 * 
 * @param fn Mapping function.
 * @returns A function accepting an array.
 */
export function map<T, U>(fn: (item: T) => U): (arr: T[]) => U[] {
  return (arr: T[]) => arr.map(fn);
}

/**
 * Curried filter function.
 * 
 * @param predicate Filter predicate.
 * @returns A function accepting an array.
 */
export function filter<T>(predicate: (item: T) => boolean): (arr: T[]) => T[] {
  return (arr: T[]) => arr.filter(predicate);
}

/**
 * Curried reduce function.
 * 
 * @param fn Reducer function.
 * @param initialValue Initial accumulator value.
 * @returns A function accepting an array.
 */
export function reduce<T, U>(fn: (acc: U, item: T) => U, initialValue: U): (arr: T[]) => U {
  return (arr: T[]) => arr.reduce(fn, initialValue);
}

/**
 * Safely accesses a nested path inside an object, returning a default value if missing.
 * 
 * @param obj The target object.
 * @param path The dot-separated path or array of keys.
 * @param defaultValue Fallback value if resolved is undefined.
 * @returns The resolved property value or fallback.
 */
export function getIn<T = unknown>(obj: unknown, path: string | string[], defaultValue: T): T {
  const keys = Array.isArray(path) ? path : path.split('.');
  const result = keys.reduce<unknown>((acc, key) => {
    if (acc === null || acc === undefined || typeof acc !== 'object') {
      return undefined;
    }
    return (acc as Record<string, unknown>)[key];
  }, obj);

  return result === undefined ? defaultValue : (result as T);
}
