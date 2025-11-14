import { DatabaseConnection } from '../utils/database-wrapper';
import { SchemaSync } from '../modules/schema/schema-sync-v2';
import { DataSync } from '../modules/data/data-sync-v2';
import { ProceduresSync } from '../modules/procedures/procedures-sync-v2';
import { SyncPairConfig, ConnectionConfig, SyncSettings } from '../types';
import logger from '../utils/logger';
import configManager from '../config/config-manager';

export class SyncService {
  private sourceConnection: DatabaseConnection | null = null;
  private targetConnection: DatabaseConnection | null = null;
  private dataSync: DataSync | null = null;
  private isRunning: boolean = false;
  private dataIntervalId: NodeJS.Timeout | null = null;
  private schemaIntervalId: NodeJS.Timeout | null = null;

  constructor(
    private syncPair: SyncPairConfig,
    private sourceConfig: ConnectionConfig,
    private targetConfig: ConnectionConfig,
    private settings: SyncSettings
  ) {}

  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn(`Sync service for '${this.syncPair.name}' is already running`);
      return;
    }

    try {
      logger.info(`Starting sync service for '${this.syncPair.name}'`);

      // Connect to databases
      this.sourceConnection = new DatabaseConnection(this.sourceConfig);
      this.targetConnection = new DatabaseConnection(this.targetConfig);

      await this.sourceConnection.connect();
      await this.targetConnection.connect();

      logger.info(`Connected to source: ${this.sourceConfig.database}`);
      logger.info(`Connected to target: ${this.targetConfig.database}`);

      // Initialize data sync module
      this.dataSync = new DataSync(
        this.sourceConnection,
        this.targetConnection,
        this.syncPair.includeTables,
        this.syncPair.excludeTables
      );

      // Perform initial sync
      await this.performInitialSync();

      // Start real-time synchronization
      this.isRunning = true;
      this.startRealTimeSync();

      logger.info(`Sync service for '${this.syncPair.name}' started successfully`);
    } catch (error) {
      logger.error(`Failed to start sync service for '${this.syncPair.name}':`, error);
      await this.stop();
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    logger.info(`Stopping sync service for '${this.syncPair.name}'`);

    this.isRunning = false;

    // Stop intervals
    if (this.dataIntervalId) {
      clearInterval(this.dataIntervalId);
      this.dataIntervalId = null;
    }

    if (this.schemaIntervalId) {
      clearInterval(this.schemaIntervalId);
      this.schemaIntervalId = null;
    }

    // Close database connections
    if (this.sourceConnection) {
      await this.sourceConnection.close();
      this.sourceConnection = null;
    }

    if (this.targetConnection) {
      await this.targetConnection.close();
      this.targetConnection = null;
    }

    logger.info(`Sync service for '${this.syncPair.name}' stopped`);
  }

  private async performInitialSync(): Promise<void> {
    logger.info('Performing initial synchronization...');

    try {
      // 1. Sync schema first
      if (this.syncPair.syncSchema && this.sourceConnection && this.targetConnection) {
        logger.info('Initial schema sync...');
        const schemaSync = new SchemaSync(
          this.sourceConnection,
          this.targetConnection,
          this.syncPair.includeTables,
          this.syncPair.excludeTables
        );
        const result = await schemaSync.syncSchema();
        logger.info('Initial schema sync result:', result);
      }

      // 2. Sync procedures and functions
      if (this.syncPair.syncProcedures && this.sourceConnection && this.targetConnection) {
        logger.info('Initial procedures sync...');
        const proceduresSync = new ProceduresSync(
          this.sourceConnection,
          this.targetConnection
        );
        const result = await proceduresSync.syncProcedures();
        logger.info('Initial procedures sync result:', result);
      }

      // 3. Perform initial data sync
      if (this.syncPair.syncData && this.dataSync) {
        logger.info('Initial data sync...');
        const result = await this.dataSync.initialSync();
        logger.info('Initial data sync result:', result);
      }

      // Update last sync time
      configManager.updateLastSync(this.syncPair.name);

      logger.info('Initial synchronization completed');
    } catch (error) {
      logger.error('Initial synchronization failed:', error);
      throw error;
    }
  }

  private startRealTimeSync(): void {
    // Start data sync polling
    if (this.syncPair.syncData) {
      this.dataIntervalId = setInterval(() => {
        this.syncData().catch(error => {
          logger.error('Data sync error:', error);
        });
      }, this.settings.pollInterval);

      logger.info(`Data sync polling started (interval: ${this.settings.pollInterval}ms)`);
    }

    // Start schema check polling
    if (this.syncPair.syncSchema || this.syncPair.syncProcedures) {
      this.schemaIntervalId = setInterval(() => {
        this.syncSchema().catch(error => {
          logger.error('Schema sync error:', error);
        });
      }, this.settings.schemaCheckInterval);

      logger.info(`Schema sync polling started (interval: ${this.settings.schemaCheckInterval}ms)`);
    }
  }

  private async syncData(): Promise<void> {
    if (!this.dataSync || !this.isRunning) {
      return;
    }

    try {
      const result = await this.dataSync.syncData();

      if (result.success && result.details?.totalRowsSynced > 0) {
        logger.info(`Data sync: ${result.details.totalRowsSynced} rows synced`);
        configManager.updateLastSync(this.syncPair.name);
      }
    } catch (error) {
      logger.error('Error during data sync:', error);
    }
  }

  private async syncSchema(): Promise<void> {
    if (!this.sourceConnection || !this.targetConnection || !this.isRunning) {
      return;
    }

    try {
      // Sync schema
      if (this.syncPair.syncSchema) {
        const schemaSync = new SchemaSync(
          this.sourceConnection,
          this.targetConnection,
          this.syncPair.includeTables,
          this.syncPair.excludeTables
        );

        const result = await schemaSync.syncSchema();

        if (result.success && result.details) {
          const { tablesCreated, tablesModified } = result.details;
          if (tablesCreated > 0 || tablesModified > 0) {
            logger.info(`Schema sync: ${tablesCreated} tables created, ${tablesModified} tables modified`);
            configManager.updateLastSync(this.syncPair.name);
          }
        }
      }

      // Sync procedures and functions
      if (this.syncPair.syncProcedures) {
        const proceduresSync = new ProceduresSync(
          this.sourceConnection,
          this.targetConnection
        );

        const result = await proceduresSync.syncProcedures();

        if (result.success && result.details) {
          const { proceduresCreated, proceduresUpdated, functionsCreated, functionsUpdated } = result.details;
          const totalChanges = proceduresCreated + proceduresUpdated + functionsCreated + functionsUpdated;

          if (totalChanges > 0) {
            logger.info(`Procedures sync: ${result.message}`);
            configManager.updateLastSync(this.syncPair.name);
          }
        }
      }
    } catch (error) {
      logger.error('Error during schema sync:', error);
    }
  }

  isServiceRunning(): boolean {
    return this.isRunning;
  }
}
