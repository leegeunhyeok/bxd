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

export interface TransactionTaskMeta {
  action: TransactionType;
  storeName: string;
  mode: TransactionMode;
  args: TaskArguments;
}

/**
 * VO for transaction task
 */
export class TransactionTask {
  public mode: TransactionMode;

  constructor(
    public action: TransactionType,
    public storeName: string,
    public cursorOptions: CursorOptions<IDBData> = {},
    public args: TaskArguments = [],
  ) {
    this.mode =
      this.action === TransactionType.GET || this.action === TransactionType.$GET
        ? TransactionMode.READ
        : TransactionMode.WRITE;
  }

  /**
   * Convert task datas
   * @returns
   */
  valueOf(): TransactionTaskMeta {
    return {
      action: this.action,
      storeName: this.storeName,
      mode: this.mode,
      args: this.args,
    };
  }

  /**
   * Convert task datas to CursorOption for use immediately
   * @returns
   */
  cursorOption(): CursorOptions<IDBData> {
    const options = this.cursorOptions;
    const filter = options.filter || null;
    const value = options.value || null;
    const limit = options.limit ?? null;
    const direction = options.direction || 'next';
    return { filter, value, limit, direction };
  }
}
