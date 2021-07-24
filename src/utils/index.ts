import { BoxContext, BoxCursorHandler, TransactionCursorHandler } from '../core/box';
import { BoxIndexConfig, BoxMeta } from '../core/database';
import { BoxRange, BoxCursorTask, FilterFunction, TaskParameter } from '../core/transaction';
import { ConfiguredSchema, Schema } from '../types/schema';
import { TransactionType } from '../types/transaction';

export const toBoxMeta = ({
  name,
  schema = null,
  inKey,
  outKey,
  index,
  force = false,
}: {
  name: string;
  schema?: ConfiguredSchema | null;
  inKey: string | null;
  outKey: boolean;
  index: BoxIndexConfig[];
  force?: boolean;
}): BoxMeta => {
  return { name, schema, inKey, outKey, index, force };
};

export const getCursorHandler = (
  context: BoxContext,
  range?: BoxRange<Schema> | null,
  filter?: FilterFunction<Schema>[],
): BoxCursorHandler<Schema> => {
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
  range?: BoxRange<Schema> | null,
  filter?: FilterFunction<Schema>[],
): TransactionCursorHandler<Schema> => {
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

export const createTask = <S extends Schema>(
  type: TransactionType,
  name: string,
  taskArgs?: TaskParameter<S>,
): BoxCursorTask<S> => {
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
