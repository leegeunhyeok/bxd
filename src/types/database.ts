import { Model } from './model';
import { Schema } from './schema';
import { Task } from './task';
import { Transaction } from './transaction';

export interface ModelOption {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

export default abstract class Database<DB> {
  public db: DB | null;
  public tx: Transaction<Task>;
  public name: string;
  public ready: boolean;

  public abstract isReady(): boolean;
  public abstract getName(): string;
  public abstract getDB(): DB | null;
  public abstract box<S extends Schema, M extends ModelOption>(
    name: string,
    schema: S,
    option?: M,
  ): Model<S>;
  public abstract open(): Promise<Event>;
  public abstract close<T>(): void | Promise<T>;
}
