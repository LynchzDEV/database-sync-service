import fs from 'fs';
import path from 'path';
import { Config, ConnectionConfig, SyncPairConfig, SyncSettings } from '../types';

class ConfigManager {
  private configDir: string;
  private configFile: string;

  constructor() {
    this.configDir = path.join(process.cwd(), '.db-sync');
    this.configFile = path.join(this.configDir, 'config.json');
    this.ensureConfigExists();
  }

  private ensureConfigExists(): void {
    if (!fs.existsSync(this.configDir)) {
      fs.mkdirSync(this.configDir, { recursive: true });
    }

    if (!fs.existsSync(this.configFile)) {
      const defaultConfig: Config = {
        connections: {},
        syncPairs: [],
        settings: {
          pollInterval: 5000, // 5 seconds for data changes
          schemaCheckInterval: 300000, // 5 minutes for schema changes
          logLevel: 'info',
          maxRetries: 3,
          retryDelay: 5000
        }
      };
      this.saveConfig(defaultConfig);
    }
  }

  loadConfig(): Config | null {
    try {
      const data = fs.readFileSync(this.configFile, 'utf8');
      return JSON.parse(data) as Config;
    } catch (error) {
      console.error('Error loading config:', (error as Error).message);
      return null;
    }
  }

  saveConfig(config: Config): boolean {
    try {
      fs.writeFileSync(this.configFile, JSON.stringify(config, null, 2), 'utf8');
      return true;
    } catch (error) {
      console.error('Error saving config:', (error as Error).message);
      return false;
    }
  }

  // Connection management
  addConnection(name: string, connectionConfig: ConnectionConfig): boolean {
    const config = this.loadConfig();
    if (!config) throw new Error('Failed to load configuration');

    if (config.connections[name]) {
      throw new Error(`Connection '${name}' already exists`);
    }

    config.connections[name] = {
      ...connectionConfig,
      createdAt: new Date().toISOString()
    };

    this.saveConfig(config);
    return true;
  }

  removeConnection(name: string): boolean {
    const config = this.loadConfig();
    if (!config) throw new Error('Failed to load configuration');

    if (!config.connections[name]) {
      throw new Error(`Connection '${name}' not found`);
    }

    // Check if connection is being used in any sync pair
    const inUse = config.syncPairs.some(pair =>
      pair.source === name || pair.target === name
    );

    if (inUse) {
      throw new Error(`Connection '${name}' is being used in active sync pairs`);
    }

    delete config.connections[name];
    this.saveConfig(config);
    return true;
  }

  getConnection(name: string): ConnectionConfig | null {
    const config = this.loadConfig();
    if (!config) return null;
    return config.connections[name] || null;
  }

  listConnections(): { [key: string]: ConnectionConfig } {
    const config = this.loadConfig();
    if (!config) return {};
    return config.connections;
  }

  // Sync pair management
  addSyncPair(
    name: string,
    sourceConnectionName: string,
    targetConnectionName: string,
    options: Partial<SyncPairConfig> = {}
  ): SyncPairConfig {
    const config = this.loadConfig();
    if (!config) throw new Error('Failed to load configuration');

    // Validate connections exist
    if (!config.connections[sourceConnectionName]) {
      throw new Error(`Source connection '${sourceConnectionName}' not found`);
    }
    if (!config.connections[targetConnectionName]) {
      throw new Error(`Target connection '${targetConnectionName}' not found`);
    }

    // Check if pair already exists
    if (config.syncPairs.find(pair => pair.name === name)) {
      throw new Error(`Sync pair '${name}' already exists`);
    }

    const syncPair: SyncPairConfig = {
      name,
      source: sourceConnectionName,
      target: targetConnectionName,
      enabled: true,
      syncSchema: options.syncSchema !== false,
      syncData: options.syncData !== false,
      syncProcedures: options.syncProcedures !== false,
      excludeTables: options.excludeTables || [],
      includeTables: options.includeTables || [],
      createdAt: new Date().toISOString(),
      lastSync: null
    };

    config.syncPairs.push(syncPair);
    this.saveConfig(config);
    return syncPair;
  }

  removeSyncPair(name: string): boolean {
    const config = this.loadConfig();
    if (!config) throw new Error('Failed to load configuration');

    const index = config.syncPairs.findIndex(pair => pair.name === name);

    if (index === -1) {
      throw new Error(`Sync pair '${name}' not found`);
    }

    config.syncPairs.splice(index, 1);
    this.saveConfig(config);
    return true;
  }

  getSyncPair(name: string): SyncPairConfig | null {
    const config = this.loadConfig();
    if (!config) return null;
    return config.syncPairs.find(pair => pair.name === name) || null;
  }

  listSyncPairs(): SyncPairConfig[] {
    const config = this.loadConfig();
    if (!config) return [];
    return config.syncPairs;
  }

  updateSyncPairStatus(name: string, enabled: boolean): boolean {
    const config = this.loadConfig();
    if (!config) throw new Error('Failed to load configuration');

    const pair = config.syncPairs.find(p => p.name === name);

    if (!pair) {
      throw new Error(`Sync pair '${name}' not found`);
    }

    pair.enabled = enabled;
    this.saveConfig(config);
    return true;
  }

  updateLastSync(name: string): void {
    const config = this.loadConfig();
    if (!config) return;

    const pair = config.syncPairs.find(p => p.name === name);

    if (pair) {
      pair.lastSync = new Date().toISOString();
      this.saveConfig(config);
    }
  }

  // Settings management
  getSettings(): SyncSettings | null {
    const config = this.loadConfig();
    if (!config) return null;
    return config.settings;
  }

  updateSettings(newSettings: Partial<SyncSettings>): SyncSettings {
    const config = this.loadConfig();
    if (!config) throw new Error('Failed to load configuration');

    config.settings = { ...config.settings, ...newSettings };
    this.saveConfig(config);
    return config.settings;
  }
}

export default new ConfigManager();
