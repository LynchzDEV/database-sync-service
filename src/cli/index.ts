#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { connectionCommands } from './commands/connection';
import { syncPairCommands } from './commands/sync-pair';
import { serviceCommands } from './commands/service';
import { statusCommands } from './commands/status';

const program = new Command();

program
  .name('db-sync')
  .description('Real-time one-way database synchronization service')
  .version('1.0.0');

// Add command groups
connectionCommands(program);
syncPairCommands(program);
serviceCommands(program);
statusCommands(program);

// Show help if no arguments provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}

program.parse(process.argv);
