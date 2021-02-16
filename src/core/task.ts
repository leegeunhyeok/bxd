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
  CURSOR_GET = 'cursor_get',
  CURSOR_UPDATE = 'cursor_update',
  CURSOR_DELETE = 'cursor_delete',
  INTERRUPT = 'interrupt',
  NONE = 'none',
}

export interface TransactionTaskObject {
  action: TransactionType;
  storeName: string;
  mode: TransactionMode;
  args: TaskArguments;
}

/**
 * VO for transaction task
 */
export class TransactionTask {
  constructor(
    public action: TransactionType,
    public storeName: string,
    public mode: TransactionMode,
    public args: TaskArguments,
  ) {}

  valueOf(): TransactionTaskObject {
    return {
      action: this.action,
      storeName: this.storeName,
      mode: this.mode,
      args: this.args,
    };
  }
}
