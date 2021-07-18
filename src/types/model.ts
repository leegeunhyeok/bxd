import { Transaction } from './transaction';
import { Schema } from './schema';
import { Task } from './task';
import { Data, OptionalData } from './data';

export interface Model<S extends Schema> {
  new (initialData?: Data<S>): Data<S>;
  tx: Transaction<Task>;
  name: string;
  add<K, V extends Data<S>>(value: V, key?: K): Promise<K>;
  get<K, V extends Data<S>>(key: K): Promise<V>;
  put<K, V extends OptionalData<S>>(value: V, key?: K): Promise<void>;
  delete<K>(key: K): Promise<void>;
  clear(): Promise<void>;
  count(): Promise<number>;
}
