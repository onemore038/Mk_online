/** ルール違反・不正な操作を表すエラー。reducer はこれを投げる代わりに Result 型で返す。 */
export class EngineError extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message);
    this.name = "EngineError";
  }
}

export class NotImplementedError extends EngineError {
  constructor(message: string) {
    super(message, "NOT_IMPLEMENTED");
    this.name = "NotImplementedError";
  }
}

export type EngineResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: EngineError };

export function ok<T>(value: T): EngineResult<T> {
  return { ok: true, value };
}

export function fail<T>(error: EngineError): EngineResult<T> {
  return { ok: false, error };
}
