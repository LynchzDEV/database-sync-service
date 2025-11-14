import { DatabaseConnection } from '../../utils/database-wrapper';
import { SyncResult, IDatabaseAdapter } from '../../types';
import logger from '../../utils/logger';

interface TableSyncState {
  lastSyncTime: Date;
  rowCount: number;
}

export class DataSync {
  private syncState: Map<string, TableSyncState> = new Map();
  private sourceAdapter: IDatabaseAdapter;
  private targetAdapter: IDatabaseAdapter;

  constructor(
    private source: DatabaseConnection,
    private target: DatabaseConnection,
    private includeTables: string[] = [],
    private excludeTables: string[] = []
  ) {
    this.sourceAdapter = source.getAdapter();
    this.targetAdapter = target.getAdapter();
  }

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
          const targetCount = await this.targetAdapter.countRows(tableName);

          if (targetCount === 0) {
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
    const tables = await this.sourceAdapter.getTables();
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
    const columns = await this.sourceAdapter.getColumns(tableName);
    return columns.some(col =>
      ['updated_at', 'modified_at', 'timestamp', 'last_modified'].includes(col.Field.toLowerCase()) ||
      col.Type.toLowerCase().includes('timestamp')
    );
  }

  private async timestampBasedSync(tableName: string): Promise<number> {
    const state = this.syncState.get(tableName);
    const timestampColumn = await this.getTimestampColumn(tableName);

    if (!timestampColumn) {
      return 0;
    }

    let rows: any[];
    if (state) {
      // Incremental sync - get rows changed since last sync
      rows = await this.sourceAdapter.selectWhere(tableName, timestampColumn, state.lastSyncTime);
    } else {
      // First sync - get all rows
      rows = await this.sourceAdapter.selectAll(tableName);
    }

    if (rows.length > 0) {
      const primaryKey = await this.targetAdapter.getPrimaryKey(tableName);
      await this.targetAdapter.upsertRows(tableName, rows, primaryKey || undefined);

      // Update sync state
      this.syncState.set(tableName, {
        lastSyncTime: new Date(),
        rowCount: rows.length
      });
    }

    return rows.length;
  }

  private async getTimestampColumn(tableName: string): Promise<string | null> {
    const columns = await this.sourceAdapter.getColumns(tableName);
    const timestampCol = columns.find(col =>
      ['updated_at', 'modified_at', 'timestamp', 'last_modified'].includes(col.Field.toLowerCase()) ||
      col.Type.toLowerCase().includes('timestamp')
    );
    return timestampCol ? timestampCol.Field : null;
  }

  private async rowCountBasedSync(tableName: string): Promise<number> {
    const sourceCount = await this.sourceAdapter.countRows(tableName);
    const targetCount = await this.targetAdapter.countRows(tableName);

    if (sourceCount !== targetCount) {
      // Full sync required
      return await this.fullTableSync(tableName);
    }

    return 0;
  }

  private async fullTableSync(tableName: string): Promise<number> {
    // Clear target table
    await this.targetAdapter.truncateTable(tableName);

    // Get all rows from source
    const rows = await this.sourceAdapter.selectAll(tableName);

    if (rows.length > 0) {
      await this.targetAdapter.insertRows(tableName, rows);
    }

    return rows.length;
  }

  resetSyncState(): void {
    this.syncState.clear();
    logger.info('Sync state reset');
  }
}
