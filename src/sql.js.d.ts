declare module "sql.js" {
  export interface SqlJsStatic {
    Database: new (data?: ArrayLike<number> | Uint8Array | null) => Database;
  }
  export interface Database {
    prepare(sql: string): Statement;
    exec(sql: string): QueryExecResult[];
    run(sql: string, params?: any[]): Database;
    export(): Uint8Array;
    close(): void;
    each(sql: string, params: any[], callback: (row: any) => void, done: () => void): void;
  }
  export interface Statement {
    bind(params?: any[]): boolean;
    step(): boolean;
    getAsObject(params?: Record<string, string>): Record<string, any>;
    get(): any[];
    getColumnNames(): string[];
    free(): boolean;
    reset(): void;
  }
  export interface QueryExecResult {
    columns: string[];
    values: any[][];
  }
  export default function initSqlJs(config?: {
    locateFile?: (file: string) => string;
  }): Promise<SqlJsStatic>;
}
