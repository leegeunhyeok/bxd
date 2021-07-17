import { TransactionType } from './transaction';

export interface Task<A = unknown> {
  type: TransactionType;
  args?: A;
}
