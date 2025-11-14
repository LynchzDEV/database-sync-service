import { Pool, PoolConfig } from 'pg';
import { DatabaseConfig, IDatabaseAdapter, TableInfo, ColumnInfo, IndexInfo, ProcedureInfo } from '../types';
import logger from '../utils/logger';

export class PostgreSQLAdapter implements IDatabaseAdapter {
  private config: PoolConfig;
  private pool: Pool | null = null;

  constructor(config: DatabaseConfig) {
    this.config = {
      host: config.host,
      port: config.port || 5432,
      user: config.user,
      password: config.password,
      database: config.database,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    };
  }

  async connect(): Promise<boolean> {
    try {
      this.pool = new Pool(this.config);
      // Test connection
      const client = await this.pool.connect();
      client.release();
      return true;
    } catch (error) {
      throw new Error(`Failed to connect to PostgreSQL database: ${(error as Error).message}`);
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
      const result = await this.pool.query(sql, params);
      return result.rows as T;
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
        table_name as "tableName",
        '' as engine,
        '' as collation
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `;

    const tables = await this.query<any[]>(query);

    // Get CREATE statement for each table (PostgreSQL version)
    for (const table of tables) {
      try {
        // Get table definition with more details
        const columnsQuery = `
          SELECT
            c.column_name,
            c.data_type,
            c.character_maximum_length,
            c.numeric_precision,
            c.numeric_scale,
            c.is_nullable,
            c.column_default,
            CASE WHEN pk.column_name IS NOT NULL THEN true ELSE false END as is_primary_key
          FROM information_schema.columns c
          LEFT JOIN (
            SELECT ku.column_name
            FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage ku
              ON tc.constraint_name = ku.constraint_name
              AND tc.table_schema = ku.table_schema
            WHERE tc.constraint_type = 'PRIMARY KEY'
            AND tc.table_schema = 'public'
            AND tc.table_name = $1
          ) pk ON c.column_name = pk.column_name
          WHERE c.table_schema = 'public'
          AND c.table_name = $1
          ORDER BY c.ordinal_position
        `;
        const columns = await this.query<any[]>(columnsQuery, [table.tableName]);

        // Build CREATE TABLE statement
        const columnDefs = columns.map((col: any) => {
          let def = `  "${col.column_name}"`;

          // Handle SERIAL types
          if (col.column_default && col.column_default.startsWith('nextval')) {
            if (col.data_type === 'integer') {
              def += ' SERIAL';
            } else if (col.data_type === 'bigint') {
              def += ' BIGSERIAL';
            } else {
              def += ` ${col.data_type.toUpperCase()}`;
            }
          } else {
            // Regular data type
            let typeStr = col.data_type.toUpperCase();
            if (col.character_maximum_length) {
              typeStr += `(${col.character_maximum_length})`;
            } else if (col.numeric_precision && col.data_type.includes('numeric')) {
              typeStr += `(${col.numeric_precision}${col.numeric_scale ? ',' + col.numeric_scale : ''})`;
            }
            def += ` ${typeStr}`;

            // Add default if not a sequence
            if (col.column_default && !col.column_default.startsWith('nextval')) {
              def += ` DEFAULT ${col.column_default}`;
            }
          }

          // Add NOT NULL
          if (col.is_nullable === 'NO') {
            def += ' NOT NULL';
          }

          // Add PRIMARY KEY
          if (col.is_primary_key) {
            def += ' PRIMARY KEY';
          }

          return def;
        }).join(',\n');

        table.createStatement = `CREATE TABLE IF NOT EXISTS "${table.tableName}" (\n${columnDefs}\n)`;
      } catch (error) {
        logger.warn(`Could not generate CREATE statement for table ${table.tableName}`);
        table.createStatement = '';
      }
    }

    return tables;
  }

  async getColumns(tableName: string): Promise<ColumnInfo[]> {
    const query = `
      SELECT
        c.column_name as "Field",
        c.data_type as "Type",
        c.is_nullable as "Null",
        CASE WHEN pk.col_name IS NOT NULL THEN 'PRI' ELSE '' END as "Key",
        c.column_default as "Default",
        '' as "Extra"
      FROM information_schema.columns c
      LEFT JOIN (
        SELECT ku.column_name as col_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage ku
          ON tc.constraint_name = ku.constraint_name
          AND tc.table_schema = ku.table_schema
        WHERE tc.constraint_type = 'PRIMARY KEY'
        AND tc.table_schema = 'public'
        AND tc.table_name = $1
      ) pk ON c.column_name = pk.col_name
      WHERE c.table_schema = 'public'
      AND c.table_name = $1
      ORDER BY c.ordinal_position
    `;

    return await this.query<ColumnInfo[]>(query, [tableName]);
  }

  async getIndexes(tableName: string): Promise<IndexInfo[]> {
    const query = `
      SELECT
        t.relname as "Table",
        CASE WHEN ix.indisunique THEN 0 ELSE 1 END as "Non_unique",
        i.relname as "Key_name",
        a.attnum as "Seq_in_index",
        a.attname as "Column_name",
        NULL as "Collation",
        NULL as "Cardinality",
        NULL as "Sub_part",
        NULL as "Packed",
        CASE WHEN a.attnotnull THEN '' ELSE 'YES' END as "Null",
        am.amname as "Index_type",
        '' as "Comment"
      FROM pg_class t
      JOIN pg_index ix ON t.oid = ix.indrelid
      JOIN pg_class i ON i.oid = ix.indexrelid
      JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(ix.indkey)
      JOIN pg_am am ON i.relam = am.oid
      WHERE t.relkind = 'r'
      AND t.relname = $1
      AND t.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
      ORDER BY i.relname, a.attnum
    `;

    return await this.query<IndexInfo[]>(query, [tableName]);
  }

  async getProcedures(type: 'PROCEDURE' | 'FUNCTION'): Promise<ProcedureInfo[]> {
    const pgType = type === 'PROCEDURE' ? 'procedure' : 'function';

    const query = `
      SELECT
        p.proname as name,
        CASE WHEN p.prokind = 'p' THEN 'PROCEDURE' ELSE 'FUNCTION' END as type,
        pg_get_userbyid(p.proowner) as definer,
        '' as created,
        '' as modified,
        '' as "sqlMode"
      FROM pg_proc p
      JOIN pg_namespace n ON p.pronamespace = n.oid
      WHERE n.nspname = 'public'
      AND p.prokind = $1
    `;

    const routines = await this.query<any[]>(query, [pgType === 'procedure' ? 'p' : 'f']);

    // Get CREATE statement for each routine
    for (const routine of routines) {
      try {
        const [def] = await this.query<any[]>(
          `SELECT pg_get_functiondef(oid) as def FROM pg_proc WHERE proname = $1 AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')`,
          [routine.name]
        );
        routine.createStatement = def?.def || '';
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
        t.tgname as name,
        CASE t.tgtype & 2 WHEN 2 THEN 'BEFORE' ELSE 'AFTER' END as timing,
        CASE
          WHEN t.tgtype & 4 = 4 THEN 'INSERT'
          WHEN t.tgtype & 8 = 8 THEN 'DELETE'
          WHEN t.tgtype & 16 = 16 THEN 'UPDATE'
        END as event,
        c.relname as "tableName",
        pg_get_triggerdef(t.oid) as "createStatement"
      FROM pg_trigger t
      JOIN pg_class c ON t.tgrelid = c.oid
      JOIN pg_namespace n ON c.relnamespace = n.oid
      WHERE n.nspname = 'public'
      AND NOT t.tgisinternal
    `;

    return await this.query<any[]>(query);
  }

  async createTable(createStatement: string): Promise<void> {
    await this.query(createStatement);
  }

  async alterTable(alterStatement: string): Promise<void> {
    await this.query(alterStatement);
  }

  async dropTable(tableName: string): Promise<void> {
    await this.query(`DROP TABLE IF EXISTS "${tableName}" CASCADE`);
  }

  async truncateTable(tableName: string): Promise<void> {
    await this.query(`TRUNCATE TABLE "${tableName}" CASCADE`);
  }

  async countRows(tableName: string): Promise<number> {
    const [result] = await this.query<any[]>(`SELECT COUNT(*) as count FROM "${tableName}"`);
    return parseInt(result.count, 10);
  }

  async selectAll(tableName: string): Promise<any[]> {
    return await this.query<any[]>(`SELECT * FROM "${tableName}"`);
  }

  async selectWhere(tableName: string, column: string, value: any): Promise<any[]> {
    return await this.query<any[]>(
      `SELECT * FROM "${tableName}" WHERE "${column}" > $1`,
      [value]
    );
  }

  async upsertRows(tableName: string, rows: any[], primaryKey?: string): Promise<void> {
    if (rows.length === 0) return;

    const columns = Object.keys(rows[0]);

    for (const row of rows) {
      if (primaryKey) {
        // Use INSERT ... ON CONFLICT for upsert
        const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
        const updateClause = columns
          .filter(col => col !== primaryKey)
          .map(col => `"${col}" = EXCLUDED."${col}"`)
          .join(', ');

        const sql = `
          INSERT INTO "${tableName}" (${columns.map(c => `"${c}"`).join(', ')})
          VALUES (${placeholders})
          ON CONFLICT ("${primaryKey}")
          DO UPDATE SET ${updateClause}
        `;

        const values = columns.map(col => row[col]);
        await this.query(sql, values);
      } else {
        // No primary key, just insert
        await this.insertRows(tableName, [row]);
      }
    }
  }

  async insertRows(tableName: string, rows: any[]): Promise<void> {
    if (rows.length === 0) return;

    const columns = Object.keys(rows[0]);

    for (const row of rows) {
      const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
      const sql = `
        INSERT INTO "${tableName}" (${columns.map(c => `"${c}"`).join(', ')})
        VALUES (${placeholders})
      `;

      const values = columns.map(col => row[col]);
      await this.query(sql, values);
    }
  }

  escapeIdentifier(identifier: string): string {
    return `"${identifier.replace(/"/g, '""')}"`;
  }

  async getPrimaryKey(tableName: string): Promise<string | null> {
    const query = `
      SELECT ku.column_name as "column_name"
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage ku
        ON tc.constraint_name = ku.constraint_name
        AND tc.table_schema = ku.table_schema
      WHERE tc.constraint_type = 'PRIMARY KEY'
      AND tc.table_schema = 'public'
      AND tc.table_name = $1
      LIMIT 1
    `;

    const [result] = await this.query<any[]>(query, [tableName]);
    return result?.column_name || null;
  }
}
