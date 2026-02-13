const fs = require('fs');
const path = require('path');

/**
 * Logger class - captures console output to file
 * Each platform (tiktok, facebook, etc.) gets its own log file
 * Each new run overwrites the previous log file
 */
class Logger {
    constructor(platform) {
        this.platform = platform;
        this.logDir = path.resolve(__dirname, '../../logs');
        this.logFile = path.join(this.logDir, `${platform}.txt`);

        // Create logs directory if not exists
        if (!fs.existsSync(this.logDir)) {
            fs.mkdirSync(this.logDir, { recursive: true });
        }

        // Clear/create log file (overwrite mode)
        const timestamp = new Date().toISOString();
        const header = `═══════════════════════════════════════════\n` +
                      `  ${platform.toUpperCase()} - Log Session\n` +
                      `  ${timestamp}\n` +
                      `═══════════════════════════════════════════\n\n`;
        fs.writeFileSync(this.logFile, header);

        // Save original console methods
        this.originalLog = console.log;
        this.originalError = console.error;
        this.originalWarn = console.warn;

        // Override console methods
        this.setupConsoleOverride();

        console.log(`📝 Logging to: ${this.logFile}`);
    }

    setupConsoleOverride() {
        const self = this;

        console.log = function(...args) {
            const message = self.formatMessage(args);

            // Write to file
            fs.appendFileSync(self.logFile, message + '\n', 'utf8');

            // Call original console.log
            self.originalLog.apply(console, args);
        };

        console.error = function(...args) {
            const message = self.formatMessage(args);

            fs.appendFileSync(self.logFile, '[ERROR] ' + message + '\n', 'utf8');
            self.originalError.apply(console, args);
        };

        console.warn = function(...args) {
            const message = self.formatMessage(args);

            fs.appendFileSync(self.logFile, '[WARN] ' + message + '\n', 'utf8');
            self.originalWarn.apply(console, args);
        };
    }

    formatMessage(args) {
        return args.map(arg => {
            if (typeof arg === 'object') {
                try {
                    return JSON.stringify(arg, null, 2);
                } catch (e) {
                    return String(arg);
                }
            }
            return String(arg);
        }).join(' ');
    }

    /**
     * Restore original console methods
     * Call this in finally block to cleanup
     */
    restore() {
        console.log = this.originalLog;
        console.error = this.originalError;
        console.warn = this.originalWarn;
    }

    /**
     * Get log file path
     */
    getLogPath() {
        return this.logFile;
    }
}

/**
 * Initialize logger for a platform
 * @param {string} platform - Platform name (e.g., 'tiktok', 'facebook', 'instagram')
 * @returns {Logger} - Logger instance
 *
 * @example
 * const { initLogger } = require('../shared/logger');
 * const logger = initLogger('tiktok');
 * try {
 *     // Your code here
 *     console.log('This will be logged to file');
 * } finally {
 *     logger.restore();
 * }
 */
function initLogger(platform) {
    return new Logger(platform);
}

module.exports = { initLogger, Logger };
