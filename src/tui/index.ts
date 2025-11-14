#!/usr/bin/env node

import blessed from 'blessed';
import { DashboardScreen } from './screens/dashboard';
import { ConnectionsScreen } from './screens/connections';
import { SyncPairsScreen } from './screens/sync-pairs';
import { LogsScreen } from './screens/logs';
import { HelpScreen } from './screens/help';
import { ThemeManager } from './theme-manager';

export class TUIApp {
  private screen: blessed.Widgets.Screen;
  private currentScreen: any;
  private screens: Map<string, any>;

  constructor() {
    // Load theme
    ThemeManager.loadTheme();
    const colors = ThemeManager.getColors();

    // Create the main screen
    this.screen = blessed.screen({
      smartCSR: true,
      title: 'DB Sync Service - Terminal UI',
      cursor: {
        artificial: true,
        shape: 'line',
        blink: true,
        color: colors.text
      }
    });

    // Initialize screens
    this.screens = new Map();
    this.screens.set('dashboard', new DashboardScreen(this.screen, this));
    this.screens.set('connections', new ConnectionsScreen(this.screen, this));
    this.screens.set('sync-pairs', new SyncPairsScreen(this.screen, this));
    this.screens.set('logs', new LogsScreen(this.screen, this));
    this.screens.set('help', new HelpScreen(this.screen, this));

    // Set up global key bindings
    this.setupGlobalKeys();

    // Show dashboard by default
    this.showScreen('dashboard');
  }

  private setupGlobalKeys(): void {
    // Quit on Ctrl-C or Q
    this.screen.key(['C-c', 'q'], () => {
      return process.exit(0);
    });

    // Navigate between screens
    this.screen.key(['1'], () => this.showScreen('dashboard'));
    this.screen.key(['2'], () => this.showScreen('connections'));
    this.screen.key(['3'], () => this.showScreen('sync-pairs'));
    this.screen.key(['4'], () => this.showScreen('logs'));
    this.screen.key(['?', 'h'], () => this.showScreen('help'));

    // Refresh current screen
    this.screen.key(['r'], () => {
      if (this.currentScreen && this.currentScreen.refresh) {
        this.currentScreen.refresh();
      }
    });

    // Toggle theme
    this.screen.key(['t'], () => {
      this.toggleTheme();
    });
  }

  private toggleTheme(): void {
    const newTheme = ThemeManager.toggleTheme();

    // Show notification
    const notification = blessed.box({
      parent: this.screen,
      top: 'center',
      left: 'center',
      width: 40,
      height: 5,
      content: `\n{center}Theme switched to: ${newTheme}{/}`,
      tags: true,
      border: { type: 'line' } as any,
      style: {
        border: { fg: 'cyan' }
      }
    });

    this.screen.render();

    // Auto-close notification and restart TUI
    setTimeout(() => {
      notification.destroy();
      this.screen.render();

      // Suggest restart
      const restartMsg = blessed.box({
        parent: this.screen,
        top: 'center',
        left: 'center',
        width: 50,
        height: 7,
        content: `\n{center}Theme changed to ${newTheme}!{/}\n\n{center}Restart TUI to apply theme{/}\n{center}Press any key to continue{/}`,
        tags: true,
        border: { type: 'line' } as any,
        style: {
          border: { fg: 'yellow' }
        }
      });

      this.screen.once('keypress', () => {
        restartMsg.destroy();
        this.screen.render();
      });

      this.screen.render();
    }, 1000);
  }

  showScreen(name: string): void {
    // Hide current screen
    if (this.currentScreen) {
      this.currentScreen.hide();
    }

    // Show new screen
    const screen = this.screens.get(name);
    if (screen) {
      this.currentScreen = screen;
      screen.show();
      this.screen.render();
    }
  }

  start(): void {
    this.screen.render();
  }
}

// Start the TUI
const app = new TUIApp();
app.start();
