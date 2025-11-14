import { DatabaseConfig, IDatabaseAdapter } from '../types';
import { createDatabaseAdapter } from '../adapters/adapter-factory';

/**
 * Wrapper class for database adapters
 * Provides a unified interface regardless of database type
 */
export class DatabaseConnection {
  private adapter: IDatabaseAdapter;

  constructor(config: DatabaseConfig) {
    this.adapter = createDatabaseAdapter(config);
  }

  async connect(): Promise<boolean> {
    return await this.adapter.connect();
  }

  async close(): Promise<void> {
    await this.adapter.close();
  }

  async query<T = any>(sql: string, params: any[] = []): Promise<T> {
    return await this.adapter.query<T>(sql, params);
  }

  isConnected(): boolean {
    return this.adapter.isConnected();
  }

  getAdapter(): IDatabaseAdapter {
    return this.adapter;
  }
}
