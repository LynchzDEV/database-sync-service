import blessed from 'blessed';
import configManager from '../../config/config-manager';

export class ConnectionsScreen {
  private container: blessed.Widgets.BoxElement;
  private list!: blessed.Widgets.ListElement;
  private details!: blessed.Widgets.BoxElement;

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
    // Header
    blessed.box({
      parent: this.container,
      top: 0,
      left: 0,
      width: '100%',
      height: 3,
      content: '{center}{bold}Database Connections Manager{/}',
      tags: true,
      style: { fg: 'cyan', bold: true }
    });

    // Connection list
    this.list = blessed.list({
      parent: this.container,
      top: 3,
      left: 0,
      width: '50%' as any,
      height: '100%-4' as any,
      label: ' Connections ',
      tags: true,
      keys: true,
      vi: true,
      mouse: true,
      border: { type: 'line', fg: 'cyan' } as any,
      style: {
        selected: { bg: 'blue', fg: 'white' },
        item: { fg: 'white' }
      },
      scrollbar: {
        ch: '█' as any,
        style: { fg: 'cyan' }
      }
    });

    // Details panel
    this.details = blessed.box({
      parent: this.container,
      top: 3,
      left: '50%' as any,
      width: '50%' as any,
      height: '100%-4' as any,
      label: ' Details ',
      tags: true,
      content: '\n  {cyan-fg}Select a connection to view details{/}',
      border: { type: 'line', fg: 'cyan' } as any,
      scrollable: true,
      alwaysScroll: true,
      scrollbar: {
        ch: '█' as any,
        style: { fg: 'cyan' }
      }
    });

    // Footer
    blessed.box({
      parent: this.container,
      bottom: 0,
      left: 0,
      width: '100%',
      height: 1,
      content: '{center}[Enter]Select [T]Test [D]Delete [A]Add [←]Back{/}',
      tags: true,
      style: { fg: 'black', bg: 'cyan' }
    });

    this.setupEvents();
  }

  private setupEvents(): void {
    this.list.on('select', (item) => {
      const name = item.content.split(' ')[0];
      const conn = configManager.getConnection(name);
      if (conn) {
        this.details.setContent(
          '\n' +
          `  {bold}Name:{/} ${name}\n\n` +
          `  {bold}Type:{/} ${conn.type}\n` +
          `  {bold}Host:{/} ${conn.host}\n` +
          `  {bold}Port:{/} ${conn.port}\n` +
          `  {bold}Database:{/} ${conn.database}\n` +
          `  {bold}User:{/} ${conn.user}\n\n` +
          `  {bold}Created:{/} ${conn.createdAt || 'N/A'}\n`
        );
        this.screen.render();
      }
    });

    this.list.key(['left', 'escape'], () => {
      this.app.showScreen('dashboard');
    });
  }

  public refresh(): void {
    const connections = configManager.listConnections();
    const items = Object.entries(connections).map(([name, config]) => {
      const icon = config.type === 'postgresql' ? '🐘' : '🐬';
      return `${name} ${icon} ${config.type}`;
    });

    if (items.length === 0) {
      this.list.setItems(['{yellow-fg}No connections configured{/}']);
    } else {
      this.list.setItems(items);
    }

    this.screen.render();
  }

  public show(): void {
    this.container.show();
    this.refresh();
    this.list.focus();
  }

  public hide(): void {
    this.container.hide();
  }
}
