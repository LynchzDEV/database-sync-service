#!/usr/bin/env node

import blessed from 'blessed';
import { DashboardScreen } from './screens/dashboard';
import { ConnectionsScreen } from './screens/connections';
import { SyncPairsScreen } from './screens/sync-pairs';
import { LogsScreen } from './screens/logs';
import { HelpScreen } from './screens/help';

export class TUIApp {
  private screen: blessed.Widgets.Screen;
  private currentScreen: any;
  private screens: Map<string, any>;

  constructor() {
    // Create the main screen
    this.screen = blessed.screen({
      smartCSR: true,
      title: 'DB Sync Service - Terminal UI',
      cursor: {
        artificial: true,
        shape: 'line',
        blink: true,
        color: 'white'
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
