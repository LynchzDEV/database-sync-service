# Database Sync Service

![Screen Recording Nov 14 2568 (3)](https://github.com/user-attachments/assets/f841ee04-d4fb-4a35-851a-e079700854af)

A real-time one-way database synchronization service with CLI management. Continuously monitors a source database and synchronizes changes (schema, data, and stored procedures) to a target database.

## Features

- **Real-time Synchronization**: Continuous monitoring with configurable polling intervals
- **Schema Synchronization**: Automatically syncs table structures, columns, and indexes
- **Data Synchronization**: Timestamp-based or row count-based data replication
- **Procedures & Functions**: Syncs stored procedures, functions, and triggers
- **CLI Management**: Interactive command-line interface for easy configuration
- **Background Service**: Runs as a daemon process with graceful shutdown
- **Flexible Filtering**: Include/exclude specific tables from synchronization
- **Comprehensive Logging**: Detailed logs with multiple severity levels

## Installation

```bash
npm install
```

## Quick Start

### 1. Build the Project

```bash
npm run build
```

### 2. Add Database Connections

```bash
npm run cli connection add
```

Follow the interactive prompts to add your source and target database connections.

### 3. Create a Sync Pair

```bash
npm run cli sync add
```

Select your source and target databases, and configure what to synchronize.

### 4. Start the Service

```bash
# Run in foreground (for testing)
npm run cli service start

# Run as background daemon
npm run cli service start --daemon
```

### 5. Check Status

```bash
# One-time status check
npm run cli status

# Watch status in real-time
npm run cli status --watch
```

## CLI Commands

### Connection Management

```bash
# Add a new database connection
npm run cli connection add

# List all connections
npm run cli connection list

# Test a connection
npm run cli connection test <name>

# Remove a connection
npm run cli connection remove <name>
```

### Sync Pair Management

```bash
# Add a new sync pair
npm run cli sync add

# List all sync pairs
npm run cli sync list

# Enable a sync pair
npm run cli sync enable <name>

# Disable a sync pair
npm run cli sync disable <name>

# Remove a sync pair
npm run cli sync remove <name>
```

### Service Control

```bash
# Start the service
npm run cli service start
npm run cli service start --daemon  # Background mode

# Stop the service
npm run cli service stop

# Restart the service
npm run cli service restart

# Check service status
npm run cli service status
```

### Status & Monitoring

```bash
# Show current status
npm run cli status

# Watch status in real-time (updates every 2 seconds)
npm run cli status --watch
```

## Configuration

### Sync Settings

Configuration is stored in `.db-sync/config.json`. Default settings:

- **Poll Interval**: 5000ms (5 seconds) - How often to check for data changes
- **Schema Check Interval**: 300000ms (5 minutes) - How often to check for schema changes
- **Log Level**: `info` - Logging verbosity (error, warn, info, debug)
- **Max Retries**: 3 - Number of retry attempts on failure
- **Retry Delay**: 5000ms - Delay between retry attempts

### Connection Configuration

Each connection requires:
- Host
- Port (default: 3306)
- Username
- Password
- Database name

### Sync Pair Options

When creating a sync pair, you can configure:
- **Schema Sync**: Sync table structures, columns, and indexes
- **Data Sync**: Sync data records (inserts, updates, deletes)
- **Procedures Sync**: Sync stored procedures, functions, and triggers
- **Table Filters**: Include only specific tables or exclude certain tables

## How It Works

### One-Way Synchronization

The service monitors the **source** database for changes and applies them to the **target** database. Changes only flow in one direction (source → target).

### Real-Time Detection

The service uses two detection methods:

1. **Data Changes** (every 5 seconds by default):
   - Timestamp-based: Detects rows with `updated_at`, `modified_at`, or similar timestamp columns
   - Row count-based: Compares row counts and performs full sync if different
   - Uses `INSERT ... ON DUPLICATE KEY UPDATE` for upserts

2. **Schema Changes** (every 5 minutes by default):
   - Compares table structures, columns, and indexes
   - Applies `ALTER TABLE` statements to sync schema
   - Syncs stored procedures, functions, and triggers

### Synchronization Flow

```
┌─────────────────┐
│  Initial Sync   │
│  - Schema       │
│  - Procedures   │
│  - Data         │
└────────┬────────┘
         │
         ↓
┌─────────────────┐     ┌──────────────────┐
│  Data Polling   │────→│  Apply Changes   │
│  (Every 5s)     │     │  to Target DB    │
└─────────────────┘     └──────────────────┘
         │
         │
┌─────────────────┐     ┌──────────────────┐
│ Schema Polling  │────→│  Apply Changes   │
│  (Every 5min)   │     │  to Target DB    │
└─────────────────┘     └──────────────────┘
```

## Logging

Logs are written to the `logs/` directory:

- `combined.log`: All logs
- `error.log`: Error-level logs only

Logs include timestamps, severity levels, and detailed information about sync operations.

## Development

### Build TypeScript

```bash
npm run build
```

### Watch Mode (Auto-rebuild)

```bash
npm run watch
```

### Run in Development Mode

```bash
npm run dev
```

## Architecture

```
src/
├── cli/                  # CLI interface
│   ├── index.ts         # Main CLI entry point
│   └── commands/        # CLI commands
│       ├── connection.ts
│       ├── sync-pair.ts
│       ├── service.ts
│       └── status.ts
├── service/             # Sync service
│   ├── daemon.ts        # Main daemon process
│   └── sync-service.ts  # Sync orchestrator
├── modules/             # Sync modules
│   ├── schema/         # Schema synchronization
│   ├── data/           # Data synchronization
│   └── procedures/     # Procedures/functions sync
├── config/              # Configuration management
│   └── config-manager.ts
├── utils/               # Utilities
│   ├── db-connection.ts
│   └── logger.ts
└── types/               # TypeScript types
    └── index.ts
```

## Safety & Best Practices

1. **Test First**: Always test with development databases first
2. **Backup**: Ensure you have backups of your target database
3. **Monitor**: Use `npm run cli status --watch` to monitor sync operations
4. **Exclude System Tables**: Use table filters to exclude system/internal tables
5. **Permissions**: Ensure database users have appropriate permissions (CREATE, ALTER, INSERT, UPDATE, DELETE)
6. **Network**: Ensure stable network connection between service and databases

## Limitations

- Only supports MySQL/MariaDB databases
- One-way synchronization only (source → target)
- Requires primary keys for proper update/delete operations
- Large tables may cause initial sync delays
- Schema changes with data type changes may require manual intervention

## Troubleshooting

### Service won't start
- Check if service is already running: `npm run cli service status`
- Verify database connections: `npm run cli connection test <name>`
- Check logs in `logs/error.log`

### Sync is slow
- Adjust poll interval in settings (careful: lower intervals increase load)
- Add indexes to timestamp columns used for change detection
- Use table filters to exclude unnecessary tables

### Missing data
- Ensure source table has a primary key
- Check if table is excluded in sync pair configuration
- Verify table exists in target database

## License

MIT

## Author

LynchzDEV
