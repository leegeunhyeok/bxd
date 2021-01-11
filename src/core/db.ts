import { generateModel, BoxScheme, BoxModel } from './model';
import { BoxDBError } from './errors';

interface BoxModelMeta {
  scheme: BoxScheme;
  targetVersion: number;
}

type BoxModelRegister = <S extends BoxScheme>(storeName: string, scheme: S) => BoxModel<S>;

class BoxDB {
  private _init = false;
  private _databaseName: string;
  private _version: number;
  private _models: Map<number, Map<string, BoxModelMeta>> = new Map();

  /**
   * @constructor
   * @param databaseName idb name
   * @param version idb version
   */
  constructor(databaseName: string, version: number) {
    this._databaseName = databaseName;
    this._version = version;
  }

  get databaseName(): string {
    return this._databaseName;
  }

  get version(): number {
    return this._version;
  }

  /**
   * regist data model for create object store
   * @param targetVersion target idb version
   */
  model(targetVersion: number): BoxModelRegister {
    /**
     * regist data model for create object store
     * @param storeName object store name
     * @param scheme object store data structure
     */
    return <S extends BoxScheme>(storeName: string, scheme: S): BoxModel<S> => {
      if (this._init) {
        throw new BoxDBError('database already open');
      }

      // create new Map if version map is not exist
      this._models.has(targetVersion) || this._models.set(targetVersion, new Map());

      const versionMap = this._models.get(targetVersion);
      if (versionMap.has(storeName)) {
        throw new BoxDBError(`version ${targetVersion}, ${storeName} model exist`);
      }
      versionMap.set(storeName, { scheme, targetVersion });
      return generateModel(storeName, scheme);
    };
  }

  /**
   * create/update object stores and open idb
   */
  async open(): Promise<void> {
    this._init = true;
  }
}

export default BoxDB;
