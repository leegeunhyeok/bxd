import { BoxFilterFunction, BoxRange, IDBArgument, IDBValue } from '.';
import { BoxCursorDirections, BoxScheme } from './index';

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
  // $ prefix means this task is using cursor
  $GET = '$get',
  $UPDATE = '$update',
  $DELETE = '$delete',
  INTERRUPT = 'interrupt',
}

export interface TransactionTask {
  type: TransactionType;
  name: string;
  args?: IDBArgument;
}

export interface CursorTransactionTask<S extends BoxScheme> extends TransactionTask {
  direction?: BoxCursorDirections;
  filter?: BoxFilterFunction<S>[];
  range?: BoxRange<S>;
  target?: IDBKeyPath;
  limit?: number;
  updateValue?: IDBValue;
}
