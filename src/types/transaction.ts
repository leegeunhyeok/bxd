import { Schema } from './schema';
import { Data } from './data';
import { Task } from './task';

export enum TransactionType {
  ADD = 'add',
  GET = 'get',
  PUT = 'put',
  DELETE = 'delete',
  CLEAR = 'clear',
  COUNT = 'count',
  // $ prefixed: control multiple records
  $GET = '$get',
  $UPDATE = '$update',
  $DELETE = '$delete',
  INTERRUPT = 'interrupt',
}

export type TransactionResult<S extends Schema> = void | null | Data<S> | Data<S>[];

export interface Transaction<T extends Task> {
  close(): void;
  run<S extends Schema>(...tasks: T[]): Promise<TransactionResult<S>>;
}
