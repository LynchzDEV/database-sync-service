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

    let totalRowsAffected = 0;

    // 1. Handle INSERT and UPDATE operations
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
      totalRowsAffected += rows.length;
      logger.debug(`Upserted ${rows.length} rows in table: ${tableName}`);
    }

    // 2. Handle DELETE operations by comparing primary keys
    const primaryKey = await this.targetAdapter.getPrimaryKey(tableName);
    if (primaryKey) {
      const deletedCount = await this.detectAndSyncDeletes(tableName, primaryKey);
      totalRowsAffected += deletedCount;
      if (deletedCount > 0) {
        logger.info(`Deleted ${deletedCount} rows from table: ${tableName}`);
      }
    }

    // Update sync state
    if (totalRowsAffected > 0 || state) {
      this.syncState.set(tableName, {
        lastSyncTime: new Date(),
        rowCount: totalRowsAffected
      });
    }

    return totalRowsAffected;
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
      // Check if we have a primary key for selective sync
      const primaryKey = await this.targetAdapter.getPrimaryKey(tableName);

      if (primaryKey && Math.abs(sourceCount - targetCount) < sourceCount * 0.5) {
        // If difference is less than 50%, do selective sync (more efficient)
        let totalRowsAffected = 0;

        // Sync new/updated rows
        const sourceRows = await this.sourceAdapter.selectAll(tableName);
        if (sourceRows.length > 0) {
          await this.targetAdapter.upsertRows(tableName, sourceRows, primaryKey);
          totalRowsAffected += sourceRows.length;
        }

        // Sync deletions
        const deletedCount = await this.detectAndSyncDeletes(tableName, primaryKey);
        totalRowsAffected += deletedCount;

        return totalRowsAffected;
      } else {
        // Large difference or no primary key - do full sync
        return await this.fullTableSync(tableName);
      }
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

  private async detectAndSyncDeletes(tableName: string, primaryKey: string): Promise<number> {
    try {
      // Get all primary keys from source
      const sourceRows = await this.sourceAdapter.query(
        `SELECT ${this.sourceAdapter.escapeIdentifier(primaryKey)} FROM ${this.sourceAdapter.escapeIdentifier(tableName)}`
      );
      const sourcePKs = new Set(sourceRows.map((row: any) => row[primaryKey]));

      // Get all primary keys from target
      const targetRows = await this.targetAdapter.query(
        `SELECT ${this.targetAdapter.escapeIdentifier(primaryKey)} FROM ${this.targetAdapter.escapeIdentifier(tableName)}`
      );
      const targetPKs = targetRows.map((row: any) => row[primaryKey]);

      // Find primary keys that exist in target but not in source (deleted rows)
      const deletedPKs = targetPKs.filter((pk: any) => !sourcePKs.has(pk));

      if (deletedPKs.length > 0) {
        // Delete these rows from target in batches
        const batchSize = 100;
        for (let i = 0; i < deletedPKs.length; i += batchSize) {
          const batch = deletedPKs.slice(i, i + batchSize);
          const placeholders = batch.map((_: any, idx: number) => `$${idx + 1}`).join(',');

          // Handle different placeholder syntax for MySQL vs PostgreSQL
          const dbType = this.targetAdapter.constructor.name.toLowerCase();
          let deleteQuery: string;

          if (dbType.includes('postgres')) {
            deleteQuery = `DELETE FROM ${this.targetAdapter.escapeIdentifier(tableName)}
                          WHERE ${this.targetAdapter.escapeIdentifier(primaryKey)} IN (${placeholders})`;
            await this.targetAdapter.query(deleteQuery, batch);
          } else {
            // MySQL uses ? placeholders
            const mysqlPlaceholders = batch.map(() => '?').join(',');
            deleteQuery = `DELETE FROM ${this.targetAdapter.escapeIdentifier(tableName)}
                          WHERE ${this.targetAdapter.escapeIdentifier(primaryKey)} IN (${mysqlPlaceholders})`;
            await this.targetAdapter.query(deleteQuery, batch);
          }
        }

        logger.debug(`Detected and synced ${deletedPKs.length} deletions in table: ${tableName}`);
      }

      return deletedPKs.length;
    } catch (error) {
      logger.error(`Error detecting deletes for table ${tableName}:`, error);
      return 0;
    }
  }

  resetSyncState(): void {
    this.syncState.clear();
    logger.info('Sync state reset');
  }
}
