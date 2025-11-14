import { spawn, exec } from 'child_process';
import path from 'path';
import fs from 'fs';

const PID_FILE = path.join(process.cwd(), '.db-sync', 'service.pid');

export interface ServiceStatus {
  isRunning: boolean;
  pid: string | null;
  uptime: string | null;
}

export class ServiceController {
  static getStatus(): ServiceStatus {
    try {
      if (!fs.existsSync(PID_FILE)) {
        return { isRunning: false, pid: null, uptime: null };
      }

      const pid = fs.readFileSync(PID_FILE, 'utf8').trim();

      try {
        process.kill(Number(pid), 0); // Check if process exists
        return {
          isRunning: true,
          pid,
          uptime: this.getUptime()
        };
      } catch {
        // Process doesn't exist, stale PID file
        return { isRunning: false, pid: null, uptime: null };
      }
    } catch {
      return { isRunning: false, pid: null, uptime: null };
    }
  }

  static async start(): Promise<{ success: boolean; message: string }> {
    try {
      // Check if already running
      if (fs.existsSync(PID_FILE)) {
        const pid = fs.readFileSync(PID_FILE, 'utf8').trim();
        try {
          process.kill(Number(pid), 0);
          return {
            success: false,
            message: `Service is already running (PID: ${pid})`
          };
        } catch {
          // Stale PID file, remove it
          fs.unlinkSync(PID_FILE);
        }
      }

      const daemonPath = path.join(__dirname, '../../dist/service/daemon.js');

      if (!fs.existsSync(daemonPath)) {
        return {
          success: false,
          message: 'Service not built. Run "npm run build" first.'
        };
      }

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

      return {
        success: true,
        message: `Service started successfully (PID: ${child.pid})`
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to start service: ${(error as Error).message}`
      };
    }
  }

  static async stop(): Promise<{ success: boolean; message: string }> {
    try {
      if (!fs.existsSync(PID_FILE)) {
        return {
          success: false,
          message: 'Service is not running'
        };
      }

      const pid = fs.readFileSync(PID_FILE, 'utf8').trim();

      try {
        process.kill(Number(pid), 'SIGTERM');
        fs.unlinkSync(PID_FILE);
        return {
          success: true,
          message: 'Service stopped successfully'
        };
      } catch (error) {
        // Remove stale PID file
        if (fs.existsSync(PID_FILE)) {
          fs.unlinkSync(PID_FILE);
        }
        return {
          success: false,
          message: `Failed to stop service: ${(error as Error).message}`
        };
      }
    } catch (error) {
      return {
        success: false,
        message: `Error stopping service: ${(error as Error).message}`
      };
    }
  }

  static async restart(): Promise<{ success: boolean; message: string }> {
    const stopResult = await this.stop();
    if (!stopResult.success && stopResult.message !== 'Service is not running') {
      return stopResult;
    }

    // Wait a bit before starting
    await new Promise(resolve => setTimeout(resolve, 1000));

    return await this.start();
  }

  private static getUptime(): string {
    try {
      const stats = fs.statSync(PID_FILE);
      const startTime = stats.mtimeMs;
      const uptime = Date.now() - startTime;
      const seconds = Math.floor(uptime / 1000);
      const minutes = Math.floor(seconds / 60);
      const hours = Math.floor(minutes / 60);

      if (hours > 0) {
        return `${hours}h ${minutes % 60}m`;
      } else if (minutes > 0) {
        return `${minutes}m ${seconds % 60}s`;
      } else {
        return `${seconds}s`;
      }
    } catch {
      return 'N/A';
    }
  }
}
