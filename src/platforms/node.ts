export function onUnhandledError(error: unknown) {
  console.error(error);
  process.exit(1);
}