import { Command } from 'commander';
import chalk from 'chalk';
import Table from 'cli-table3';
import fs from 'fs';
import path from 'path';
import configManager from '../../config/config-manager';

export function statusCommands(program: Command): void {
  program
    .command('status')
    .description('Show synchronization status')
    .option('-w, --watch', 'Watch status in real-time')
    .action(async (options) => {
      try {
        const showStatus = () => {
          console.clear();
          console.log(chalk.bold.cyan('\n╔═══════════════════════════════════════════════════╗'));
          console.log(chalk.bold.cyan('║       Database Sync Service Status                ║'));
          console.log(chalk.bold.cyan('╚═══════════════════════════════════════════════════╝\n'));

          // Check service status
          const pidFile = path.join(process.cwd(), '.db-sync', 'service.pid');
          const isRunning = fs.existsSync(pidFile) && (() => {
            try {
              const pid = fs.readFileSync(pidFile, 'utf8').trim();
              process.kill(Number(pid), 0);
              return true;
            } catch {
              return false;
            }
          })();

          console.log(chalk.bold('Service Status: ') + (isRunning ? chalk.green('● Running') : chalk.red('○ Stopped')));

          // Show connections
          const connections = Object.keys(configManager.listConnections());
          console.log(chalk.bold(`\nConnections: `) + chalk.cyan(connections.length.toString()));

          // Show sync pairs
          const syncPairs = configManager.listSyncPairs();
          const enabledPairs = syncPairs.filter(p => p.enabled);

          console.log(chalk.bold('Sync Pairs: ') + chalk.cyan(syncPairs.length.toString()) +
            chalk.gray(` (${enabledPairs.length} enabled)`));

          if (syncPairs.length > 0) {
            const table = new Table({
              head: [
                chalk.cyan('Name'),
                chalk.cyan('Status'),
                chalk.cyan('Source → Target'),
                chalk.cyan('Last Sync')
              ],
              colWidths: [20, 12, 35, 25]
            });

            syncPairs.forEach(pair => {
              const status = pair.enabled ? chalk.green('● Enabled') : chalk.red('○ Disabled');
              const route = `${pair.source} → ${pair.target}`;
              const lastSync = pair.lastSync
                ? new Date(pair.lastSync).toLocaleString()
                : chalk.gray('Never');

              table.push([pair.name, status, route, lastSync]);
            });

            console.log('\n' + table.toString());
          }

          // Show settings
          const settings = configManager.getSettings();
          if (settings) {
            console.log(chalk.bold('\nSettings:'));
            console.log(`  Poll Interval: ${chalk.cyan(settings.pollInterval / 1000 + 's')}`);
            console.log(`  Schema Check Interval: ${chalk.cyan(settings.schemaCheckInterval / 1000 + 's')}`);
            console.log(`  Log Level: ${chalk.cyan(settings.logLevel)}`);
          }

          // Show recent logs
          const logFile = path.join(process.cwd(), 'logs', 'combined.log');
          if (fs.existsSync(logFile)) {
            const logs = fs.readFileSync(logFile, 'utf8').split('\n').filter(l => l).slice(-5);
            if (logs.length > 0) {
              console.log(chalk.bold('\nRecent Logs:'));
              logs.forEach(log => {
                if (log.includes('[error]')) {
                  console.log(chalk.red(log));
                } else if (log.includes('[warn]')) {
                  console.log(chalk.yellow(log));
                } else {
                  console.log(chalk.gray(log));
                }
              });
            }
          }

          console.log('\n' + chalk.gray('─'.repeat(55)));
          if (options.watch) {
            console.log(chalk.gray('Watching... (Press Ctrl+C to exit)'));
          }
        };

        if (options.watch) {
          // Watch mode - update every 2 seconds
          showStatus();
          const interval = setInterval(showStatus, 2000);

          // Handle Ctrl+C
          process.on('SIGINT', () => {
            clearInterval(interval);
            console.log(chalk.yellow('\n\nStopped watching.'));
            process.exit(0);
          });
        } else {
          // Single status check
          showStatus();
          console.log();
        }
      } catch (error) {
        console.error(chalk.red('Error showing status:'), (error as Error).message);
      }
    });
}
