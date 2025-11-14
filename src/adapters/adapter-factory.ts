import { DatabaseConfig, IDatabaseAdapter } from '../types';
import { MySQLAdapter } from './mysql-adapter';
import { PostgreSQLAdapter } from './postgresql-adapter';

export function createDatabaseAdapter(config: DatabaseConfig): IDatabaseAdapter {
  switch (config.type) {
    case 'mysql':
      return new MySQLAdapter(config);
    case 'postgresql':
      return new PostgreSQLAdapter(config);
    default:
      throw new Error(`Unsupported database type: ${config.type}`);
  }
}
