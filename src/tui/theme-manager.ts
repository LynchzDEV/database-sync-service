import fs from 'fs';
import path from 'path';

export type Theme = 'dark' | 'light';

export interface ThemeColors {
  primary: string;
  secondary: string;
  background: string;
  text: string;
  border: string;
  success: string;
  error: string;
  warning: string;
  info: string;
  selected: {
    bg: string;
    fg: string;
  };
  statusBar: {
    bg: string;
    fg: string;
  };
}

const THEME_FILE = path.join(process.cwd(), '.db-sync', 'theme.json');

export class ThemeManager {
  private static currentTheme: Theme = 'dark';

  static darkTheme: ThemeColors = {
    primary: 'cyan',
    secondary: 'blue',
    background: 'black',
    text: 'white',
    border: 'cyan',
    success: 'green',
    error: 'red',
    warning: 'yellow',
    info: 'cyan',
    selected: {
      bg: 'blue',
      fg: 'white'
    },
    statusBar: {
      bg: 'cyan',
      fg: 'black'
    }
  };

  static lightTheme: ThemeColors = {
    primary: 'blue',
    secondary: 'cyan',
    background: 'white',
    text: 'black',
    border: 'blue',
    success: 'green',
    error: 'red',
    warning: 'yellow',
    info: 'blue',
    selected: {
      bg: 'cyan',
      fg: 'black'
    },
    statusBar: {
      bg: 'blue',
      fg: 'white'
    }
  };

  static loadTheme(): Theme {
    try {
      if (fs.existsSync(THEME_FILE)) {
        const data = JSON.parse(fs.readFileSync(THEME_FILE, 'utf8'));
        this.currentTheme = data.theme || 'dark';
      }
    } catch {
      // Default to dark theme
      this.currentTheme = 'dark';
    }
    return this.currentTheme;
  }

  static saveTheme(theme: Theme): void {
    try {
      const configDir = path.dirname(THEME_FILE);
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }
      fs.writeFileSync(THEME_FILE, JSON.stringify({ theme }, null, 2), 'utf8');
      this.currentTheme = theme;
    } catch (error) {
      // Silently fail
    }
  }

  static getTheme(): Theme {
    return this.currentTheme;
  }

  static getColors(): ThemeColors {
    return this.currentTheme === 'dark' ? this.darkTheme : this.lightTheme;
  }

  static toggleTheme(): Theme {
    const newTheme = this.currentTheme === 'dark' ? 'light' : 'dark';
    this.saveTheme(newTheme);
    return newTheme;
  }
}
