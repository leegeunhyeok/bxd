import {
  IDBValue,
  IDBArgument,
  BoxSchema,
  BoxRange,
  BoxCursorDirections,
  BoxFilterFunction,
  CursorTransactionTask,
  TransactionType,
} from '../types';

export type TaskArguments<S extends BoxSchema> = {
  args?: IDBArgument;
  direction?: BoxCursorDirections;
  filter?: BoxFilterFunction<S>[];
  range?: BoxRange<S>;
  limit?: number;
  updateValue?: IDBValue;
};

export const createTask = <S extends BoxSchema>(
  type: TransactionType,
  name: string,
  taskArgs?: TaskArguments<S>,
): CursorTransactionTask<S> => {
  const { args, direction, filter, range, limit, updateValue } = taskArgs || {};
  return {
    type,
    name,
    args,
    direction,
    filter,
    range,
    limit,
    updateValue,
  };
};
