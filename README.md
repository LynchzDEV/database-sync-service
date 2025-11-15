# Database Sync Service

https://github.com/user-attachments/assets/0d5863c5-3d53-41b9-823b-065276bbe0fc

A real-time one-way database synchronization service with interactive Terminal UI and CLI management. Continuously monitors a source database and synchronizes **all changes** (INSERT, UPDATE, DELETE, schema modifications, and stored procedures) to a target database.

## ✨ Features

### Core Functionality
- **🔄 Real-Time Synchronization**: Continuous monitoring with configurable polling intervals (default: 5 seconds)
- **✅ Complete DML Support**: Detects and syncs INSERT, UPDATE, and DELETE operations
- **📊 Schema Synchronization**: Automatically syncs table structures, columns, and indexes
- **⚙️ Procedures & Functions**: Syncs stored procedures, functions, and triggers
- **🗄️ Multi-Database Support**: Works with both **MySQL** and **PostgreSQL** databases
- **🎯 Primary Key Based Detection**: Reliable change detection without requiring timestamp columns

### User Interface
- **🖥️ Terminal User Interface (TUI)**: Beautiful interactive dashboard with real-time monitoring
- **💻 CLI Management**: Comprehensive command-line interface for configuration
- **🎨 Theme Support**: Switch between light and dark themes
- **📈 Live Statistics**: Real-time service status, connection info, and sync activity

### Advanced Features
- **🔧 Service Control**: Start/stop service directly from TUI or CLI
- **🔍 Table Filtering**: Include/exclude specific tables from synchronization
- **📝 Comprehensive Logging**: Detailed logs with multiple severity levels and color coding
- **🛡️ Error Handling**: Graceful error recovery with automatic retries
- **⚡ Performance Optimized**: Batch operations and efficient primary key comparison

## 🚀 Quick Start

### 1. Installation

```bash
npm install
```

### 2. Build the Project

```bash
npm run build
```

### 3. Launch Terminal UI (Recommended)

```bash
npm run tui
```

**TUI Features:**
- **Dashboard**: Real-time service status, statistics, and activity logs
- **Connections Manager**: Add, test, and manage database connections
- **Sync Pairs Manager**: Configure and monitor sync pairs
- **Logs Viewer**: Live log streaming with color-coded severity levels
- **Help Screen**: Comprehensive keyboard shortcuts and documentation

**Keyboard Shortcuts:**
- `1` - Dashboard
- `2` - Connections Manager
- `3` - Sync Pairs Manager
- `4` - Logs Viewer
- `?` or `H` - Help
- `S` - Start/Stop Service (on dashboard)
- `T` - Toggle Light/Dark Theme
- `R` - Refresh Current Screen
- `Q` or `Ctrl-C` - Quit

### 4. Alternative: CLI Setup

If you prefer CLI instead of TUI:

```bash
# Add database connections
npm run cli connection add

# Create a sync pair
npm run cli sync add

# Start the service
npm run cli service start --daemon
```

## 🐳 Docker Deployment

The easiest way to run DB Sync is with Docker. Multi-platform images are available for **amd64** and **arm64** architectures.

### Pull and Run from Docker Hub

```bash
# Pull the latest image
docker pull lynchz/db-sync:latest

# Run the Terminal UI
docker run -it --rm \
  --network host \
  -v $(pwd)/config:/app/.db-sync \
  -v $(pwd)/logs:/app/logs \
  lynchz/db-sync:latest \
  node dist/tui/index.js

# Run the daemon service
docker run -d \
  --name db-sync-service \
  --network host \
  --restart unless-stopped \
  -v $(pwd)/config:/app/.db-sync \
  -v $(pwd)/logs:/app/logs \
  lynchz/db-sync:latest \
  node dist/service/daemon.js

# Run CLI commands
docker run -it --rm \
  --network host \
  -v $(pwd)/config:/app/.db-sync \
  lynchz/db-sync:latest \
  node dist/cli/index.js connection list
```

### Using Docker Compose (Recommended)

1. **Create `docker-compose.yml`** (or copy from `docker-compose.example.yml`):

```yaml
version: '3.8'

services:
  db-sync:
    image: lynchz/db-sync:latest
    container_name: db-sync-service
    restart: unless-stopped

    # Run the TUI by default
    command: node dist/tui/index.js

    # Or run the service daemon
    # command: node dist/service/daemon.js

    # Mount volumes for persistence
    volumes:
      - ./config:/app/.db-sync
      - ./logs:/app/logs

    # Interactive terminal for TUI
    stdin_open: true
    tty: true

    # Network mode to access host databases
    network_mode: host

    # Environment variables (optional)
    environment:
      - NODE_ENV=production
```

2. **Start the service:**

```bash
# Start in foreground (TUI mode)
docker-compose up

# Start in background (daemon mode)
# First edit docker-compose.yml to use daemon command
docker-compose up -d

# View logs
docker-compose logs -f

# Stop the service
docker-compose down
```

### Volume Configuration

**Important volumes to mount:**

- **`/app/.db-sync`** - Configuration files (connections, sync pairs, theme)
- **`/app/logs`** - Log files (combined.log, error.log)

**Example with specific paths:**

```bash
docker run -it --rm \
  --network host \
  -v /home/user/db-sync-config:/app/.db-sync \
  -v /var/log/db-sync:/app/logs \
  lynchz/db-sync:latest \
  node dist/tui/index.js
```

### Network Configuration

**Option 1: Host Network (Recommended)**
- Use `--network host` to access databases running on localhost
- Simplest for local databases or databases on the same host

**Option 2: Bridge Network**
- Create custom network for container-to-container communication
- Use when databases are also running in Docker

```bash
# Create network
docker network create db-sync-network

# Run with custom network
docker run -it --rm \
  --network db-sync-network \
  -v $(pwd)/config:/app/.db-sync \
  -v $(pwd)/logs:/app/logs \
  lynchz/db-sync:latest \
  node dist/tui/index.js
```

### Available Image Tags

The following tags are available on Docker Hub (`lynchz/db-sync`):

- **`latest`** - Latest build from main branch (recommended)
- **`v1.0.0`** - Specific version tags (semantic versioning)
- **`main`** - Latest build from main branch (same as latest)
- **`main-<sha>`** - Specific commit builds (e.g., `main-abc1234`)

**Multi-platform support:**
- **linux/amd64** - Intel/AMD 64-bit processors
- **linux/arm64** - ARM 64-bit processors (Apple Silicon, Raspberry Pi, AWS Graviton)

### Building Locally

**Build for your platform:**

```bash
docker build -t db-sync:local .
```

**Build for multiple platforms:**

```bash
# Setup buildx (one-time)
docker buildx create --name multiplatform --use
docker buildx inspect --bootstrap

# Build multi-platform image
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  -t lynchz/db-sync:latest \
  --push \
  .
```

### GitHub Actions Auto-Build

This repository uses GitHub Actions to automatically build and push multi-platform Docker images.

**Triggers:**
- Push to `main` branch → builds `latest` and `main` tags
- Push version tag (e.g., `v1.0.0`) → builds version tags
- Manual workflow dispatch → on-demand builds

**Setup Docker Hub credentials:**

1. Go to repository Settings → Secrets and variables → Actions
2. Add secrets:
   - `DOCKER_USERNAME` - Your Docker Hub username
   - `DOCKER_PASSWORD` - Your Docker Hub access token

**Create version tag:**

```bash
# Tag a release
git tag v1.0.0
git push origin v1.0.0

# GitHub Actions will automatically build and push:
# - lynchz/db-sync:v1.0.0
# - lynchz/db-sync:1.0
# - lynchz/db-sync:1
# - lynchz/db-sync:latest
```

### Docker Best Practices

**For Production:**
- Use specific version tags instead of `latest`
- Mount volumes for persistent configuration
- Use `--restart unless-stopped` for auto-recovery
- Monitor logs with `docker logs` or mount log volume
- Set resource limits if needed:
  ```bash
  docker run -d \
    --name db-sync \
    --memory="512m" \
    --cpus="1.0" \
    --restart unless-stopped \
    -v $(pwd)/config:/app/.db-sync \
    -v $(pwd)/logs:/app/logs \
    lynchz/db-sync:v1.0.0 \
    node dist/service/daemon.js
  ```

**For Development/Testing:**
- Use `latest` tag for newest features
- Use `--rm` to auto-remove container after exit
- Use `-it` for interactive mode (TUI)
- Mount local config for easy editing

### Docker Troubleshooting

**Container exits immediately:**
```bash
# Check logs
docker logs db-sync-service

# Run in foreground to see output
docker run -it --rm \
  --network host \
  -v $(pwd)/config:/app/.db-sync \
  lynchz/db-sync:latest \
  node dist/service/daemon.js
```

**Cannot connect to databases:**
- Check network mode (`--network host` for localhost databases)
- Verify database host is accessible from container
- Check firewall rules
- For remote databases, use IP address instead of `localhost`

**Permission issues:**
```bash
# Fix volume permissions
sudo chown -R 1001:1001 ./config ./logs

# Or run with current user (not recommended for production)
docker run --user $(id -u):$(id -g) ...
```

**TUI not rendering correctly:**
- Ensure you use `-it` flags for interactive terminal
- Check terminal size is adequate (minimum 80x24)
- Try different terminal emulator if rendering issues persist

## 📖 Detailed Usage

### Managing Database Connections

#### Using TUI
1. Press `2` to open Connections Manager
2. Press `A` to add a new connection
3. Select database type (PostgreSQL or MySQL)
4. Enter connection details (host, port, database, username, password)
5. Press `T` to test the connection
6. Press `←` to return to dashboard

#### Using CLI
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

**Connection Details:**
- **Database Type**: PostgreSQL or MySQL
- **Host**: Database server hostname/IP
- **Port**: Default 5432 (PostgreSQL) or 3306 (MySQL)
- **Database Name**: Name of the database to connect to
- **Username**: Database user
- **Password**: Database password

### Managing Sync Pairs

#### Using TUI
1. Press `3` to open Sync Pairs Manager
2. Press `A` to add a new sync pair
3. Select source database (data will be pulled from here)
4. Select target database (data will be pushed here)
5. Configure sync options:
   - Schema Sync (table structure)
   - Data Sync (table data)
   - Procedures Sync (stored procedures/functions)
6. Optional: Configure table filters (include/exclude)
7. Press `E` to enable/disable sync pair

#### Using CLI
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

#### Using TUI (Easiest)
1. Launch TUI: `npm run tui`
2. Press `S` on the dashboard to start/stop service
3. Monitor status in real-time on dashboard

#### Using CLI
```bash
# Start the service in foreground (for testing)
npm run cli service start

# Start as background daemon (production)
npm run cli service start --daemon

# Stop the service
npm run cli service stop

# Restart the service
npm run cli service restart

# Check service status
npm run cli service status
```

### Monitoring & Status

#### TUI Dashboard
- **Service Status**: Shows running/stopped with PID and uptime
- **Statistics**: Connection count, sync pairs, last sync time
- **Active Connections**: List of configured databases
- **Sync Pairs**: Current sync pairs with enable/disable status
- **Recent Activity**: Last 20 log entries with color coding
- **Auto-refresh**: Updates every 2 seconds

#### CLI Status
```bash
# One-time status check
npm run cli status

# Watch status in real-time (updates every 2 seconds)
npm run cli status --watch
```

## 🔧 Configuration

### Sync Settings

Configuration is stored in `.db-sync/config.json`. Default settings:

```json
{
  "pollInterval": 5000,           // Data sync check (5 seconds)
  "schemaCheckInterval": 300000,  // Schema sync check (5 minutes)
  "logLevel": "info",             // Logging verbosity
  "maxRetries": 3,                // Retry attempts on failure
  "retryDelay": 5000              // Delay between retries (5 seconds)
}
```

### Theme Configuration

Theme preference is stored in `.db-sync/theme.json`:

```json
{
  "theme": "dark"  // or "light"
}
```

**Change Theme:**
- In TUI: Press `T` to toggle, then restart TUI
- Persists between sessions

## 🔍 How It Works

### Synchronization Algorithm

The service uses a **comprehensive primary key based sync** algorithm that reliably detects all DML operations:

#### 1. Primary Key Comparison (Every 5 seconds)

```
Source Database PKs: {1, 2, 3, 4, 5}
Target Database PKs: {1, 2, 4, 6}

Detection:
├── INSERT: {3, 5}  ← In source, not in target
├── UPDATE: {1, 2, 4}  ← Check timestamps if available
└── DELETE: {6}  ← In target, not in source
```

#### 2. Operation Execution

**INSERT Detection:**
- Finds primary keys that exist in source but not in target
- Fetches full row data for new keys
- Inserts rows into target database
- Logs: `Inserted X new rows in table: Y`

**UPDATE Detection:**
- For keys that exist in both databases
- Uses timestamp columns (if available) to detect changes
- Upserts modified rows to target
- Logs: `Updated X rows in table: Y`

**DELETE Detection:**
- Finds primary keys that exist in target but not in source
- Deletes orphaned rows from target (batch operations)
- Logs: `Deleted X rows from table: Y`

#### 3. Schema Synchronization (Every 5 minutes)

- Compares table structures, columns, and indexes
- Applies `CREATE TABLE` or `ALTER TABLE` statements
- Syncs stored procedures, functions, and triggers
- Handles PostgreSQL and MySQL specific syntax

### Synchronization Flow

```
┌─────────────────────────────────────────────────────┐
│              Initial Sync (On Startup)              │
│  1. Schema Sync     → Create tables/columns/indexes │
│  2. Procedures Sync → Create procedures/functions   │
│  3. Data Sync       → Copy all existing data        │
└──────────────────┬──────────────────────────────────┘
                   │
                   ↓
┌──────────────────────────────────────────────────────┐
│          Real-Time Data Sync (Every 5s)              │
│  1. Query all PKs from source and target             │
│  2. Compare PKs to find INSERT/UPDATE/DELETE         │
│  3. Execute operations:                              │
│     - INSERT new rows                                │
│     - UPDATE changed rows (by timestamp)             │
│     - DELETE orphaned rows                           │
└──────────────────────────────────────────────────────┘
                   │
                   ↓
┌──────────────────────────────────────────────────────┐
│        Schema Sync (Every 5 minutes)                 │
│  1. Compare table structures                         │
│  2. Apply ALTER TABLE for changes                    │
│  3. Sync procedures and functions                    │
└──────────────────────────────────────────────────────┘
```

### Key Benefits

✅ **Works without timestamp columns** - Uses primary key comparison
✅ **Detects ALL operations** - INSERT, UPDATE, DELETE
✅ **No data loss** - Comprehensive change detection
✅ **Efficient** - Batch operations, O(1) lookups with Sets
✅ **Reliable** - Every change is detected and synced
✅ **Real-time** - 5-second polling interval (configurable)

## 📁 Project Structure

```
db-sync/
├── src/
│   ├── cli/                    # CLI interface
│   │   ├── index.ts           # Main CLI entry point
│   │   └── commands/          # CLI commands
│   │       ├── connection.ts  # Connection management
│   │       ├── sync-pair.ts   # Sync pair management
│   │       ├── service.ts     # Service control
│   │       └── status.ts      # Status display
│   ├── tui/                    # Terminal User Interface
│   │   ├── index.ts           # TUI main application
│   │   ├── theme-manager.ts   # Theme management
│   │   └── screens/           # TUI screens
│   │       ├── dashboard.ts   # Dashboard screen
│   │       ├── connections.ts # Connections manager
│   │       ├── sync-pairs.ts  # Sync pairs manager
│   │       ├── logs.ts        # Logs viewer
│   │       └── help.ts        # Help screen
│   ├── service/                # Sync service
│   │   ├── daemon.ts          # Main daemon process
│   │   └── sync-service.ts    # Sync orchestrator
│   ├── modules/                # Sync modules
│   │   ├── schema/            # Schema synchronization
│   │   │   └── schema-sync-v2.ts
│   │   ├── data/              # Data synchronization
│   │   │   └── data-sync-v2.ts
│   │   └── procedures/        # Procedures sync
│   │       └── procedures-sync-v2.ts
│   ├── adapters/               # Database adapters
│   │   ├── mysql-adapter.ts   # MySQL implementation
│   │   ├── postgresql-adapter.ts  # PostgreSQL implementation
│   │   └── adapter-factory.ts # Adapter factory
│   ├── config/                 # Configuration management
│   │   └── config-manager.ts
│   ├── utils/                  # Utilities
│   │   ├── database-wrapper.ts
│   │   ├── service-controller.ts
│   │   └── logger.ts
│   └── types/                  # TypeScript types
│       └── index.ts
├── logs/                       # Log files
│   ├── combined.log           # All logs
│   └── error.log              # Error logs only
├── .db-sync/                   # Service data
│   ├── config.json            # Configuration
│   ├── theme.json             # Theme preference
│   └── service.pid            # Service process ID
└── package.json
```

## 📊 Logging

### Log Files

Logs are written to the `logs/` directory:

- **`combined.log`**: All logs (info, warn, error, debug)
- **`error.log`**: Error-level logs only

### Log Levels

```javascript
{
  error: 0,  // Critical errors
  warn: 1,   // Warnings
  info: 2,   // General information (default)
  debug: 3   // Detailed debug information
}
```

### Log Format

```
2025-11-14 20:31:33 [info]: 	Starting data synchronization...
2025-11-14 20:31:33 [info]: 	Inserted 2 new rows in table: users
2025-11-14 20:31:33 [info]: 	Updated 1 rows in table: orders
2025-11-14 20:31:33 [info]: 	Deleted 1 rows from table: products
2025-11-14 20:31:33 [info]: 	Data sync: 4 rows synced
```

### Viewing Logs

**In TUI:**
- Press `4` to open Logs Viewer
- Auto-refreshes every second
- Color-coded by severity level
- Press `C` to clear log display

**In Terminal:**
```bash
# Follow logs in real-time
tail -f logs/combined.log

# View errors only
tail -f logs/error.log

# Search logs
grep "error" logs/combined.log
grep "Inserted" logs/combined.log
```

## 🛠️ Development

### Build

```bash
# Build TypeScript
npm run build

# Watch mode (auto-rebuild on changes)
npm run watch
```

### Run in Development

```bash
# CLI in development mode
npm run dev:cli

# TUI in development mode
npm run dev:tui

# Service in development mode
npm run dev
```

### Scripts

```json
{
  "build": "tsc",
  "start": "node dist/service/daemon.js",
  "cli": "node dist/cli/index.js",
  "tui": "node dist/tui/index.js",
  "dev": "ts-node src/service/daemon.ts",
  "dev:cli": "ts-node src/cli/index.ts",
  "dev:tui": "ts-node src/tui/index.ts",
  "watch": "tsc --watch"
}
```

## 🔐 Safety & Best Practices

### Before Production

1. **✅ Test First**: Always test with development databases first
2. **💾 Backup**: Ensure you have backups of your target database
3. **📊 Monitor**: Use TUI or `npm run cli status --watch` to monitor operations
4. **🔍 Review Filters**: Use table filters to exclude system/internal tables
5. **🔑 Permissions**: Ensure database users have appropriate permissions:
   - `SELECT` on source database
   - `CREATE`, `ALTER`, `INSERT`, `UPDATE`, `DELETE` on target database

### Security Recommendations

- Store database credentials securely
- Use read-only user for source database (recommended)
- Restrict network access between service and databases
- Regularly review sync logs for anomalies
- Test schema changes in development first

### Performance Tips

1. **Add Indexes**: Add indexes to primary keys and timestamp columns
2. **Table Filters**: Exclude large tables that don't need sync
3. **Adjust Intervals**: Increase poll interval for lower load (trade-off: slower sync)
4. **Network**: Ensure low-latency network connection to databases
5. **Monitor**: Use TUI to watch performance metrics

## ⚠️ Limitations

- **One-way sync only**: Changes only flow from source → target (target changes are overwritten)
- **Primary keys required**: Tables without primary keys use full sync (less efficient)
- **No conflict resolution**: Target changes are overwritten by source
- **Schema limitations**: Complex schema changes may require manual intervention
- **Large tables**: Initial sync of very large tables may take time
- **No DDL detection**: CREATE/DROP TABLE operations require schema check interval to pass

## 🐛 Troubleshooting

### Service Won't Start

**Check service status:**
```bash
npm run cli service status
```

**Common issues:**
- Service already running (check PID file in `.db-sync/service.pid`)
- Database connection failed (test with `npm run cli connection test <name>`)
- Build not complete (run `npm run build`)

**Solution:**
```bash
npm run cli service stop
npm run build
npm run cli service start --daemon
```

### No Data Being Synced

**Symptoms:**
- Service running but no sync activity in logs
- New INSERT operations not appearing in target

**Check:**
1. **Verify connections work:**
   ```bash
   npm run cli connection test source-db
   npm run cli connection test target-db
   ```

2. **Check sync pair is enabled:**
   ```bash
   npm run cli sync list
   # Look for "Enabled: true"
   ```

3. **Verify table has primary key:**
   ```sql
   -- In source database
   SHOW KEYS FROM your_table WHERE Key_name = 'PRIMARY';

   -- Or for PostgreSQL
   SELECT * FROM information_schema.table_constraints
   WHERE table_name = 'your_table' AND constraint_type = 'PRIMARY KEY';
   ```

4. **Check logs for errors:**
   ```bash
   tail -50 logs/error.log
   ```

### Sync is Slow

**Symptoms:**
- Long delays before changes appear in target
- High CPU/memory usage

**Solutions:**

1. **Adjust poll interval:**
   - Edit `.db-sync/config.json`
   - Increase `pollInterval` (e.g., 10000 for 10 seconds)
   - Restart service

2. **Add indexes:**
   ```sql
   -- Add index to timestamp column
   CREATE INDEX idx_updated_at ON your_table(updated_at);
   ```

3. **Use table filters:**
   - Exclude large tables that don't need real-time sync
   - Configure when creating sync pair

4. **Check network latency:**
   ```bash
   ping your-database-host
   ```

### Missing Data After Sync

**Check:**

1. **Table filtering:**
   - Verify table is not excluded in sync pair config
   - Check include/exclude lists

2. **Schema exists:**
   ```sql
   -- Verify table exists in target
   SHOW TABLES LIKE 'your_table';
   ```

3. **Permission issues:**
   ```sql
   -- Test INSERT permission
   INSERT INTO your_table (col) VALUES ('test');
   ```

4. **Review sync logs:**
   ```bash
   grep "your_table" logs/combined.log
   ```

### Theme Not Changing

**Issue**: Pressed `T` but theme looks the same

**Solution**:
1. Press `T` to toggle theme
2. Wait for confirmation message
3. **Quit and restart TUI** for theme to apply fully:
   ```bash
   # Press Q to quit
   npm run tui
   ```

Theme changes are saved to `.db-sync/theme.json` and persist between sessions.

## 🧪 Testing

### Manual Testing Checklist

**INSERT Test:**
```sql
-- In source database (db01)
INSERT INTO users (name, email) VALUES ('Test User', 'test@example.com');

-- Wait 5 seconds

-- In target database (db02)
SELECT * FROM users WHERE email = 'test@example.com';
-- ✅ Row should appear
```

**UPDATE Test:**
```sql
-- In source database
UPDATE users SET name = 'Updated Name' WHERE email = 'test@example.com';

-- Wait 5 seconds

-- In target database
SELECT name FROM users WHERE email = 'test@example.com';
-- ✅ Should show 'Updated Name'
```

**DELETE Test:**
```sql
-- In source database
DELETE FROM users WHERE email = 'test@example.com';

-- Wait 5 seconds

-- In target database
SELECT * FROM users WHERE email = 'test@example.com';
-- ✅ Should return empty
```

**Expected Log Output:**
```
[info]: Inserted 1 new rows in table: users
[info]: Updated 1 rows in table: users
[info]: Deleted 1 rows from table: users
```

## 📄 License

MIT License - see LICENSE file for details

## 👤 Author

**LynchzDEV**

## 🤝 Contributing

Contributions, issues, and feature requests are welcome!

1. Fork the project
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 🙏 Acknowledgments

- Built with TypeScript
- Uses [blessed](https://github.com/chjj/blessed) for Terminal UI
- Uses [blessed-contrib](https://github.com/yaronn/blessed-contrib) for dashboard widgets
- Database adapters for MySQL and PostgreSQL
- Winston for logging

---

**⭐ If you find this project useful, please consider giving it a star!**
