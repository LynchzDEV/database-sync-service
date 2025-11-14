import { DatabaseConnection } from '../../utils/db-connection';
import { ProcedureInfo, SyncResult } from '../../types';
import logger from '../../utils/logger';

export class ProceduresSync {
  constructor(
    private source: DatabaseConnection,
    private target: DatabaseConnection
  ) {}

  async syncProcedures(): Promise<SyncResult> {
    try {
      logger.info('Starting procedures and functions synchronization...');

      const results = {
        proceduresCreated: 0,
        proceduresUpdated: 0,
        proceduresDropped: 0,
        functionsCreated: 0,
        functionsUpdated: 0,
        functionsDropped: 0,
        errors: [] as string[]
      };

      // Sync stored procedures
      const procedureResult = await this.syncRoutines('PROCEDURE');
      results.proceduresCreated = procedureResult.created;
      results.proceduresUpdated = procedureResult.updated;
      results.proceduresDropped = procedureResult.dropped;
      results.errors.push(...procedureResult.errors);

      // Sync functions
      const functionResult = await this.syncRoutines('FUNCTION');
      results.functionsCreated = functionResult.created;
      results.functionsUpdated = functionResult.updated;
      results.functionsDropped = functionResult.dropped;
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
    dropped: number;
    errors: string[];
  }> {
    const results = {
      created: 0,
      updated: 0,
      dropped: 0,
      errors: [] as string[]
    };

    try {
      const sourceRoutines = await this.getRoutines(this.source, type);
      const targetRoutines = await this.getRoutines(this.target, type);

      // Create or update routines
      for (const sourceRoutine of sourceRoutines) {
        try {
          const targetRoutine = targetRoutines.find(r => r.name === sourceRoutine.name);

          if (!targetRoutine) {
            // Create new routine
            await this.createRoutine(sourceRoutine);
            results.created++;
            logger.info(`Created ${type.toLowerCase()}: ${sourceRoutine.name}`);
          } else {
            // Check if routine needs update
            if (sourceRoutine.createStatement !== targetRoutine.createStatement) {
              await this.updateRoutine(sourceRoutine);
              results.updated++;
              logger.info(`Updated ${type.toLowerCase()}: ${sourceRoutine.name}`);
            }
          }
        } catch (error) {
          const errorMsg = `Error syncing ${type.toLowerCase()} ${sourceRoutine.name}: ${(error as Error).message}`;
          logger.error(errorMsg);
          results.errors.push(errorMsg);
        }
      }

      // Optionally drop routines that don't exist in source
      // Commented out for safety - you can enable this if needed
      /*
      for (const targetRoutine of targetRoutines) {
        const existsInSource = sourceRoutines.some(r => r.name === targetRoutine.name);
        if (!existsInSource) {
          try {
            await this.dropRoutine(targetRoutine);
            results.dropped++;
            logger.info(`Dropped ${type.toLowerCase()}: ${targetRoutine.name}`);
          } catch (error) {
            const errorMsg = `Error dropping ${type.toLowerCase()} ${targetRoutine.name}: ${(error as Error).message}`;
            logger.error(errorMsg);
            results.errors.push(errorMsg);
          }
        }
      }
      */
    } catch (error) {
      results.errors.push(`Error syncing ${type}s: ${(error as Error).message}`);
    }

    return results;
  }

  private async getRoutines(db: DatabaseConnection, type: 'PROCEDURE' | 'FUNCTION'): Promise<ProcedureInfo[]> {
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

    const routines = await db.query<any[]>(query, [type]);

    // Get CREATE statement for each routine
    for (const routine of routines) {
      try {
        const [createStmt] = await db.query<any[]>(
          `SHOW CREATE ${type} \`${routine.name}\``
        );

        // The result column name depends on the type
        const columnName = type === 'PROCEDURE' ? 'Create Procedure' : 'Create Function';
        routine.createStatement = createStmt[columnName];
      } catch (error) {
        logger.warn(`Could not get CREATE statement for ${type.toLowerCase()} ${routine.name}`);
        routine.createStatement = '';
      }
    }

    return routines;
  }

  private async createRoutine(routine: ProcedureInfo): Promise<void> {
    if (!routine.createStatement) {
      throw new Error(`No CREATE statement available for ${routine.name}`);
    }

    await this.target.query(routine.createStatement);
  }

  private async updateRoutine(routine: ProcedureInfo): Promise<void> {
    // Drop and recreate
    await this.dropRoutine(routine);
    await this.createRoutine(routine);
  }

  private async dropRoutine(routine: ProcedureInfo): Promise<void> {
    const sql = `DROP ${routine.type} IF EXISTS \`${routine.name}\``;
    await this.target.query(sql);
  }

  async syncTriggers(): Promise<SyncResult> {
    try {
      logger.info('Starting triggers synchronization...');

      const sourceTriggers = await this.getTriggers(this.source);
      const targetTriggers = await this.getTriggers(this.target);

      let created = 0;
      let updated = 0;
      const errors: string[] = [];

      for (const sourceTrigger of sourceTriggers) {
        try {
          const targetTrigger = targetTriggers.find(t => t.name === sourceTrigger.name);

          if (!targetTrigger) {
            await this.createTrigger(sourceTrigger);
            created++;
            logger.info(`Created trigger: ${sourceTrigger.name}`);
          } else if (sourceTrigger.createStatement !== targetTrigger.createStatement) {
            await this.updateTrigger(sourceTrigger);
            updated++;
            logger.info(`Updated trigger: ${sourceTrigger.name}`);
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

  private async getTriggers(db: DatabaseConnection): Promise<any[]> {
    const query = `
      SELECT
        TRIGGER_NAME as name,
        EVENT_MANIPULATION as event,
        EVENT_OBJECT_TABLE as tableName,
        ACTION_TIMING as timing
      FROM information_schema.TRIGGERS
      WHERE TRIGGER_SCHEMA = DATABASE()
    `;

    const triggers = await db.query<any[]>(query);

    for (const trigger of triggers) {
      try {
        const [createStmt] = await db.query<any[]>(`SHOW CREATE TRIGGER \`${trigger.name}\``);
        trigger.createStatement = createStmt['SQL Original Statement'];
      } catch (error) {
        logger.warn(`Could not get CREATE statement for trigger ${trigger.name}`);
        trigger.createStatement = '';
      }
    }

    return triggers;
  }

  private async createTrigger(trigger: any): Promise<void> {
    if (!trigger.createStatement) {
      throw new Error(`No CREATE statement available for trigger ${trigger.name}`);
    }

    await this.target.query(trigger.createStatement);
  }

  private async updateTrigger(trigger: any): Promise<void> {
    await this.target.query(`DROP TRIGGER IF EXISTS \`${trigger.name}\``);
    await this.createTrigger(trigger);
  }
}
