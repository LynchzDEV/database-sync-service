import { DatabaseConnection } from '../../utils/database-wrapper';
import { TableInfo, ColumnInfo, IndexInfo, SyncResult, IDatabaseAdapter } from '../../types';
import logger from '../../utils/logger';

export class SchemaSync {
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

  async syncSchema(): Promise<SyncResult> {
    try {
      logger.info('Starting schema synchronization...');

      // Get list of tables from source
      const sourceTables = await this.sourceAdapter.getTables();
      const targetTables = await this.targetAdapter.getTables();

      const filteredTables = this.filterTables(sourceTables);

      logger.info(`Found ${filteredTables.length} tables to sync`);

      const results = {
        tablesCreated: 0,
        tablesModified: 0,
        errors: [] as string[]
      };

      // Create or update tables
      for (const sourceTable of filteredTables) {
        try {
          const targetTableExists = targetTables.some(t => t.tableName === sourceTable.tableName);

          if (!targetTableExists) {
            // Create new table
            await this.targetAdapter.createTable(sourceTable.createStatement);
            results.tablesCreated++;
            logger.info(`Created table: ${sourceTable.tableName}`);
          } else {
            // Check if table structure needs update
            const needsUpdate = await this.compareTableStructure(sourceTable.tableName);
            if (needsUpdate) {
              await this.updateTableStructure(sourceTable.tableName);
              results.tablesModified++;
              logger.info(`Updated table: ${sourceTable.tableName}`);
            }
          }
        } catch (error) {
          const errorMsg = `Error syncing table ${sourceTable.tableName}: ${(error as Error).message}`;
          logger.error(errorMsg);
          results.errors.push(errorMsg);
        }
      }

      logger.info('Schema synchronization completed', results);

      return {
        success: results.errors.length === 0,
        message: `Schema sync completed. Created: ${results.tablesCreated}, Modified: ${results.tablesModified}`,
        details: results
      };
    } catch (error) {
      logger.error('Schema synchronization failed', error);
      return {
        success: false,
        message: 'Schema synchronization failed',
        error: error as Error
      };
    }
  }

  private filterTables(tables: TableInfo[]): TableInfo[] {
    let filtered = tables;

    // Apply include filter if specified
    if (this.includeTables.length > 0) {
      filtered = filtered.filter(t => this.includeTables.includes(t.tableName));
    }

    // Apply exclude filter
    if (this.excludeTables.length > 0) {
      filtered = filtered.filter(t => !this.excludeTables.includes(t.tableName));
    }

    return filtered;
  }

  private async compareTableStructure(tableName: string): Promise<boolean> {
    try {
      // Get columns from both databases
      const sourceColumns = await this.sourceAdapter.getColumns(tableName);
      const targetColumns = await this.targetAdapter.getColumns(tableName);

      // Compare columns
      if (JSON.stringify(sourceColumns) !== JSON.stringify(targetColumns)) {
        return true;
      }

      // Get indexes from both databases
      const sourceIndexes = await this.sourceAdapter.getIndexes(tableName);
      const targetIndexes = await this.targetAdapter.getIndexes(tableName);

      // Compare indexes
      if (JSON.stringify(sourceIndexes) !== JSON.stringify(targetIndexes)) {
        return true;
      }

      return false;
    } catch (error) {
      logger.error(`Error comparing table structure for ${tableName}:`, error);
      return false;
    }
  }

  private async updateTableStructure(tableName: string): Promise<void> {
    try {
      const sourceColumns = await this.sourceAdapter.getColumns(tableName);
      const targetColumns = await this.targetAdapter.getColumns(tableName);

      // Find columns to add
      for (const sourceCol of sourceColumns) {
        const existsInTarget = targetColumns.some(t => t.Field === sourceCol.Field);
        if (!existsInTarget) {
          await this.addColumn(tableName, sourceCol);
        } else {
          // Check if column definition changed
          const targetCol = targetColumns.find(t => t.Field === sourceCol.Field);
          if (targetCol && !this.columnsMatch(sourceCol, targetCol)) {
            await this.modifyColumn(tableName, sourceCol);
          }
        }
      }

      // Find columns to drop
      for (const targetCol of targetColumns) {
        const existsInSource = sourceColumns.some(s => s.Field === targetCol.Field);
        if (!existsInSource) {
          await this.dropColumn(tableName, targetCol.Field);
        }
      }
    } catch (error) {
      throw new Error(`Failed to update table structure for ${tableName}: ${(error as Error).message}`);
    }
  }

  private columnsMatch(col1: ColumnInfo, col2: ColumnInfo): boolean {
    return (
      col1.Type === col2.Type &&
      col1.Null === col2.Null &&
      col1.Key === col2.Key &&
      col1.Default === col2.Default &&
      col1.Extra === col2.Extra
    );
  }

  private async addColumn(tableName: string, column: ColumnInfo): Promise<void> {
    const nullable = column.Null === 'YES' ? 'NULL' : 'NOT NULL';
    const defaultValue = column.Default !== null ? `DEFAULT ${column.Default}` : '';
    const extra = column.Extra || '';

    const escaped = this.targetAdapter.escapeIdentifier;
    const sql = `ALTER TABLE ${escaped(tableName)} ADD COLUMN ${escaped(column.Field)} ${column.Type} ${nullable} ${defaultValue} ${extra}`.trim();
    await this.targetAdapter.alterTable(sql);
    logger.info(`Added column ${column.Field} to table ${tableName}`);
  }

  private async modifyColumn(tableName: string, column: ColumnInfo): Promise<void> {
    const nullable = column.Null === 'YES' ? 'NULL' : 'NOT NULL';
    const defaultValue = column.Default !== null ? `DEFAULT ${column.Default}` : '';
    const extra = column.Extra || '';

    const escaped = this.targetAdapter.escapeIdentifier;
    const sql = `ALTER TABLE ${escaped(tableName)} MODIFY COLUMN ${escaped(column.Field)} ${column.Type} ${nullable} ${defaultValue} ${extra}`.trim();
    await this.targetAdapter.alterTable(sql);
    logger.info(`Modified column ${column.Field} in table ${tableName}`);
  }

  private async dropColumn(tableName: string, columnName: string): Promise<void> {
    const escaped = this.targetAdapter.escapeIdentifier;
    const sql = `ALTER TABLE ${escaped(tableName)} DROP COLUMN ${escaped(columnName)}`;
    await this.targetAdapter.alterTable(sql);
    logger.info(`Dropped column ${columnName} from table ${tableName}`);
  }
}
