export function triggerUnhandledRejection(error: unknown) {
  Promise.reject(error);
}