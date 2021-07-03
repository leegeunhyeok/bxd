import {
  BoxSchema,
  BoxRange,
  BoxMeta,
  BoxIndexConfig,
  BoxFilterFunction,
  CursorTransactionTask,
  TransactionType,
  BoxContext,
  BoxCursorHandler,
  TransactionCursorHandler,
  TaskParameters,
  ConfiguredBoxSchema,
} from '../types';

export const toBoxMeta = ({
  name,
  schema = null,
  inKey,
  outKey,
  index,
  force = false,
}: {
  name: string;
  schema?: ConfiguredBoxSchema | null;
  inKey: string | null;
  outKey: boolean;
  index: BoxIndexConfig[];
  force?: boolean;
}): BoxMeta => {
  return { name, schema, inKey, outKey, index, force };
};

export const getCursorHandler = (
  context: BoxContext,
  range?: BoxRange<BoxSchema> | null,
  filter?: BoxFilterFunction<BoxSchema>[],
): BoxCursorHandler<BoxSchema> => {
  return {
    get(order, limit) {
      return context.$(TransactionType.$GET, {
        direction: order,
        limit,
        filter,
        range,
      });
    },
    update(value) {
      context.pass(value, false);
      return context.$(TransactionType.$UPDATE, { range, filter, updateValue: value });
    },
    delete() {
      return context.$(TransactionType.$DELETE, { range, filter });
    },
  };
};

export const getTransactionCursorHandler = (
  context: BoxContext,
  range?: BoxRange<BoxSchema> | null,
  filter?: BoxFilterFunction<BoxSchema>[],
): TransactionCursorHandler<BoxSchema> => {
  return {
    update(value) {
      context.pass(value, false);
      return createTask(TransactionType.$UPDATE, context.__name, {
        range,
        filter,
        updateValue: value,
      });
    },
    delete() {
      return createTask(TransactionType.$DELETE, context.__name, { range, filter });
    },
  };
};

export const createTask = <S extends BoxSchema>(
  type: TransactionType,
  name: string,
  taskArgs?: TaskParameters<S>,
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
