import type { HyperCore, HyperPlugin, InternalRequest } from "@hyperttp/core";

export function withSerializer(client: HyperCore): HyperCore {
  const next = client.dispatch;

  client.dispatch = async <T = any>(req: InternalRequest): Promise<T> => {
    if (!req.body) return next<T>(req) as unknown as T;

    const body = req.body;
    const isObject =
      typeof body === "object" &&
      !Buffer.isBuffer(body) &&
      !(body instanceof Uint8Array) &&
      typeof (body as any).pipe !== "function";

    if (isObject) {
      const isLogging = req.meta?.trackTimings;
      const start = isLogging ? process.hrtime.bigint() : 0n;

      const rawContentType =
        req.headers["content-type"] ?? req.headers["Content-Type"];
      const contentType =
        typeof rawContentType === "string"
          ? rawContentType.toLowerCase()
          : null;

      if (!contentType || contentType.includes("application/json")) {
        req.headers["content-type"] = "application/json";
        req.body = JSON.stringify(body);
      } else if (contentType.includes("application/x-www-form-urlencoded")) {
        req.body = new URLSearchParams(body as any).toString();
      }

      if (isLogging) {
        const end = process.hrtime.bigint();
        req.meta = req.meta || {};
        req.meta.timings = req.meta.timings || {};
        req.meta.timings.serializationMs = Number(end - start) / 1e6;
      }
    }

    return next<T>(req) as unknown as T;
  };

  return client;
}

export const SerializerPlugin: HyperPlugin = {
  name: "hyperttp-serializer",
  phase: "FORMAT",
  enabled: () => true,
  apply: (client: HyperCore) => withSerializer(client),
};
