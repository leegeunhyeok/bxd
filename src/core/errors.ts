export class BoxDBError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = 'BoxDBError';
  }
}
