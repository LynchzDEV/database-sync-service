import { DatabaseConnection } from '../../utils/database-wrapper';
import { ProcedureInfo, SyncResult, IDatabaseAdapter } from '../../types';
import logger from '../../utils/logger';

export class ProceduresSync {
  private sourceAdapter: IDatabaseAdapter;
  private targetAdapter: IDatabaseAdapter;

  constructor(
    private source: DatabaseConnection,
    private target: DatabaseConnection
  ) {
    this.sourceAdapter = source.getAdapter();
    this.targetAdapter = target.getAdapter();
  }

  async syncProcedures(): Promise<SyncResult> {
    try {
      logger.info('Starting procedures and functions synchronization...');

      const results = {
        proceduresCreated: 0,
        proceduresUpdated: 0,
        functionsCreated: 0,
        functionsUpdated: 0,
        errors: [] as string[]
      };

      // Sync stored procedures
      const procedureResult = await this.syncRoutines('PROCEDURE');
      results.proceduresCreated = procedureResult.created;
      results.proceduresUpdated = procedureResult.updated;
      results.errors.push(...procedureResult.errors);

      // Sync functions
      const functionResult = await this.syncRoutines('FUNCTION');
      results.functionsCreated = functionResult.created;
      results.functionsUpdated = functionResult.updated;
      results.errors.push(...functionResult.errors);

      logger.info('Procedures synchronization completed', results);

      return {
        success: results.errors.length === 0,
        message: `Procedures sync completed. Procedures: ${results.proceduresCreated} created, ${results.proceduresUpdated} updated. Functions: ${results.functionsCreated} created, ${results.functionsUpdated} updated.`,
        details: results
      };
    } catch (error) {
      logger.error('Procedures synchronization failed', error);
      return {
        success: false,
        message: 'Procedures synchronization failed',
        error: error as Error
      };
    }
  }

  private async syncRoutines(type: 'PROCEDURE' | 'FUNCTION'): Promise<{
    created: number;
    updated: number;
    errors: string[];
  }> {
    const results = {
      created: 0,
      updated: 0,
      errors: [] as string[]
    };

    try {
      const sourceRoutines = await this.sourceAdapter.getProcedures(type);
      const targetRoutines = await this.targetAdapter.getProcedures(type);

      // Create or update routines
      for (const sourceRoutine of sourceRoutines) {
        try {
          const targetRoutine = targetRoutines.find(r => r.name === sourceRoutine.name);

          if (!targetRoutine) {
            // Create new routine
            if (sourceRoutine.createStatement) {
              await this.targetAdapter.query(sourceRoutine.createStatement);
              results.created++;
              logger.info(`Created ${type.toLowerCase()}: ${sourceRoutine.name}`);
            }
          } else {
            // Check if routine needs update
            if (sourceRoutine.createStatement !== targetRoutine.createStatement) {
              // Drop and recreate
              const dropSql = `DROP ${type} IF EXISTS ${this.targetAdapter.escapeIdentifier(sourceRoutine.name)}`;
              await this.targetAdapter.query(dropSql);
              if (sourceRoutine.createStatement) {
                await this.targetAdapter.query(sourceRoutine.createStatement);
                results.updated++;
                logger.info(`Updated ${type.toLowerCase()}: ${sourceRoutine.name}`);
              }
            }
          }
        } catch (error) {
          const errorMsg = `Error syncing ${type.toLowerCase()} ${sourceRoutine.name}: ${(error as Error).message}`;
          logger.error(errorMsg);
          results.errors.push(errorMsg);
        }
      }
    } catch (error) {
      results.errors.push(`Error syncing ${type}s: ${(error as Error).message}`);
    }

    return results;
  }

  async syncTriggers(): Promise<SyncResult> {
    try {
      logger.info('Starting triggers synchronization...');

      const sourceTriggers = await this.sourceAdapter.getTriggers();
      const targetTriggers = await this.targetAdapter.getTriggers();

      let created = 0;
      let updated = 0;
      const errors: string[] = [];

      for (const sourceTrigger of sourceTriggers) {
        try {
          const targetTrigger = targetTriggers.find(t => t.name === sourceTrigger.name);

          if (!targetTrigger) {
            if (sourceTrigger.createStatement) {
              await this.targetAdapter.query(sourceTrigger.createStatement);
              created++;
              logger.info(`Created trigger: ${sourceTrigger.name}`);
            }
          } else if (sourceTrigger.createStatement !== targetTrigger.createStatement) {
            // Drop and recreate
            const dropSql = `DROP TRIGGER IF EXISTS ${this.targetAdapter.escapeIdentifier(sourceTrigger.name)}`;
            await this.targetAdapter.query(dropSql);
            if (sourceTrigger.createStatement) {
              await this.targetAdapter.query(sourceTrigger.createStatement);
              updated++;
              logger.info(`Updated trigger: ${sourceTrigger.name}`);
            }
          }
        } catch (error) {
          const errorMsg = `Error syncing trigger ${sourceTrigger.name}: ${(error as Error).message}`;
          logger.error(errorMsg);
          errors.push(errorMsg);
        }
      }

      return {
        success: errors.length === 0,
        message: `Triggers sync completed. Created: ${created}, Updated: ${updated}`,
        details: { created, updated, errors }
      };
    } catch (error) {
      logger.error('Triggers synchronization failed', error);
      return {
        success: false,
        message: 'Triggers synchronization failed',
        error: error as Error
      };
    }
  }
}
