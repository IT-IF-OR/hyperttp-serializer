import type { HyperPlugin, InternalRequest } from "@hyperttp/types";

/**
 * @en Extended internal request interface with serialization timing metadata.
 * @ru Расширенный интерфейс внутреннего запроса с метаданными времени сериализации.
 */
export interface SerializableRequest extends InternalRequest {
  /**
   * @en Metadata including timing tracking flags and measurements.
   * @ru Метаданные, включая флаги отслеживания времени и измерения.
   */
  meta: NonNullable<InternalRequest["meta"]> & {
    /**
     * @en Flag to enable timing measurements for this request.
     * @ru Флаг для включения измерений времени для этого запроса.
     */
    trackTimings?: boolean;

    /**
     * @en Object containing measured durations for various stages.
     * @ru Объект, содержащий измеренные длительности различных этапов.
     */
    timings?: {
      /**
       * @en Time spent on network operations in milliseconds.
       * @ru Время, затраченное на сетевые операции, в миллисекундах.
       */
      networkMs?: number;

      /**
       * @en Time spent on request body serialization in milliseconds.
       * @ru Время, затраченное на сериализацию тела запроса, в миллисекундах.
       */
      serializationMs?: number;
    };
  };
}

/**
 * @en Creates a plugin that automatically serializes request bodies (JSON or Form URL-encoded) based on Content-Type.
 * Also supports optional timing metrics for the serialization process.
 * @ru Создает плагин, который автоматически сериализует тела запросов (JSON или Form URL-encoded) на основе Content-Type.
 * Также поддерживает опциональные метрики времени для процесса сериализации.
 * @returns The configured HyperPlugin instance.
 */
export function withSerializer(): HyperPlugin {
  return {
    name: "hyperttp-serializer",

    /**
     * @en This plugin is always enabled by default.
     * @ru Этот плагин всегда включен по умолчанию.
     * @returns True.
     */
    enabled: () => true,

    /**
     * @en Intercepts outgoing requests to serialize object bodies into strings or URLSearchParams.
     * @ru Перехватывает исходящие запросы для сериализации объектных тел в строки или URLSearchParams.
     * @param req - The internal request object.
     */
    onRequest(req: InternalRequest): void {
      const { body } = req;
      if (!body) return;

      const isObject =
        typeof body === "object" &&
        body !== null &&
        !Buffer.isBuffer(body) &&
        !(body instanceof Uint8Array) &&
        !("pipe" in body && typeof (body as any).pipe === "function");

      if (isObject) {
        const serializableReq = req as SerializableRequest;
        const isLogging = serializableReq.meta?.trackTimings === true;

        if (isLogging) {
          serializableReq.meta.timings = serializableReq.meta.timings ?? {};
        }

        const start = isLogging ? performance.now() : 0;

        const headers = serializableReq.headers as Record<
          string,
          string | string[]
        >;

        /**
         * @en Helper to retrieve a header value case-insensitively.
         * @ru Вспомогательная функция для получения значения заголовка без учета регистра.
         * @param name - The header name.
         * @returns The header value or undefined.
         */
        const getHeader = (name: string): string | undefined => {
          if (typeof (headers as any).get === "function") {
            return (headers as any).get(name);
          }
          const val = headers[name] || headers[name.toLowerCase()];
          return Array.isArray(val) ? val[0] : val;
        };

        const contentType = getHeader("content-type");

        if (!contentType || contentType.includes("application/json")) {
          if (typeof (headers as any).set === "function") {
            (headers as any).set("content-type", "application/json");
          } else {
            headers["content-type"] = "application/json";
          }
          serializableReq.body = JSON.stringify(body);
        } else if (contentType.includes("application/x-www-form-urlencoded")) {
          serializableReq.body = new URLSearchParams(
            body as Record<string, string>,
          ).toString();
        }

        if (isLogging && serializableReq.meta.timings) {
          serializableReq.meta.timings.serializationMs =
            performance.now() - start;
        }
      }
    },
  };
}
