export type DatabaseType = 'mysql' | 'postgresql';

export interface DatabaseConfig {
  type: DatabaseType;
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

export interface ConnectionConfig extends DatabaseConfig {
  name?: string;
  createdAt?: string;
}

export interface SyncPairConfig {
  name: string;
  source: string;
  target: string;
  enabled: boolean;
  syncSchema: boolean;
  syncData: boolean;
  syncProcedures: boolean;
  excludeTables: string[];
  includeTables: string[];
  createdAt: string;
  lastSync: string | null;
}

export interface SyncSettings {
  pollInterval: number;
  schemaCheckInterval: number;
  logLevel: 'error' | 'warn' | 'info' | 'debug';
  maxRetries: number;
  retryDelay: number;
}

export interface Config {
  connections: { [key: string]: ConnectionConfig };
  syncPairs: SyncPairConfig[];
  settings: SyncSettings;
}

export interface TableInfo {
  tableName: string;
  engine: string;
  collation: string;
  createStatement: string;
}

export interface ColumnInfo {
  Field: string;
  Type: string;
  Null: string;
  Key: string;
  Default: string | null;
  Extra: string;
}

export interface IndexInfo {
  Table: string;
  Non_unique: number;
  Key_name: string;
  Seq_in_index: number;
  Column_name: string;
  Collation: string | null;
  Cardinality: number | null;
  Sub_part: number | null;
  Packed: string | null;
  Null: string;
  Index_type: string;
  Comment: string;
}

export interface ProcedureInfo {
  name: string;
  type: 'PROCEDURE' | 'FUNCTION';
  definer: string;
  created: string;
  modified: string;
  sqlMode: string;
  createStatement: string;
}

export interface SyncResult {
  success: boolean;
  message: string;
  details?: any;
  error?: Error;
}

export interface DataChange {
  table: string;
  operation: 'INSERT' | 'UPDATE' | 'DELETE';
  data: any;
  timestamp: Date;
}

// Database Adapter Interface
export interface IDatabaseAdapter {
  connect(): Promise<boolean>;
  close(): Promise<void>;
  query<T = any>(sql: string, params?: any[]): Promise<T>;
  isConnected(): boolean;

  // Schema operations
  getTables(): Promise<TableInfo[]>;
  getColumns(tableName: string): Promise<ColumnInfo[]>;
  getIndexes(tableName: string): Promise<IndexInfo[]>;
  getProcedures(type: 'PROCEDURE' | 'FUNCTION'): Promise<ProcedureInfo[]>;
  getTriggers(): Promise<any[]>;

  // Table operations
  createTable(createStatement: string): Promise<void>;
  alterTable(alterStatement: string): Promise<void>;
  dropTable(tableName: string): Promise<void>;
  truncateTable(tableName: string): Promise<void>;

  // Data operations
  countRows(tableName: string): Promise<number>;
  selectAll(tableName: string): Promise<any[]>;
  selectWhere(tableName: string, column: string, value: any): Promise<any[]>;
  upsertRows(tableName: string, rows: any[], primaryKey?: string): Promise<void>;
  insertRows(tableName: string, rows: any[]): Promise<void>;

  // Utility
  escapeIdentifier(identifier: string): string;
  getPrimaryKey(tableName: string): Promise<string | null>;
}
