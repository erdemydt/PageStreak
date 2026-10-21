/**
 * Dev-only logging. Release builds drop log/warn entirely (they were leaking
 * user data such as book titles and search queries into device logs).
 * Use console.error directly for real errors.
 */
const noop = () => {};

export const log: (...args: unknown[]) => void = __DEV__
  ? console.log.bind(console)
  : noop;

export const warn: (...args: unknown[]) => void = __DEV__
  ? console.warn.bind(console)
  : noop;
