import configManager from '../config/config-manager';
import { SyncService } from './sync-service';
import logger from '../utils/logger';
import { SyncPairConfig } from '../types';

class SyncDaemon {
  private services: Map<string, SyncService> = new Map();
  private isRunning: boolean = false;

  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Sync daemon is already running');
      return;
    }

    try {
      logger.info('Starting sync daemon...');

      const config = configManager.loadConfig();

      if (!config) {
        throw new Error('Failed to load configuration');
      }

      // Get enabled sync pairs
      const enabledPairs = config.syncPairs.filter(pair => pair.enabled);

      if (enabledPairs.length === 0) {
        logger.warn('No enabled sync pairs found. Please add and enable sync pairs using the CLI.');
        logger.info('Use: db-sync sync add');
        return;
      }

      logger.info(`Found ${enabledPairs.length} enabled sync pair(s)`);

      // Start services for each enabled sync pair
      for (const syncPair of enabledPairs) {
        try {
          await this.startSyncService(syncPair);
        } catch (error) {
          logger.error(`Failed to start sync service for '${syncPair.name}':`, error);
        }
      }

      this.isRunning = true;

      logger.info(`Sync daemon started successfully with ${this.services.size} active service(s)`);

      // Setup graceful shutdown
      this.setupShutdownHandlers();

    } catch (error) {
      logger.error('Failed to start sync daemon:', error);
      await this.stop();
      throw error;
    }
  }

  private async startSyncService(syncPair: SyncPairConfig): Promise<void> {
    const sourceConfig = configManager.getConnection(syncPair.source);
    const targetConfig = configManager.getConnection(syncPair.target);
    const settings = configManager.getSettings();

    if (!sourceConfig) {
      throw new Error(`Source connection '${syncPair.source}' not found`);
    }

    if (!targetConfig) {
      throw new Error(`Target connection '${syncPair.target}' not found`);
    }

    if (!settings) {
      throw new Error('Settings not found');
    }

    const service = new SyncService(syncPair, sourceConfig, targetConfig, settings);

    await service.start();

    this.services.set(syncPair.name, service);

    logger.info(`Sync service '${syncPair.name}' started`);
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    logger.info('Stopping sync daemon...');

    this.isRunning = false;

    // Stop all services
    const stopPromises = Array.from(this.services.entries()).map(async ([name, service]) => {
      try {
        await service.stop();
        logger.info(`Stopped sync service: ${name}`);
      } catch (error) {
        logger.error(`Error stopping sync service '${name}':`, error);
      }
    });

    await Promise.all(stopPromises);

    this.services.clear();

    logger.info('Sync daemon stopped');
  }

  async restart(): Promise<void> {
    logger.info('Restarting sync daemon...');
    await this.stop();
    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
    await this.start();
  }

  private setupShutdownHandlers(): void {
    const shutdown = async (signal: string) => {
      logger.info(`Received ${signal} signal. Shutting down gracefully...`);
      await this.stop();
      process.exit(0);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught exception:', error);
      shutdown('uncaughtException').then(() => process.exit(1));
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled rejection at:', promise, 'reason:', reason);
      shutdown('unhandledRejection').then(() => process.exit(1));
    });
  }

  getStatus(): {
    isRunning: boolean;
    activeServices: number;
    services: { name: string; isRunning: boolean }[];
  } {
    return {
      isRunning: this.isRunning,
      activeServices: this.services.size,
      services: Array.from(this.services.entries()).map(([name, service]) => ({
        name,
        isRunning: service.isServiceRunning()
      }))
    };
  }
}

// Create and start daemon instance
const daemon = new SyncDaemon();

// Start the daemon
daemon.start().catch((error) => {
  logger.error('Fatal error starting daemon:', error);
  process.exit(1);
});

// Export for potential programmatic use
export default daemon;
