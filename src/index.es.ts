import BoxDB from './core/database';
import BoxTransaction from './core/transaction';
export { Box } from './core/box';
export { BoxOption } from './core/database';
export { BoxTask, BoxCursorTask, BoxRange, FilterFunction } from './core/transaction';
export { BoxDBError } from './core/errors';
export {
  Schema as BoxSchema,
  Data as BoxData,
  OptionalData as OptionalBoxData,
  DataType,
  TransactionType,
} from './types';

export { BoxTransaction };
export default BoxDB;
