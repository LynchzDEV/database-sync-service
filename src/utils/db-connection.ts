import mysql from 'mysql2/promise';
import { DatabaseConfig } from '../types';

export class DatabaseConnection {
  private config: mysql.PoolOptions;
  private pool: mysql.Pool | null = null;

  constructor(config: DatabaseConfig) {
    this.config = {
      host: config.host,
      port: config.port || 3306,
      user: config.user,
      password: config.password,
      database: config.database,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    };
  }

  async connect(): Promise<boolean> {
    try {
      this.pool = mysql.createPool(this.config);
      // Test connection
      const connection = await this.pool.getConnection();
      connection.release();
      return true;
    } catch (error) {
      throw new Error(`Failed to connect to database: ${(error as Error).message}`);
    }
  }

  async query<T = any>(sql: string, params: any[] = []): Promise<T> {
    if (!this.pool) {
      throw new Error('Database not connected');
    }
    try {
      const [rows] = await this.pool.execute(sql, params);
      return rows as T;
    } catch (error) {
      throw new Error(`Query failed: ${(error as Error).message}`);
    }
  }

  async close(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }
  }

  getPool(): mysql.Pool | null {
    return this.pool;
  }

  isConnected(): boolean {
    return this.pool !== null;
  }
}
