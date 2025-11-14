import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import Table from 'cli-table3';
import configManager from '../../config/config-manager';
import { DatabaseConnection } from '../../utils/database-wrapper';
import { ConnectionConfig } from '../../types';

export function connectionCommands(program: Command): void {
  const connection = program
    .command('connection')
    .alias('conn')
    .description('Manage database connections');

  // Add connection
  connection
    .command('add')
    .description('Add a new database connection')
    .action(async () => {
      try {
        const answers = await inquirer.prompt([
          {
            type: 'input',
            name: 'name',
            message: 'Connection name:',
            validate: (input) => {
              if (!input) return 'Name is required';
              const existing = configManager.getConnection(input);
              if (existing) return 'Connection with this name already exists';
              return true;
            }
          },
          {
            type: 'list',
            name: 'type',
            message: 'Database type:',
            choices: [
              { name: 'MySQL', value: 'mysql' },
              { name: 'PostgreSQL', value: 'postgresql' }
            ],
            default: 'mysql'
          },
          {
            type: 'input',
            name: 'host',
            message: 'Database host:',
            default: 'localhost',
            validate: (input) => input ? true : 'Host is required'
          },
          {
            type: 'number',
            name: 'port',
            message: 'Database port:',
            default: (answers: any) => answers.type === 'postgresql' ? 5432 : 3306,
            validate: (input) => {
              const port = Number(input);
              if (isNaN(port) || port < 1 || port > 65535) {
                return 'Port must be between 1 and 65535';
              }
              return true;
            }
          },
          {
            type: 'input',
            name: 'user',
            message: 'Database user:',
            validate: (input) => input ? true : 'User is required'
          },
          {
            type: 'password',
            name: 'password',
            message: 'Database password:',
            mask: '*'
          },
          {
            type: 'input',
            name: 'database',
            message: 'Database name:',
            validate: (input) => input ? true : 'Database name is required'
          }
        ]);

        // Test connection
        console.log(chalk.yellow('\nTesting connection...'));
        const dbConnection = new DatabaseConnection(answers);

        try {
          await dbConnection.connect();
          await dbConnection.close();
          console.log(chalk.green('✓ Connection successful!'));

          // Save connection
          configManager.addConnection(answers.name, answers);
          console.log(chalk.green(`✓ Connection '${answers.name}' saved successfully!`));
        } catch (error) {
          console.error(chalk.red(`✗ Connection failed: ${(error as Error).message}`));
          const { retry } = await inquirer.prompt([
            {
              type: 'confirm',
              name: 'retry',
              message: 'Would you like to try again?',
              default: true
            }
          ]);

          if (retry) {
            await connection.commands.find(cmd => cmd.name() === 'add')?.parseAsync(['add'], { from: 'user' });
          }
        }
      } catch (error) {
        console.error(chalk.red('Error adding connection:'), (error as Error).message);
      }
    });

  // List connections
  connection
    .command('list')
    .alias('ls')
    .description('List all database connections')
    .action(() => {
      try {
        const connections = configManager.listConnections();
        const connectionList = Object.entries(connections);

        if (connectionList.length === 0) {
          console.log(chalk.yellow('No connections found. Use "db-sync connection add" to add one.'));
          return;
        }

        const table = new Table({
          head: [
            chalk.cyan('Name'),
            chalk.cyan('Type'),
            chalk.cyan('Host'),
            chalk.cyan('Port'),
            chalk.cyan('Database'),
            chalk.cyan('User')
          ],
          colWidths: [20, 12, 20, 8, 25, 20]
        });

        connectionList.forEach(([name, config]) => {
          table.push([
            name,
            config.type || 'mysql',
            config.host,
            config.port.toString(),
            config.database,
            config.user
          ]);
        });

        console.log('\n' + table.toString() + '\n');
      } catch (error) {
        console.error(chalk.red('Error listing connections:'), (error as Error).message);
      }
    });

  // Remove connection
  connection
    .command('remove <name>')
    .alias('rm')
    .description('Remove a database connection')
    .action(async (name: string) => {
      try {
        const connection = configManager.getConnection(name);
        if (!connection) {
          console.log(chalk.yellow(`Connection '${name}' not found.`));
          return;
        }

        const { confirm } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'confirm',
            message: `Are you sure you want to remove connection '${name}'?`,
            default: false
          }
        ]);

        if (confirm) {
          configManager.removeConnection(name);
          console.log(chalk.green(`✓ Connection '${name}' removed successfully!`));
        } else {
          console.log(chalk.yellow('Operation cancelled.'));
        }
      } catch (error) {
        console.error(chalk.red('Error removing connection:'), (error as Error).message);
      }
    });

  // Test connection
  connection
    .command('test <name>')
    .description('Test a database connection')
    .action(async (name: string) => {
      try {
        const connectionConfig = configManager.getConnection(name);
        if (!connectionConfig) {
          console.log(chalk.yellow(`Connection '${name}' not found.`));
          return;
        }

        console.log(chalk.yellow(`Testing connection '${name}'...`));
        const dbConnection = new DatabaseConnection(connectionConfig);

        await dbConnection.connect();
        await dbConnection.close();

        console.log(chalk.green(`✓ Connection '${name}' is working!`));
      } catch (error) {
        console.error(chalk.red(`✗ Connection failed: ${(error as Error).message}`));
      }
    });
}
