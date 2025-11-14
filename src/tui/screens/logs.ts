import blessed from 'blessed';
import fs from 'fs';
import path from 'path';

export class LogsScreen {
  private container: blessed.Widgets.BoxElement;
  private logBox!: blessed.Widgets.Log;
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

    this.setupLayout();
  }

  private setupLayout(): void {
    blessed.box({
      parent: this.container,
      top: 0,
      left: 0,
      width: '100%',
      height: 3,
      content: '{center}{bold}Real-Time Logs Viewer{/}',
      tags: true,
      style: { fg: 'cyan', bold: true }
    });

    this.logBox = blessed.log({
      parent: this.container,
      top: 3,
      left: 0,
      width: '100%' as any,
      height: '100%-4' as any,
      label: ' System Logs ',
      tags: true,
      keys: true,
      vi: true,
      mouse: true,
      scrollable: true,
      alwaysScroll: true,
      scrollbar: { ch: '█' as any, style: { fg: 'cyan' } },
      border: { type: 'line', fg: 'cyan' } as any,
      style: { fg: 'white' }
    });

    blessed.box({
      parent: this.container,
      bottom: 0,
      left: 0,
      width: '100%',
      height: 1,
      content: '{center}[C]Clear [F]Filter [←]Back [↑↓]Scroll{/}',
      tags: true,
      style: { fg: 'black', bg: 'cyan' }
    });

    this.setupEvents();
  }

  private setupEvents(): void {
    this.logBox.key(['left', 'escape'], () => {
      this.app.showScreen('dashboard');
    });

    this.logBox.key(['c'], () => {
      this.logBox.setContent('');
      this.logBox.log('{cyan-fg}Logs cleared{/}');
      this.screen.render();
    });
  }

  private loadLogs(): void {
    try {
      const logFile = path.join(process.cwd(), 'logs', 'combined.log');
      if (fs.existsSync(logFile)) {
        const logs = fs.readFileSync(logFile, 'utf8')
          .split('\n')
          .filter(l => l)
          .slice(-100); // Last 100 lines

        this.logBox.setContent('');
        logs.forEach(log => {
          let color = 'white';
          if (log.includes('[error]')) color = 'red';
          else if (log.includes('[warn]')) color = 'yellow';
          else if (log.includes('[info]')) color = 'cyan';
          else if (log.includes('[debug]')) color = 'gray';

          this.logBox.log(`{${color}-fg}${log}{/}`);
        });
      } else {
        this.logBox.log('{yellow-fg}No log file found. Start the service to generate logs.{/}');
      }
    } catch (error) {
      this.logBox.log(`{red-fg}Error loading logs: ${(error as Error).message}{/}`);
    }
  }

  public refresh(): void {
    this.loadLogs();
    this.screen.render();
  }

  public show(): void {
    this.container.show();
    this.refresh();

    // Auto-refresh logs every second
    this.updateInterval = setInterval(() => {
      this.loadLogs();
      this.screen.render();
    }, 1000);

    this.logBox.focus();
  }

  public hide(): void {
    this.container.hide();

    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }
}
