import { createAsyncContext } from "../context";
import type { WaitUntilFn } from "./wait-until";

export type ReportFn = (error: unknown, options?: ReportOptions) => void;

export interface ReportOptions {
  level?: "warning" | "error";
  unhandled?: boolean;
}

export function createReportContext() {
  const reportStore = createAsyncContext<ReportFn>("report");

  function report(error: unknown, options: ReportOptions = {}) {
    const reportFn = reportStore.consume();
    reportFn(error, options);
  }

  return [
    report,
    reportStore.provide,
  ] as const;
}

export function createReportFn(waitUntil: WaitUntilFn) {
  return (error: unknown, options: ReportOptions = {}) => {
    waitUntil(Promise.resolve().then(() => {
      throw error;
    }));
  }
}