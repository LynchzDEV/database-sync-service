import blessed from 'blessed';
import configManager from '../../config/config-manager';
import { ThemeManager } from '../theme-manager';

export class SyncPairsScreen {
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
    const colors = ThemeManager.getColors();

    blessed.box({
      parent: this.container,
      top: 0,
      left: 0,
      width: '100%',
      height: 3,
      content: '{center}{bold}Sync Pairs Manager{/}',
      tags: true,
      style: { fg: colors.primary, bold: true }
    });

    this.list = blessed.list({
      parent: this.container,
      top: 3,
      left: 0,
      width: '50%' as any,
      height: '100%-4' as any,
      label: ' Sync Pairs ',
      tags: true,
      keys: true,
      vi: true,
      mouse: true,
      border: { type: 'line', fg: colors.border } as any,
      style: {
        selected: { bg: colors.selected.bg, fg: colors.selected.fg },
        item: { fg: colors.text }
      },
      scrollbar: { ch: '█' as any, style: { fg: colors.border } }
    });

    this.details = blessed.box({
      parent: this.container,
      top: 3,
      left: '50%' as any,
      width: '50%' as any,
      height: '100%-4' as any,
      label: ' Details ',
      tags: true,
      content: '\n  {cyan-fg}Select a sync pair to view details{/}',
      border: { type: 'line', fg: colors.border } as any,
      scrollable: true,
      alwaysScroll: true,
      scrollbar: { ch: '█' as any, style: { fg: colors.border } }
    });

    blessed.box({
      parent: this.container,
      bottom: 0,
      left: 0,
      width: '100%',
      height: 1,
      content: '{center}[Enter]Select [E]Enable/Disable [D]Delete [A]Add [←]Back{/}',
      tags: true,
      style: { fg: colors.statusBar.fg, bg: colors.statusBar.bg }
    });

    this.setupEvents();
  }

  private setupEvents(): void {
    this.list.on('select', (item) => {
      const name = item.content.split(' ')[0];
      const pair = configManager.getSyncPair(name);
      if (pair) {
        this.details.setContent(
          '\n' +
          `  {bold}Name:{/} ${name}\n\n` +
          `  {bold}Source:{/} ${pair.source}\n` +
          `  {bold}Target:{/} ${pair.target}\n` +
          `  {bold}Status:{/} ${pair.enabled ? '{green-fg}Enabled{/}' : '{red-fg}Disabled{/}'}\n\n` +
          `  {bold}Sync Options:{/}\n` +
          `    Schema: ${pair.syncSchema ? '✓' : '✗'}\n` +
          `    Data: ${pair.syncData ? '✓' : '✗'}\n` +
          `    Procedures: ${pair.syncProcedures ? '✓' : '✗'}\n\n` +
          `  {bold}Last Sync:{/} ${pair.lastSync ? new Date(pair.lastSync).toLocaleString() : 'Never'}\n`
        );
        this.screen.render();
      }
    });

    this.list.key(['left', 'escape'], () => {
      this.app.showScreen('dashboard');
    });
  }

  public refresh(): void {
    const syncPairs = configManager.listSyncPairs();
    const items = syncPairs.map(pair => {
      const status = pair.enabled ? '{green-fg}●{/}' : '{red-fg}○{/}';
      return `${pair.name} ${status} ${pair.source}→${pair.target}`;
    });

    if (items.length === 0) {
      this.list.setItems(['{yellow-fg}No sync pairs configured{/}']);
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
