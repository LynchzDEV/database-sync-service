import { DatabaseConnection } from '../../utils/db-connection';
import { SyncResult } from '../../types';
import logger from '../../utils/logger';

interface TableSyncState {
  lastSyncTime: Date;
  rowCount: number;
}

export class DataSync {
  private syncState: Map<string, TableSyncState> = new Map();

  constructor(
    private source: DatabaseConnection,
    private target: DatabaseConnection,
    private includeTables: string[] = [],
    private excludeTables: string[] = []
  ) {}

  async syncData(): Promise<SyncResult> {
    try {
      logger.info('Starting data synchronization...');

      const tables = await this.getTablesToSync();
      let totalRowsSynced = 0;
      const errors: string[] = [];

      for (const tableName of tables) {
        try {
          const rowsSynced = await this.syncTable(tableName);
          totalRowsSynced += rowsSynced;

          if (rowsSynced > 0) {
            logger.info(`Synced ${rowsSynced} rows for table: ${tableName}`);
          }
        } catch (error) {
          const errorMsg = `Error syncing table ${tableName}: ${(error as Error).message}`;
          logger.error(errorMsg);
          errors.push(errorMsg);
        }
      }

      return {
        success: errors.length === 0,
        message: `Data sync completed. Total rows synced: ${totalRowsSynced}`,
        details: { totalRowsSynced, errors }
      };
    } catch (error) {
      logger.error('Data synchronization failed', error);
      return {
        success: false,
        message: 'Data synchronization failed',
        error: error as Error
      };
    }
  }

  async initialSync(): Promise<SyncResult> {
    try {
      logger.info('Starting initial data synchronization...');

      const tables = await this.getTablesToSync();
      let totalRowsSynced = 0;
      const errors: string[] = [];

      for (const tableName of tables) {
        try {
          // Check if target table is empty
          const [targetCount] = await this.target.query<any[]>(
            `SELECT COUNT(*) as count FROM \`${tableName}\``
          );

          if (targetCount.count === 0) {
            // Perform full sync
            const rowsSynced = await this.fullTableSync(tableName);
            totalRowsSynced += rowsSynced;
            logger.info(`Initial sync: ${rowsSynced} rows for table: ${tableName}`);

            // Initialize sync state
            this.syncState.set(tableName, {
              lastSyncTime: new Date(),
              rowCount: rowsSynced
            });
          }
        } catch (error) {
          const errorMsg = `Error in initial sync for table ${tableName}: ${(error as Error).message}`;
          logger.error(errorMsg);
          errors.push(errorMsg);
        }
      }

      return {
        success: errors.length === 0,
        message: `Initial sync completed. Total rows synced: ${totalRowsSynced}`,
        details: { totalRowsSynced, errors }
      };
    } catch (error) {
      logger.error('Initial data synchronization failed', error);
      return {
        success: false,
        message: 'Initial data synchronization failed',
        error: error as Error
      };
    }
  }

  private async getTablesToSync(): Promise<string[]> {
    const query = `
      SELECT TABLE_NAME as tableName
      FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_TYPE = 'BASE TABLE'
    `;

    const tables = await this.source.query<any[]>(query);
    let tableNames = tables.map(t => t.tableName);

    // Apply filters
    if (this.includeTables.length > 0) {
      tableNames = tableNames.filter(t => this.includeTables.includes(t));
    }

    if (this.excludeTables.length > 0) {
      tableNames = tableNames.filter(t => !this.excludeTables.includes(t));
    }

    return tableNames;
  }

  private async syncTable(tableName: string): Promise<number> {
    // Check if table has timestamp column for tracking changes
    const hasTimestamp = await this.hasTimestampColumn(tableName);

    if (hasTimestamp) {
      return await this.timestampBasedSync(tableName);
    } else {
      // Fall back to row count comparison
      return await this.rowCountBasedSync(tableName);
    }
  }

  private async hasTimestampColumn(tableName: string): Promise<boolean> {
    const columns = await this.source.query<any[]>(`DESCRIBE \`${tableName}\``);
    return columns.some(col =>
      ['updated_at', 'modified_at', 'timestamp', 'last_modified'].includes(col.Field.toLowerCase()) ||
      col.Type.includes('timestamp')
    );
  }

  private async timestampBasedSync(tableName: string): Promise<number> {
    const state = this.syncState.get(tableName);
    const timestampColumn = await this.getTimestampColumn(tableName);

    if (!timestampColumn) {
      return 0;
    }

    let query: string;
    if (state) {
      // Incremental sync - get rows changed since last sync
      query = `SELECT * FROM \`${tableName}\` WHERE \`${timestampColumn}\` > ?`;
    } else {
      // First sync - get all rows
      query = `SELECT * FROM \`${tableName}\``;
    }

    const params = state ? [state.lastSyncTime] : [];
    const rows = await this.source.query<any[]>(query, params);

    if (rows.length > 0) {
      await this.upsertRows(tableName, rows);

      // Update sync state
      this.syncState.set(tableName, {
        lastSyncTime: new Date(),
        rowCount: rows.length
      });
    }

    return rows.length;
  }

  private async getTimestampColumn(tableName: string): Promise<string | null> {
    const columns = await this.source.query<any[]>(`DESCRIBE \`${tableName}\``);
    const timestampCol = columns.find(col =>
      ['updated_at', 'modified_at', 'timestamp', 'last_modified'].includes(col.Field.toLowerCase()) ||
      col.Type.includes('timestamp')
    );
    return timestampCol ? timestampCol.Field : null;
  }

  private async rowCountBasedSync(tableName: string): Promise<number> {
    const [sourceCount] = await this.source.query<any[]>(
      `SELECT COUNT(*) as count FROM \`${tableName}\``
    );
    const [targetCount] = await this.target.query<any[]>(
      `SELECT COUNT(*) as count FROM \`${tableName}\``
    );

    if (sourceCount.count !== targetCount.count) {
      // Full sync required
      return await this.fullTableSync(tableName);
    }

    return 0;
  }

  private async fullTableSync(tableName: string): Promise<number> {
    // Clear target table
    await this.target.query(`TRUNCATE TABLE \`${tableName}\``);

    // Get all rows from source
    const rows = await this.source.query<any[]>(`SELECT * FROM \`${tableName}\``);

    if (rows.length > 0) {
      await this.insertRows(tableName, rows);
    }

    return rows.length;
  }

  private async upsertRows(tableName: string, rows: any[]): Promise<void> {
    if (rows.length === 0) return;

    const primaryKey = await this.getPrimaryKey(tableName);

    if (!primaryKey) {
      // No primary key, use REPLACE INTO
      await this.insertRows(tableName, rows);
      return;
    }

    // Use INSERT ... ON DUPLICATE KEY UPDATE
    const columns = Object.keys(rows[0]);
    const placeholders = columns.map(() => '?').join(', ');

    const updateClause = columns
      .filter(col => col !== primaryKey)
      .map(col => `\`${col}\` = VALUES(\`${col}\`)`)
      .join(', ');

    for (const row of rows) {
      const sql = `
        INSERT INTO \`${tableName}\` (${columns.map(c => `\`${c}\``).join(', ')})
        VALUES (${placeholders})
        ${updateClause ? `ON DUPLICATE KEY UPDATE ${updateClause}` : ''}
      `;

      const values = columns.map(col => row[col]);
      await this.target.query(sql, values);
    }
  }

  private async insertRows(tableName: string, rows: any[]): Promise<void> {
    if (rows.length === 0) return;

    const columns = Object.keys(rows[0]);
    const placeholders = columns.map(() => '?').join(', ');

    for (const row of rows) {
      const sql = `
        REPLACE INTO \`${tableName}\` (${columns.map(c => `\`${c}\``).join(', ')})
        VALUES (${placeholders})
      `;

      const values = columns.map(col => row[col]);
      await this.target.query(sql, values);
    }
  }

  private async getPrimaryKey(tableName: string): Promise<string | null> {
    const columns = await this.target.query<any[]>(`DESCRIBE \`${tableName}\``);
    const pkColumn = columns.find(col => col.Key === 'PRI');
    return pkColumn ? pkColumn.Field : null;
  }

  resetSyncState(): void {
    this.syncState.clear();
    logger.info('Sync state reset');
  }
}
