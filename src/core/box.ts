class BoxDB {
  private _init = false;
  private _databaseName: string;
  private _version: number;
  private _items: Map<string, any> = new Map();

  constructor(databaseName: string, version: number) {
    this._databaseName = databaseName;
    this._version = version;
  }

  item() {
    // TODO
  }

  create() {
    this._init = true;
  }
}

export default BoxDB;
