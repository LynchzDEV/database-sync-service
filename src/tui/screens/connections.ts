import blessed from 'blessed';
import configManager from '../../config/config-manager';
import { ThemeManager } from '../theme-manager';

export class ConnectionsScreen {
  private container: blessed.Widgets.BoxElement;
  private list!: blessed.Widgets.ListElement;
  private details!: blessed.Widgets.BoxElement;
  private selectedConnection: string = '';

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
    const colors = ThemeManager.getColors();

    // Header
    blessed.box({
      parent: this.container,
      top: 0,
      left: 0,
      width: '100%',
      height: 3,
      content: '{center}{bold}Database Connections Manager{/}',
      tags: true,
      style: { fg: colors.primary, bold: true }
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
      border: { type: 'line', fg: colors.border } as any,
      style: {
        selected: { bg: colors.selected.bg, fg: colors.selected.fg },
        item: { fg: colors.text }
      },
      scrollbar: {
        ch: '█' as any,
        style: { fg: colors.border }
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
      border: { type: 'line', fg: colors.border } as any,
      scrollable: true,
      alwaysScroll: true,
      scrollbar: {
        ch: '█' as any,
        style: { fg: colors.border }
      }
    });

    // Footer
    blessed.box({
      parent: this.container,
      bottom: 0,
      left: 0,
      width: '100%',
      height: 1,
      content: '{center}[Enter]Select [t]Test [d]Delete [a]Add [←]Back{/}',
      tags: true,
      style: { fg: colors.statusBar.fg, bg: colors.statusBar.bg }
    });

    this.setupEvents();
  }

  private setupEvents(): void {
    this.list.on('select', (item) => {
      const name = item.content.split(' ')[0];
      this.selectedConnection = name;
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

    // Add connection (a key)
    this.list.key(['a'], () => {
      this.details.setContent('\n  {yellow-fg}Add connection feature coming soon!{/}\n  {cyan-fg}Use CLI: npm run cli connection add{/}');
      this.screen.render();
    });

    // Test connection (t key)
    this.list.key(['t'], () => {
      if (this.selectedConnection) {
        this.details.setContent(`\n  {yellow-fg}Testing connection: ${this.selectedConnection}...{/}\n  {cyan-fg}Use CLI: npm run cli connection test ${this.selectedConnection}{/}`);
        this.screen.render();
      }
    });

    // Delete connection (d key)
    this.list.key(['d'], () => {
      if (this.selectedConnection) {
        this.details.setContent(`\n  {yellow-fg}Delete connection: ${this.selectedConnection}{/}\n  {cyan-fg}Use CLI: npm run cli connection remove ${this.selectedConnection}{/}`);
        this.screen.render();
      }
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
