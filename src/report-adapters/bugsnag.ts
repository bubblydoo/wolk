import Bugsnag from "@bugsnag/core";
import { isError, isWolkError } from "../errors/error";
import type { ReportOptions } from "../contexts/report";

export type BugsnagContext = {
  apiKey: string;
  request?: {
    url: string;
    method: string;
    headers: Record<string, string>;
    bodyPromise: Promise<unknown>;
  }
  filePath: string;
  appType?: string;
  stage?: string;
}

export const createReportInternal = (bugsnagContext: BugsnagContext) => {
  return async (
    err: unknown,
    { unhandled = false, level = "error" }: ReportOptions = {},
  ) => {
    console.log("reporting error", err);

    const transformedErr = transformErrorBeforeReport(err);

    const event = Bugsnag.Event.create(
      transformedErr,
      true,
      {
        severity: level,
        severityReason: {
          type: unhandled ? "unhandledException" : "log",
        },
        unhandled: unhandled,
      },
      "report error",
      0,
    );

    if (bugsnagContext.request) {
      event.addMetadata("request", {
        url: bugsnagContext.request.url,
        method: bugsnagContext.request.method,
        headers: bugsnagContext.request.headers,
        body: await bugsnagContext.request.bodyPromise,
      });
    }

    // for (const [key, value] of Object.entries(customMetaTabs)) {
    //   event.addMetadata(key, value);
    // }

    addDefaultCustomMetaTabs(transformedErr, event);

    // linking to bugsnag sourcemap, otherwise its just index.js
    // event.errors = event.errors.map((err) => {
    //   const fixedStacktrace = err.stacktrace.map((s) => {
    //     return { ...s, file: bugsnagContext.filePath! };
    //   });

    //   return { ...err, stacktrace: fixedStacktrace };
    // });

    event.app = {
      type: bugsnagContext.appType,
      releaseStage: bugsnagContext.stage,
    };
    console.log("fetching bugsnag");

    try {
      const resp = await fetch("https://notify.bugsnag.com", {
        method: "POST",
        headers: {
          "Bugsnag-Api-Key": bugsnagContext.apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          notifier: {
            name: "logger-worker-trial",
            version: "1.0.11",
            url: "https://github.com/readmeio/cloudflare-worker/",
          },
          events: [event],
        }),
      });
      if (!resp.ok) {
        throw new Error(`Failed to report error to bugsnag: ${resp.status} ${resp.statusText}`);
      }
      console.log("fetching bugsnag done");
    } catch (e) {
      console.error("error fetching bugsnag", e);
    }
  };
};

export function addDefaultCustomMetaTabs(err: unknown, event: Bugsnag.Event) {
  if (!isError(err)) return;
  if (isWolkError(err)) {
    event.addMetadata("info", err.info);
  }
}

export function transformErrorBeforeReport(err: unknown): unknown {
  if (!isError(err)) return err;
  // in case of db-errors
  if ("nativeError" in err) {
    err.cause = err.nativeError;
    return err;
  }
  return err;
}
