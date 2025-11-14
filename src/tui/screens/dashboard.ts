import blessed from 'blessed';
import contrib from 'blessed-contrib';
import configManager from '../../config/config-manager';
import { ServiceController } from '../../utils/service-controller';
import fs from 'fs';
import path from 'path';

export class DashboardScreen {
  private container: blessed.Widgets.BoxElement;
  private grid: any;
  private serviceStatus!: blessed.Widgets.BoxElement;
  private connectionsBox!: blessed.Widgets.BoxElement;
  private syncPairsBox!: blessed.Widgets.BoxElement;
  private activityLog!: blessed.Widgets.Log;
  private statsTable!: contrib.widget.Table;
  private updateInterval: NodeJS.Timeout | null = null;

  constructor(private screen: blessed.Widgets.Screen, private app: any) {
    this.container = blessed.box({
      parent: this.screen,
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      hidden: true
    });

    this.grid = new contrib.grid({ rows: 12, cols: 12, screen: this.container as any });

    this.setupHeader();
    this.setupLayout();
    this.setupFooter();
  }

  private setupHeader(): void {
    const header = blessed.box({
      parent: this.container,
      top: 0,
      left: 0,
      width: '100%',
      height: 3,
      content: '{center}{bold}╔═══════════════════════════════════════════════════════════════════════════════╗\n' +
               '║                    DB Sync Service - Dashboard                                ║\n' +
               '╚═══════════════════════════════════════════════════════════════════════════════╝{/}',
      tags: true,
      style: {
        fg: 'cyan',
        bold: true
      }
    });
  }

  private setupLayout(): void {
    // Service Status Box (top-left)
    this.serviceStatus = this.grid.set(0, 0, 3, 6, blessed.box, {
      label: ' Service Status ',
      content: '',
      tags: true,
      border: {
        type: 'line'
      },
      style: {
        fg: 'white',
        border: {
          fg: 'cyan'
        }
      }
    });

    // Stats Table (top-right)
    this.statsTable = this.grid.set(0, 6, 3, 6, contrib.table, {
      keys: true,
      fg: 'white',
      selectedFg: 'white',
      selectedBg: 'blue',
      interactive: false,
      label: ' Statistics ',
      width: '100%',
      height: '100%',
      border: { type: 'line', fg: 'cyan' },
      columnSpacing: 3,
      columnWidth: [20, 15]
    });

    // Connections Box (middle-left)
    this.connectionsBox = this.grid.set(3, 0, 3, 6, blessed.box, {
      label: ' Connections ',
      content: '',
      tags: true,
      scrollable: true,
      alwaysScroll: true,
      scrollbar: {
        ch: '█',
        style: {
          fg: 'cyan'
        }
      },
      border: {
        type: 'line'
      },
      style: {
        fg: 'white',
        border: {
          fg: 'cyan'
        }
      }
    });

    // Sync Pairs Box (middle-right)
    this.syncPairsBox = this.grid.set(3, 6, 3, 6, blessed.box, {
      label: ' Sync Pairs ',
      content: '',
      tags: true,
      scrollable: true,
      alwaysScroll: true,
      scrollbar: {
        ch: '█',
        style: {
          fg: 'cyan'
        }
      },
      border: {
        type: 'line'
      },
      style: {
        fg: 'white',
        border: {
          fg: 'cyan'
        }
      }
    });

    // Activity Log (bottom)
    this.activityLog = this.grid.set(6, 0, 6, 12, blessed.log, {
      label: ' Recent Activity ',
      tags: true,
      scrollable: true,
      alwaysScroll: true,
      scrollbar: {
        ch: '█',
        style: {
          fg: 'cyan'
        }
      },
      border: {
        type: 'line'
      },
      style: {
        fg: 'white',
        border: {
          fg: 'cyan'
        }
      }
    });
  }

  private setupFooter(): void {
    const footer = blessed.box({
      parent: this.container,
      bottom: 0,
      left: 0,
      width: '100%',
      height: 1,
      content: '{center}[S]Start/Stop Service [T]Theme [1-4]Screens [?]Help [R]Refresh [Q]Quit{/}',
      tags: true,
      style: {
        fg: 'black',
        bg: 'cyan'
      }
    });

    // Add service toggle key handler
    this.container.key(['s'], () => {
      this.handleServiceToggle();
    });
  }

  private updateServiceStatus(): void {
    const serviceStatus = ServiceController.getStatus();

    const status = serviceStatus.isRunning
      ? '{green-fg}{bold}● RUNNING{/}'
      : '{red-fg}{bold}○ STOPPED{/}';

    const pid = serviceStatus.pid || 'N/A';
    const uptime = serviceStatus.uptime || 'N/A';

    this.serviceStatus.setContent(
      '\n' +
      `  Status:  ${status}\n` +
      `  PID:     ${pid}\n` +
      `  Uptime:  ${uptime}\n` +
      '\n' +
      `  {cyan-fg}Press 's' to start/stop service{/}`
    );
  }

  private async handleServiceToggle(): Promise<void> {
    const serviceStatus = ServiceController.getStatus();
    let result;

    if (serviceStatus.isRunning) {
      result = await ServiceController.stop();
    } else {
      result = await ServiceController.start();
    }

    // Show message in activity log
    if (result.success) {
      this.activityLog.log(`{green-fg}✓ ${result.message}{/}`);
    } else {
      this.activityLog.log(`{red-fg}✗ ${result.message}{/}`);
    }

    // Refresh dashboard
    this.refresh();
  }

  private updateStats(): void {
    const config = configManager.loadConfig();
    if (!config) return;

    const totalConnections = Object.keys(config.connections).length;
    const totalSyncPairs = config.syncPairs.length;
    const activeSyncPairs = config.syncPairs.filter(p => p.enabled).length;
    const lastSync = config.syncPairs
      .filter(p => p.lastSync)
      .sort((a, b) => new Date(b.lastSync!).getTime() - new Date(a.lastSync!).getTime())[0];

    const data = [
      ['Connections', totalConnections.toString()],
      ['Total Sync Pairs', totalSyncPairs.toString()],
      ['Active Pairs', activeSyncPairs.toString()],
      ['Last Sync', lastSync ? new Date(lastSync.lastSync!).toLocaleTimeString() : 'Never']
    ];

    this.statsTable.setData({
      headers: ['Metric', 'Value'],
      data: data
    });
  }

  private updateConnections(): void {
    const connections = configManager.listConnections();
    const connectionList = Object.entries(connections);

    if (connectionList.length === 0) {
      this.connectionsBox.setContent('\n  {yellow-fg}No connections configured{/}\n\n  {cyan-fg}Press [2] to add connections{/}');
    } else {
      let content = '\n';
      connectionList.forEach(([name, config], index) => {
        const typeColor = config.type === 'postgresql' ? 'blue' : 'green';
        content += `  {bold}${index + 1}. ${name}{/}\n`;
        content += `     {${typeColor}-fg}${config.type}{/} @ ${config.host}:${config.port}\n`;
        content += `     Database: {cyan-fg}${config.database}{/}\n\n`;
      });
      this.connectionsBox.setContent(content);
    }
  }

  private updateSyncPairs(): void {
    const syncPairs = configManager.listSyncPairs();

    if (syncPairs.length === 0) {
      this.syncPairsBox.setContent('\n  {yellow-fg}No sync pairs configured{/}\n\n  {cyan-fg}Press [3] to add sync pairs{/}');
    } else {
      let content = '\n';
      syncPairs.forEach((pair, index) => {
        const statusColor = pair.enabled ? 'green' : 'red';
        const statusIcon = pair.enabled ? '●' : '○';
        content += `  {bold}${index + 1}. ${pair.name}{/} {${statusColor}-fg}${statusIcon}{/}\n`;
        content += `     ${pair.source} → ${pair.target}\n`;
        if (pair.lastSync) {
          content += `     {gray-fg}Last sync: ${new Date(pair.lastSync).toLocaleString()}{/}\n`;
        }
        content += '\n';
      });
      this.syncPairsBox.setContent(content);
    }
  }

  private updateActivityLog(): void {
    try {
      const logFile = path.join(process.cwd(), 'logs', 'combined.log');
      if (fs.existsSync(logFile)) {
        const logs = fs.readFileSync(logFile, 'utf8').split('\n').filter(l => l).slice(-20);
        this.activityLog.setContent('');
        logs.forEach(log => {
          let color = 'white';
          if (log.includes('[error]')) color = 'red';
          else if (log.includes('[warn]')) color = 'yellow';
          else if (log.includes('[info]')) color = 'cyan';

          this.activityLog.log(`{${color}-fg}${log}{/}`);
        });
      }
    } catch (error) {
      // Ignore log read errors
    }
  }

  public refresh(): void {
    this.updateServiceStatus();
    this.updateStats();
    this.updateConnections();
    this.updateSyncPairs();
    this.updateActivityLog();
    this.screen.render();
  }

  public show(): void {
    this.container.show();
    this.refresh();

    // Start auto-refresh every 2 seconds
    this.updateInterval = setInterval(() => {
      this.refresh();
    }, 2000);

    this.container.focus();
  }

  public hide(): void {
    this.container.hide();

    // Stop auto-refresh
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }
}
