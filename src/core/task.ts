import { CursorOptions, IDBData } from './types';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type TaskArguments = any[];

export enum TransactionMode {
  READ = 'readonly',
  WRITE = 'readwrite',
}

export enum TransactionType {
  ADD = 'add',
  GET = 'get',
  PUT = 'put',
  DELETE = 'delete',
  CLEAR = 'clear',
  COUNT = 'count',
  // $: Using cursor
  $GET = '$get',
  $UPDATE = '$update',
  $DELETE = '$delete',
  INTERRUPT = 'interrupt',
}

/**
 * VO for transaction task
 */
export class TransactionTask {
  public mode: TransactionMode;

  constructor(
    public action: TransactionType,
    public name: string,
    public args: TaskArguments,
    public cursor: CursorOptions<IDBData>,
  ) {
    this.mode =
      this.action === TransactionType.GET || this.action === TransactionType.$GET
        ? TransactionMode.READ
        : TransactionMode.WRITE;
  }
}
