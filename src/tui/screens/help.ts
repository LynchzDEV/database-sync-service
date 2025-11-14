import blessed from 'blessed';

export class HelpScreen {
  private container: blessed.Widgets.BoxElement;
  private helpContent!: blessed.Widgets.BoxElement;

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
      content: '{center}{bold}Help & Keyboard Shortcuts{/}',
      tags: true,
      style: { fg: 'cyan', bold: true }
    });

    this.helpContent = blessed.box({
      parent: this.container,
      top: 3,
      left: 0,
      width: '100%' as any,
      height: '100%-4' as any,
      label: ' Documentation ',
      tags: true,
      scrollable: true,
      alwaysScroll: true,
      keys: true,
      vi: true,
      mouse: true,
      scrollbar: { ch: '█' as any, style: { fg: 'cyan' } },
      border: { type: 'line', fg: 'cyan' } as any,
      content: this.getHelpContent(),
      style: { fg: 'white' }
    });

    blessed.box({
      parent: this.container,
      bottom: 0,
      left: 0,
      width: '100%',
      height: 1,
      content: '{center}[←]Back [↑↓]Scroll{/}',
      tags: true,
      style: { fg: 'black', bg: 'cyan' }
    });

    this.helpContent.key(['left', 'escape'], () => {
      this.app.showScreen('dashboard');
    });
  }

  private getHelpContent(): string {
    return `

  {bold}{cyan-fg}═══════════════════════════════════════════════════════════════{/}
  {bold}DB Sync Service - Terminal User Interface{/}
  {bold}{cyan-fg}═══════════════════════════════════════════════════════════════{/}


  {bold}{green-fg}Navigation:{/}

    {bold}1{/}           Switch to Dashboard
    {bold}2{/}           Switch to Connections Manager
    {bold}3{/}           Switch to Sync Pairs Manager
    {bold}4{/}           Switch to Logs Viewer
    {bold}? / H{/}       Show this Help screen
    {bold}R{/}           Refresh current screen
    {bold}Q / Ctrl-C{/}  Quit application


  {bold}{green-fg}Dashboard:{/}

    The dashboard shows real-time information about:
    • Service status (running/stopped)
    • Statistics (connections, sync pairs, last sync)
    • Active connections
    • Configured sync pairs
    • Recent activity logs

    The dashboard auto-refreshes every 2 seconds.


  {bold}{green-fg}Connections Manager:{/}

    View and manage database connections.

    {bold}Enter{/}      Select connection to view details
    {bold}T{/}          Test selected connection
    {bold}D{/}          Delete selected connection
    {bold}A{/}          Add new connection
    {bold}↑ / ↓{/}      Navigate list
    {bold}← / Esc{/}    Return to dashboard


  {bold}{green-fg}Sync Pairs Manager:{/}

    View and manage synchronization pairs.

    {bold}Enter{/}      Select sync pair to view details
    {bold}E{/}          Enable/Disable selected sync pair
    {bold}D{/}          Delete selected sync pair
    {bold}A{/}          Add new sync pair
    {bold}↑ / ↓{/}      Navigate list
    {bold}← / Esc{/}    Return to dashboard


  {bold}{green-fg}Logs Viewer:{/}

    View real-time system logs.

    {bold}C{/}          Clear log display
    {bold}F{/}          Filter logs (future feature)
    {bold}↑ / ↓{/}      Scroll through logs
    {bold}← / Esc{/}    Return to dashboard

    Logs auto-refresh every second.


  {bold}{green-fg}Features:{/}

    • Real-time monitoring of sync operations
    • Support for both MySQL and PostgreSQL
    • Schema, data, and procedures synchronization
    • Configurable polling intervals
    • Background daemon service
    • Comprehensive logging


  {bold}{green-fg}Getting Started:{/}

    1. Add your first database connection (Press 2, then A)
    2. Add a second database connection
    3. Create a sync pair (Press 3, then A)
    4. Start the service from the dashboard
    5. Monitor sync activity in real-time


  {bold}{cyan-fg}For more information, visit the README.md file{/}

`;
  }

  public refresh(): void {
    this.screen.render();
  }

  public show(): void {
    this.container.show();
    this.helpContent.focus();
  }

  public hide(): void {
    this.container.hide();
  }
}
