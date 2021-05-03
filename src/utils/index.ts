import {
  IDBArgument,
  BoxScheme,
  BoxRange,
  BoxCursorDirections,
  BoxFilterFunction,
  CursorTransactionTask,
  TransactionType,
} from '../types';

export const createTask = <S extends BoxScheme>(
  type: TransactionType,
  name: string,
  args?: IDBArgument,
  direction?: BoxCursorDirections,
  filter?: BoxFilterFunction<S>[],
  range?: BoxRange<S>,
  limit?: number,
): CursorTransactionTask<S> => ({
  type,
  name,
  args,
  direction,
  filter,
  range,
  limit,
});
