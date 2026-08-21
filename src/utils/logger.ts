export class Logger {
  static info(message: string, context?: any): void {
    console.log(`[FRIDAY:INFO] ${message}`, context ? JSON.stringify(context) : '');
  }

  static warn(message: string, context?: any): void {
    console.warn(`[FRIDAY:WARN] ${message}`, context ? JSON.stringify(context) : '');
  }

  static error(message: string, error?: any): void {
    console.error(`[FRIDAY:ERROR] ${message}`, error);
  }
}
