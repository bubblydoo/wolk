export function onUnhandledError(error: unknown) {
  console.error(error);
  throw error;
}