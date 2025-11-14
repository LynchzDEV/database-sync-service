import { Command } from 'commander';
import chalk from 'chalk';
import { spawn, exec } from 'child_process';
import path from 'path';
import fs from 'fs';

const PID_FILE = path.join(process.cwd(), '.db-sync', 'service.pid');

export function serviceCommands(program: Command): void {
  const service = program
    .command('service')
    .description('Control the synchronization service');

  // Start service
  service
    .command('start')
    .description('Start the synchronization service')
    .option('-d, --daemon', 'Run as background daemon')
    .action(async (options) => {
      try {
        // Check if already running
        if (fs.existsSync(PID_FILE)) {
          const pid = fs.readFileSync(PID_FILE, 'utf8').trim();
          try {
            process.kill(Number(pid), 0); // Check if process exists
            console.log(chalk.yellow('Service is already running.'));
            console.log(chalk.yellow(`PID: ${pid}`));
            console.log(chalk.cyan('Use "db-sync service stop" to stop it first.'));
            return;
          } catch {
            // Process doesn't exist, remove stale PID file
            fs.unlinkSync(PID_FILE);
          }
        }

        if (options.daemon) {
          // Run as daemon
          const daemonPath = path.join(__dirname, '../../../dist/service/daemon.js');

          if (!fs.existsSync(daemonPath)) {
            console.log(chalk.yellow('Service not built. Building now...'));
            exec('npm run build', (error) => {
              if (error) {
                console.error(chalk.red('Build failed:'), error.message);
                return;
              }
              startDaemon(daemonPath);
            });
          } else {
            startDaemon(daemonPath);
          }
        } else {
          // Run in foreground
          console.log(chalk.cyan('Starting synchronization service...\n'));
          require('../../service/daemon');
        }
      } catch (error) {
        console.error(chalk.red('Error starting service:'), (error as Error).message);
      }
    });

  // Stop service
  service
    .command('stop')
    .description('Stop the synchronization service')
    .action(() => {
      try {
        if (!fs.existsSync(PID_FILE)) {
          console.log(chalk.yellow('Service is not running.'));
          return;
        }

        const pid = fs.readFileSync(PID_FILE, 'utf8').trim();

        try {
          process.kill(Number(pid), 'SIGTERM');
          fs.unlinkSync(PID_FILE);
          console.log(chalk.green('✓ Service stopped successfully!'));
        } catch (error) {
          console.error(chalk.red('Failed to stop service:'), (error as Error).message);
          // Remove stale PID file
          if (fs.existsSync(PID_FILE)) {
            fs.unlinkSync(PID_FILE);
          }
        }
      } catch (error) {
        console.error(chalk.red('Error stopping service:'), (error as Error).message);
      }
    });

  // Restart service
  service
    .command('restart')
    .description('Restart the synchronization service')
    .action(async () => {
      try {
        console.log(chalk.yellow('Restarting service...'));

        // Stop if running
        if (fs.existsSync(PID_FILE)) {
          const pid = fs.readFileSync(PID_FILE, 'utf8').trim();
          try {
            process.kill(Number(pid), 'SIGTERM');
            fs.unlinkSync(PID_FILE);
            console.log(chalk.green('✓ Service stopped'));
          } catch {
            // Process not running, remove stale PID
            if (fs.existsSync(PID_FILE)) {
              fs.unlinkSync(PID_FILE);
            }
          }
        }

        // Wait a bit before starting
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Start service
        const daemonPath = path.join(__dirname, '../../../dist/service/daemon.js');
        startDaemon(daemonPath);
      } catch (error) {
        console.error(chalk.red('Error restarting service:'), (error as Error).message);
      }
    });

  // Service status
  service
    .command('status')
    .description('Check service status')
    .action(() => {
      try {
        if (!fs.existsSync(PID_FILE)) {
          console.log(chalk.yellow('Service is not running.'));
          return;
        }

        const pid = fs.readFileSync(PID_FILE, 'utf8').trim();

        try {
          process.kill(Number(pid), 0);
          console.log(chalk.green('✓ Service is running'));
          console.log(chalk.cyan(`PID: ${pid}`));
        } catch {
          console.log(chalk.red('✗ Service is not running (stale PID file found)'));
          fs.unlinkSync(PID_FILE);
        }
      } catch (error) {
        console.error(chalk.red('Error checking service status:'), (error as Error).message);
      }
    });
}

function startDaemon(daemonPath: string): void {
  const child = spawn('node', [daemonPath], {
    detached: true,
    stdio: 'ignore'
  });

  child.unref();

  // Save PID
  const configDir = path.join(process.cwd(), '.db-sync');
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }

  fs.writeFileSync(PID_FILE, child.pid?.toString() || '', 'utf8');

  console.log(chalk.green('✓ Service started in background!'));
  console.log(chalk.cyan(`PID: ${child.pid}`));
  console.log(chalk.cyan('Use "db-sync service status" to check status.'));
  console.log(chalk.cyan('Logs are written to ./logs/ directory.'));
}
