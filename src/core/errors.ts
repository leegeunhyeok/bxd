export class BoxDBError extends Error {
  constructor(public message: string) {
    super(message);
    this.name = 'BoxDBError';
    this.stack = new Error().stack;
  }
}
