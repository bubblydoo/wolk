import { createAsyncContext } from "../context";
import { InternalWolkError } from "../internal/internal-error";

export function createEnvContext<TEnv extends Record<string, unknown>>() {
  const envStore = createAsyncContext<TEnv>("env");

  const env = {
    get(key: keyof TEnv) {
      const value = envStore.consume()[key];
      if (value === undefined) {
        throw new InternalWolkError({
          message: `Missing environment variable: ${key.toString()}`,
          info: { key },
        });
      }
      return value;
    },
    getOptional(key: keyof TEnv) {
      return envStore.consume()[key];
    },
    isTrue(key: keyof TEnv) {
      return env.getOptional(key) === "true";
    }
  }
  
  return [
    env,
    envStore.provide,
  ] as const;
}