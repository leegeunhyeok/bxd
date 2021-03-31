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
