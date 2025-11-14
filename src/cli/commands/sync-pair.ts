import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import Table from 'cli-table3';
import configManager from '../../config/config-manager';

export function syncPairCommands(program: Command): void {
  const syncPair = program
    .command('sync')
    .description('Manage synchronization pairs');

  // Add sync pair
  syncPair
    .command('add')
    .description('Add a new sync pair')
    .action(async () => {
      try {
        const connections = Object.keys(configManager.listConnections());

        if (connections.length < 2) {
          console.log(chalk.yellow('You need at least 2 connections to create a sync pair.'));
          console.log(chalk.yellow('Use "db-sync connection add" to add connections.'));
          return;
        }

        const answers = await inquirer.prompt([
          {
            type: 'input',
            name: 'name',
            message: 'Sync pair name:',
            validate: (input) => {
              if (!input) return 'Name is required';
              const existing = configManager.getSyncPair(input);
              if (existing) return 'Sync pair with this name already exists';
              return true;
            }
          },
          {
            type: 'list',
            name: 'source',
            message: 'Source database (changes will be read from here):',
            choices: connections
          },
          {
            type: 'list',
            name: 'target',
            message: 'Target database (changes will be applied here):',
            choices: (answers) => connections.filter(c => c !== answers.source)
          },
          {
            type: 'checkbox',
            name: 'syncOptions',
            message: 'What should be synchronized?',
            choices: [
              { name: 'Schema (tables, columns, indexes)', value: 'schema', checked: true },
              { name: 'Data (insert, update, delete)', value: 'data', checked: true },
              { name: 'Procedures and Functions', value: 'procedures', checked: true }
            ],
            validate: (input) => input.length > 0 || 'Select at least one option'
          },
          {
            type: 'confirm',
            name: 'filterTables',
            message: 'Would you like to filter which tables to sync?',
            default: false
          }
        ]);

        let includeTables: string[] = [];
        let excludeTables: string[] = [];

        if (answers.filterTables) {
          const filterAnswers = await inquirer.prompt([
            {
              type: 'list',
              name: 'filterType',
              message: 'Filter type:',
              choices: [
                { name: 'Include only specific tables', value: 'include' },
                { name: 'Exclude specific tables', value: 'exclude' }
              ]
            },
            {
              type: 'input',
              name: 'tables',
              message: 'Enter table names (comma-separated):',
              filter: (input) => input.split(',').map((t: string) => t.trim()).filter((t: string) => t)
            }
          ]);

          if (filterAnswers.filterType === 'include') {
            includeTables = filterAnswers.tables;
          } else {
            excludeTables = filterAnswers.tables;
          }
        }

        const syncPairConfig = configManager.addSyncPair(
          answers.name,
          answers.source,
          answers.target,
          {
            syncSchema: answers.syncOptions.includes('schema'),
            syncData: answers.syncOptions.includes('data'),
            syncProcedures: answers.syncOptions.includes('procedures'),
            includeTables,
            excludeTables
          }
        );

        console.log(chalk.green(`\n✓ Sync pair '${answers.name}' created successfully!`));
        console.log(chalk.cyan('\nConfiguration:'));
        console.log(`  Source: ${syncPairConfig.source}`);
        console.log(`  Target: ${syncPairConfig.target}`);
        console.log(`  Schema sync: ${syncPairConfig.syncSchema ? 'Yes' : 'No'}`);
        console.log(`  Data sync: ${syncPairConfig.syncData ? 'Yes' : 'No'}`);
        console.log(`  Procedures sync: ${syncPairConfig.syncProcedures ? 'Yes' : 'No'}`);
        if (includeTables.length > 0) {
          console.log(`  Include tables: ${includeTables.join(', ')}`);
        }
        if (excludeTables.length > 0) {
          console.log(`  Exclude tables: ${excludeTables.join(', ')}`);
        }
        console.log(chalk.yellow('\nUse "db-sync service start" to begin synchronization.\n'));
      } catch (error) {
        console.error(chalk.red('Error adding sync pair:'), (error as Error).message);
      }
    });

  // List sync pairs
  syncPair
    .command('list')
    .alias('ls')
    .description('List all sync pairs')
    .action(() => {
      try {
        const syncPairs = configManager.listSyncPairs();

        if (syncPairs.length === 0) {
          console.log(chalk.yellow('No sync pairs found. Use "db-sync sync add" to add one.'));
          return;
        }

        const table = new Table({
          head: [
            chalk.cyan('Name'),
            chalk.cyan('Source'),
            chalk.cyan('Target'),
            chalk.cyan('Status'),
            chalk.cyan('Schema'),
            chalk.cyan('Data'),
            chalk.cyan('Procedures'),
            chalk.cyan('Last Sync')
          ]
        });

        syncPairs.forEach((pair) => {
          table.push([
            pair.name,
            pair.source,
            pair.target,
            pair.enabled ? chalk.green('Enabled') : chalk.red('Disabled'),
            pair.syncSchema ? '✓' : '✗',
            pair.syncData ? '✓' : '✗',
            pair.syncProcedures ? '✓' : '✗',
            pair.lastSync ? new Date(pair.lastSync).toLocaleString() : 'Never'
          ]);
        });

        console.log('\n' + table.toString() + '\n');
      } catch (error) {
        console.error(chalk.red('Error listing sync pairs:'), (error as Error).message);
      }
    });

  // Remove sync pair
  syncPair
    .command('remove <name>')
    .alias('rm')
    .description('Remove a sync pair')
    .action(async (name: string) => {
      try {
        const pair = configManager.getSyncPair(name);
        if (!pair) {
          console.log(chalk.yellow(`Sync pair '${name}' not found.`));
          return;
        }

        const { confirm } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'confirm',
            message: `Are you sure you want to remove sync pair '${name}'?`,
            default: false
          }
        ]);

        if (confirm) {
          configManager.removeSyncPair(name);
          console.log(chalk.green(`✓ Sync pair '${name}' removed successfully!`));
        } else {
          console.log(chalk.yellow('Operation cancelled.'));
        }
      } catch (error) {
        console.error(chalk.red('Error removing sync pair:'), (error as Error).message);
      }
    });

  // Enable sync pair
  syncPair
    .command('enable <name>')
    .description('Enable a sync pair')
    .action((name: string) => {
      try {
        const pair = configManager.getSyncPair(name);
        if (!pair) {
          console.log(chalk.yellow(`Sync pair '${name}' not found.`));
          return;
        }

        configManager.updateSyncPairStatus(name, true);
        console.log(chalk.green(`✓ Sync pair '${name}' enabled!`));
      } catch (error) {
        console.error(chalk.red('Error enabling sync pair:'), (error as Error).message);
      }
    });

  // Disable sync pair
  syncPair
    .command('disable <name>')
    .description('Disable a sync pair')
    .action((name: string) => {
      try {
        const pair = configManager.getSyncPair(name);
        if (!pair) {
          console.log(chalk.yellow(`Sync pair '${name}' not found.`));
          return;
        }

        configManager.updateSyncPairStatus(name, false);
        console.log(chalk.green(`✓ Sync pair '${name}' disabled!`));
      } catch (error) {
        console.error(chalk.red('Error disabling sync pair:'), (error as Error).message);
      }
    });
}
