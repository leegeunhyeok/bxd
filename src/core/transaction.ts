/* eslint-disable @typescript-eslint/no-explicit-any */

type TaskArguments = any[];

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
