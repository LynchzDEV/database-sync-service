import { DatabaseConnection } from '../../utils/db-connection';
import { TableInfo, ColumnInfo, IndexInfo, SyncResult } from '../../types';
import logger from '../../utils/logger';

export class SchemaSync {
  constructor(
    private source: DatabaseConnection,
    private target: DatabaseConnection,
    private includeTables: string[] = [],
    private excludeTables: string[] = []
  ) {}

  async syncSchema(): Promise<SyncResult> {
    try {
      logger.info('Starting schema synchronization...');

      // Get list of tables from source
      const sourceTables = await this.getTables(this.source);
      const targetTables = await this.getTables(this.target);

      const filteredTables = this.filterTables(sourceTables);

      logger.info(`Found ${filteredTables.length} tables to sync`);

      const results = {
        tablesCreated: 0,
        tablesModified: 0,
        tablesDropped: 0,
        errors: [] as string[]
      };

      // Create or update tables
      for (const sourceTable of filteredTables) {
        try {
          const targetTableExists = targetTables.some(t => t.tableName === sourceTable.tableName);

          if (!targetTableExists) {
            // Create new table
            await this.createTable(sourceTable);
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

  private async getTables(db: DatabaseConnection): Promise<TableInfo[]> {
    const query = `
      SELECT
        TABLE_NAME as tableName,
        ENGINE as engine,
        TABLE_COLLATION as collation
      FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_TYPE = 'BASE TABLE'
    `;

    const tables = await db.query<any[]>(query);

    // Get CREATE statement for each table
    for (const table of tables) {
      const [createStmt] = await db.query<any[]>(`SHOW CREATE TABLE \`${table.tableName}\``);
      table.createStatement = createStmt['Create Table'];
    }

    return tables;
  }

  private async createTable(table: TableInfo): Promise<void> {
    await this.target.query(table.createStatement);
  }

  private async compareTableStructure(tableName: string): Promise<boolean> {
    try {
      // Get columns from both databases
      const sourceColumns = await this.getColumns(this.source, tableName);
      const targetColumns = await this.getColumns(this.target, tableName);

      // Compare columns
      if (JSON.stringify(sourceColumns) !== JSON.stringify(targetColumns)) {
        return true;
      }

      // Get indexes from both databases
      const sourceIndexes = await this.getIndexes(this.source, tableName);
      const targetIndexes = await this.getIndexes(this.target, tableName);

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

  private async getColumns(db: DatabaseConnection, tableName: string): Promise<ColumnInfo[]> {
    return await db.query<ColumnInfo[]>(`DESCRIBE \`${tableName}\``);
  }

  private async getIndexes(db: DatabaseConnection, tableName: string): Promise<IndexInfo[]> {
    return await db.query<IndexInfo[]>(`SHOW INDEX FROM \`${tableName}\``);
  }

  private async updateTableStructure(tableName: string): Promise<void> {
    try {
      const sourceColumns = await this.getColumns(this.source, tableName);
      const targetColumns = await this.getColumns(this.target, tableName);

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

      // Sync indexes
      await this.syncIndexes(tableName);
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

    const sql = `ALTER TABLE \`${tableName}\` ADD COLUMN \`${column.Field}\` ${column.Type} ${nullable} ${defaultValue} ${extra}`.trim();
    await this.target.query(sql);
    logger.info(`Added column ${column.Field} to table ${tableName}`);
  }

  private async modifyColumn(tableName: string, column: ColumnInfo): Promise<void> {
    const nullable = column.Null === 'YES' ? 'NULL' : 'NOT NULL';
    const defaultValue = column.Default !== null ? `DEFAULT ${column.Default}` : '';
    const extra = column.Extra || '';

    const sql = `ALTER TABLE \`${tableName}\` MODIFY COLUMN \`${column.Field}\` ${column.Type} ${nullable} ${defaultValue} ${extra}`.trim();
    await this.target.query(sql);
    logger.info(`Modified column ${column.Field} in table ${tableName}`);
  }

  private async dropColumn(tableName: string, columnName: string): Promise<void> {
    const sql = `ALTER TABLE \`${tableName}\` DROP COLUMN \`${columnName}\``;
    await this.target.query(sql);
    logger.info(`Dropped column ${columnName} from table ${tableName}`);
  }

  private async syncIndexes(tableName: string): Promise<void> {
    const sourceIndexes = await this.getIndexes(this.source, tableName);
    const targetIndexes = await this.getIndexes(this.target, tableName);

    // Group indexes by name
    const sourceIndexMap = this.groupIndexesByName(sourceIndexes);
    const targetIndexMap = this.groupIndexesByName(targetIndexes);

    // Drop indexes that don't exist in source (except PRIMARY)
    for (const indexName of Object.keys(targetIndexMap)) {
      if (indexName !== 'PRIMARY' && !sourceIndexMap[indexName]) {
        await this.target.query(`ALTER TABLE \`${tableName}\` DROP INDEX \`${indexName}\``);
        logger.info(`Dropped index ${indexName} from table ${tableName}`);
      }
    }

    // Add indexes that don't exist in target
    for (const indexName of Object.keys(sourceIndexMap)) {
      if (indexName !== 'PRIMARY' && !targetIndexMap[indexName]) {
        await this.createIndex(tableName, indexName, sourceIndexMap[indexName]);
      }
    }
  }

  private groupIndexesByName(indexes: IndexInfo[]): { [key: string]: IndexInfo[] } {
    const grouped: { [key: string]: IndexInfo[] } = {};
    for (const index of indexes) {
      if (!grouped[index.Key_name]) {
        grouped[index.Key_name] = [];
      }
      grouped[index.Key_name].push(index);
    }
    return grouped;
  }

  private async createIndex(tableName: string, indexName: string, indexParts: IndexInfo[]): Promise<void> {
    const isUnique = indexParts[0].Non_unique === 0;
    const columns = indexParts
      .sort((a, b) => a.Seq_in_index - b.Seq_in_index)
      .map(i => `\`${i.Column_name}\``)
      .join(', ');

    const sql = `ALTER TABLE \`${tableName}\` ADD ${isUnique ? 'UNIQUE' : ''} INDEX \`${indexName}\` (${columns})`;
    await this.target.query(sql);
    logger.info(`Created index ${indexName} on table ${tableName}`);
  }
}
