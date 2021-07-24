import { Model } from './model';
import { Schema } from './schema';
import { Transaction } from './transaction';
import { Task } from './task';

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
  public abstract transaction(...tasks: Task[]): Promise<void>;
  public abstract open(): Promise<Event>;
  public abstract close<T>(): void | Promise<T>;
}
