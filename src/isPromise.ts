export default function isPromise(value: unknown): value is PromiseLike<any> {
  return (
    value !== null &&
    typeof value === 'object' &&
    typeof (value as PromiseLike<any>).then === 'function'
  );
}
