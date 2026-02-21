import { mkdirSync, appendFileSync, existsSync } from 'fs';
import { join } from 'path';

// Log directory
const LOGS_DIR = join(process.cwd(), 'logs');

// Create logs directory if it doesn't exist
if (!existsSync(LOGS_DIR)) {
  mkdirSync(LOGS_DIR, { recursive: true });
}

// Log levels
export enum LogLevel {
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
  DEBUG = 'DEBUG'
}

// Log categories
export enum LogCategory {
  SERVER = 'server',
  API = 'api',
  CONFIG = 'config',
  GIT = 'git',
  PROJECT = 'project'
}

interface LogMeta {
  [key: string]: any;
}

/**
 * Get log file path for a category
 * Format: logs/<category>-YYYY-MM-DD.log
 */
function getLogFilePath(category: string): string {
  const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  return join(LOGS_DIR, `${category}-${date}.log`);
}

/**
 * Format log message
 * Format: [ISO_TIMESTAMP] [LEVEL] [CATEGORY] MESSAGE {JSON(meta)?}
 */
function formatMessage(
  level: LogLevel,
  category: string,
  message: string,
  meta?: LogMeta
): string {
  const timestamp = new Date().toISOString();
  let formatted = `[${timestamp}] [${level}] [${category}] ${message}`;
  
  if (meta && Object.keys(meta).length > 0) {
    formatted += ` ${JSON.stringify(meta)}`;
  }
  
  return formatted;
}

/**
 * Write log to file and console
 */
function writeLog(
  level: LogLevel,
  category: string,
  message: string,
  meta?: LogMeta,
  stream: NodeJS.WriteStream = process.stdout
): void {
  const formatted = formatMessage(level, category, message, meta);
  
  // Write to console
  stream.write(formatted + '\n');
  
  // Write to file
  try {
    const logFile = getLogFilePath(category);
    appendFileSync(logFile, formatted + '\n', 'utf-8');
  } catch (error) {
    console.error('Failed to write to log file:', error);
  }
}

/**
 * Logger class
 */
class Logger {
  /**
   * Log info message
   */
  info(category: string, message: string, meta?: LogMeta): void {
    writeLog(LogLevel.INFO, category, message, meta, process.stdout);
  }

  /**
   * Log warning message
   */
  warn(category: string, message: string, meta?: LogMeta): void {
    writeLog(LogLevel.WARN, category, message, meta, process.stdout);
  }

  /**
   * Log error message
   */
  error(category: string, message: string, meta?: LogMeta): void {
    writeLog(LogLevel.ERROR, category, message, meta, process.stderr);
  }

  /**
   * Log debug message (only if DEBUG env var is set)
   */
  debug(category: string, message: string, meta?: LogMeta): void {
    if (process.env.DEBUG) {
      writeLog(LogLevel.DEBUG, category, message, meta, process.stdout);
    }
  }
}

// Export singleton instance
export const logger = new Logger();
