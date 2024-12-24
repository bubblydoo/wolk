import { trace as otelTrace } from "@opentelemetry/api";

export type TraceInfo = {
  name: string;
  attributes?: Record<string, unknown>;
  spanContext?: unknown;
}

const tracer = otelTrace.getTracer("Wolk Tracer");

export function trace<R>(info: TraceInfo, fn: () => R): R {
  return tracer.startActiveSpan(info.name, info.spanContext, async (span) => {
    if (info.attributes) {
      span.setAttributes(info.attributes);
    }
    const result = await fn();
    span.end();
    return result;
  });
}

export type SpanEventInfo = {
  name: string;
  attributes?: Record<string, unknown>;
}

export function addSpanEvent(info: SpanEventInfo) {
  otelTrace.getActiveSpan()?.addEvent(info.name, info.attributes);
}