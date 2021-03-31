interface BoxDBError {
  name: string;
  message: string;
  stack?: string;
}

interface BoxDBErrorConstructor {
  new (message?: string): BoxDBError;
  (message?: string): BoxDBError;
  readonly prototype: Error;
}

function BxdError(message?: string): void {
  this.name = 'BoxDBError';
  this.message = message;
}

BxdError.prototype = Error.prototype;

export const BoxDBError = BxdError as BoxDBErrorConstructor;
