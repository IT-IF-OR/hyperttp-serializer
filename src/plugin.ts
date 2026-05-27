import type { HyperPlugin, InternalRequest } from "@hyperttp/types";

/**
 * @ru Расширенный интерфейс запроса с типизированными метаданными для замера производительности.
 * @en Extended request interface with strongly-typed metadata for performance monitoring.
 */
export interface SerializableRequest extends InternalRequest {
  meta: NonNullable<InternalRequest["meta"]> & {
    trackTimings?: boolean;
    timings?: {
      networkMs?: number;
      serializationMs?: number;
    };
  };
}

/**
 * @ru Плагин автоматической сериализации тела запроса (JSON / URL-encoded) с расчетом времени выполнения.
 * @en Automatic request body serialization plugin (JSON / URL-encoded) with execution benchmarking.
 * @returns HyperPlugin object instance.
 */
export function withSerializer(): HyperPlugin {
  return {
    name: "hyperttp-serializer",

    /**
     * @ru Проверяет, включен ли плагин по умолчанию.
     * @en Verifies whether the plugin is enabled by default.
     */
    enabled: (): boolean => true,

    /**
     * @ru Перехватчик фазы запроса. Определяет тип данных и трансформирует объект в строку перед отправкой.
     * @en Request phase interceptor. Inspects data layout and transforms objects into raw strings before flight.
     * @param req - Contextual internal request options.
     */
    onRequest(req: InternalRequest): void {
      const { body } = req;
      if (!body) return;

      const isObject =
        typeof body === "object" &&
        body !== null &&
        !Buffer.isBuffer(body) &&
        !(body instanceof Uint8Array) &&
        !(
          "pipe" in body &&
          typeof (body as Record<string, unknown>).pipe === "function"
        );

      if (isObject) {
        const serializableReq = req as SerializableRequest;

        const isLogging = serializableReq.meta?.trackTimings === true;
        if (isLogging && !serializableReq.meta.timings) {
          serializableReq.meta.timings = {};
        }

        const start = isLogging ? process.hrtime.bigint() : 0n;
        const headers = serializableReq.headers as Record<
          string,
          string | string[] | undefined
        >;

        let contentType: string | undefined;
        if (typeof headers.get === "function") {
          contentType =
            (headers as unknown as Headers).get("content-type") || undefined;
        } else {
          const rawType = headers["content-type"] || headers["Content-Type"];
          contentType = Array.isArray(rawType) ? rawType[0] : rawType;
        }

        if (!contentType || contentType.includes("application/json")) {
          if (typeof headers.set === "function") {
            (headers as unknown as Headers).set(
              "content-type",
              "application/json",
            );
          } else {
            headers["content-type"] = "application/json";
          }
          serializableReq.body = JSON.stringify(body);
        } else if (contentType.includes("application/x-www-form-urlencoded")) {
          const recordBody = body as Record<string, string>;
          serializableReq.body = new URLSearchParams(recordBody).toString();
        }

        if (isLogging && serializableReq.meta.timings) {
          serializableReq.meta.timings.serializationMs =
            Number(process.hrtime.bigint() - start) / 1e6;
        }
      }
    },
  };
}
