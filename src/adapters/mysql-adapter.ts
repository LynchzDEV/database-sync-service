import mysql from 'mysql2/promise';
import { DatabaseConfig, IDatabaseAdapter, TableInfo, ColumnInfo, IndexInfo, ProcedureInfo } from '../types';
import logger from '../utils/logger';

export class MySQLAdapter implements IDatabaseAdapter {
  private config: mysql.PoolOptions;
  private pool: mysql.Pool | null = null;

  constructor(config: DatabaseConfig) {
    this.config = {
      host: config.host,
      port: config.port || 3306,
      user: config.user,
      password: config.password,
      database: config.database,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    };
  }

  async connect(): Promise<boolean> {
    try {
      this.pool = mysql.createPool(this.config);
      // Test connection
      const connection = await this.pool.getConnection();
      connection.release();
      return true;
    } catch (error) {
      throw new Error(`Failed to connect to MySQL database: ${(error as Error).message}`);
    }
  }

  async close(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }
  }

  async query<T = any>(sql: string, params: any[] = []): Promise<T> {
    if (!this.pool) {
      throw new Error('Database not connected');
    }
    try {
      const [rows] = await this.pool.execute(sql, params);
      return rows as T;
    } catch (error) {
      throw new Error(`Query failed: ${(error as Error).message}`);
    }
  }

  isConnected(): boolean {
    return this.pool !== null;
  }

  async getTables(): Promise<TableInfo[]> {
    const query = `
      SELECT
        TABLE_NAME as tableName,
        ENGINE as engine,
        TABLE_COLLATION as collation
      FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_TYPE = 'BASE TABLE'
    `;

    const tables = await this.query<any[]>(query);

    // Get CREATE statement for each table
    for (const table of tables) {
      const [createStmt] = await this.query<any[]>(`SHOW CREATE TABLE \`${table.tableName}\``);
      table.createStatement = createStmt['Create Table'];
    }

    return tables;
  }

  async getColumns(tableName: string): Promise<ColumnInfo[]> {
    return await this.query<ColumnInfo[]>(`DESCRIBE \`${tableName}\``);
  }

  async getIndexes(tableName: string): Promise<IndexInfo[]> {
    return await this.query<IndexInfo[]>(`SHOW INDEX FROM \`${tableName}\``);
  }

  async getProcedures(type: 'PROCEDURE' | 'FUNCTION'): Promise<ProcedureInfo[]> {
    const query = `
      SELECT
        ROUTINE_NAME as name,
        ROUTINE_TYPE as type,
        DEFINER as definer,
        CREATED as created,
        LAST_ALTERED as modified,
        SQL_MODE as sqlMode
      FROM information_schema.ROUTINES
      WHERE ROUTINE_SCHEMA = DATABASE()
      AND ROUTINE_TYPE = ?
    `;

    const routines = await this.query<any[]>(query, [type]);

    // Get CREATE statement for each routine
    for (const routine of routines) {
      try {
        const [createStmt] = await this.query<any[]>(
          `SHOW CREATE ${type} \`${routine.name}\``
        );
        const columnName = type === 'PROCEDURE' ? 'Create Procedure' : 'Create Function';
        routine.createStatement = createStmt[columnName];
      } catch (error) {
        logger.warn(`Could not get CREATE statement for ${type.toLowerCase()} ${routine.name}`);
        routine.createStatement = '';
      }
    }

    return routines;
  }

  async getTriggers(): Promise<any[]> {
    const query = `
      SELECT
        TRIGGER_NAME as name,
        EVENT_MANIPULATION as event,
        EVENT_OBJECT_TABLE as tableName,
        ACTION_TIMING as timing
      FROM information_schema.TRIGGERS
      WHERE TRIGGER_SCHEMA = DATABASE()
    `;

    const triggers = await this.query<any[]>(query);

    for (const trigger of triggers) {
      try {
        const [createStmt] = await this.query<any[]>(`SHOW CREATE TRIGGER \`${trigger.name}\``);
        trigger.createStatement = createStmt['SQL Original Statement'];
      } catch (error) {
        logger.warn(`Could not get CREATE statement for trigger ${trigger.name}`);
        trigger.createStatement = '';
      }
    }

    return triggers;
  }

  async createTable(createStatement: string): Promise<void> {
    await this.query(createStatement);
  }

  async alterTable(alterStatement: string): Promise<void> {
    await this.query(alterStatement);
  }

  async dropTable(tableName: string): Promise<void> {
    await this.query(`DROP TABLE IF EXISTS \`${tableName}\``);
  }

  async truncateTable(tableName: string): Promise<void> {
    await this.query(`TRUNCATE TABLE \`${tableName}\``);
  }

  async countRows(tableName: string): Promise<number> {
    const [result] = await this.query<any[]>(`SELECT COUNT(*) as count FROM \`${tableName}\``);
    return result.count;
  }

  async selectAll(tableName: string): Promise<any[]> {
    return await this.query<any[]>(`SELECT * FROM \`${tableName}\``);
  }

  async selectWhere(tableName: string, column: string, value: any): Promise<any[]> {
    return await this.query<any[]>(
      `SELECT * FROM \`${tableName}\` WHERE \`${column}\` > ?`,
      [value]
    );
  }

  async upsertRows(tableName: string, rows: any[], primaryKey?: string): Promise<void> {
    if (rows.length === 0) return;

    const columns = Object.keys(rows[0]);
    const placeholders = columns.map(() => '?').join(', ');

    const updateClause = primaryKey
      ? columns
          .filter(col => col !== primaryKey)
          .map(col => `\`${col}\` = VALUES(\`${col}\`)`)
          .join(', ')
      : '';

    for (const row of rows) {
      const sql = `
        INSERT INTO \`${tableName}\` (${columns.map(c => `\`${c}\``).join(', ')})
        VALUES (${placeholders})
        ${updateClause ? `ON DUPLICATE KEY UPDATE ${updateClause}` : ''}
      `;

      const values = columns.map(col => row[col]);
      await this.query(sql, values);
    }
  }

  async insertRows(tableName: string, rows: any[]): Promise<void> {
    if (rows.length === 0) return;

    const columns = Object.keys(rows[0]);
    const placeholders = columns.map(() => '?').join(', ');

    for (const row of rows) {
      const sql = `
        REPLACE INTO \`${tableName}\` (${columns.map(c => `\`${c}\``).join(', ')})
        VALUES (${placeholders})
      `;

      const values = columns.map(col => row[col]);
      await this.query(sql, values);
    }
  }

  escapeIdentifier(identifier: string): string {
    return `\`${identifier.replace(/`/g, '``')}\``;
  }

  async getPrimaryKey(tableName: string): Promise<string | null> {
    const columns = await this.getColumns(tableName);
    const pkColumn = columns.find(col => col.Key === 'PRI');
    return pkColumn ? pkColumn.Field : null;
  }
}
