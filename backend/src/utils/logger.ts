import winston from 'winston';

const logLevel = process.env.LOG_LEVEL || 'info';

// Define log format
const logFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
);

// Console transport is ALWAYS attached: on PaaS hosts (Railway/Fly/Render/etc.)
// the filesystem is ephemeral and the platform only ingests stdout/stderr —
// without this transport startup logs are invisible and crashes look silent.
const consoleTransport = new winston.transports.Console({
    format: process.env.NODE_ENV === 'production'
        ? logFormat
        : winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
        ),
});

// Create the logger
export const logger = winston.createLogger({
    level: logLevel,
    format: logFormat,
    defaultMeta: { service: 'sistema-backend' },
    transports: [
        consoleTransport,
        // Write all logs with level 'error' and below to error.log
        new winston.transports.File({
            filename: 'logs/error.log',
            level: 'error',
            maxsize: 5242880, // 5MB
            maxFiles: 5,
        }),
        // Write all logs to combined.log
        new winston.transports.File({
            filename: 'logs/combined.log',
            maxsize: 5242880, // 5MB
            maxFiles: 10,
        }),
    ],
});

// Create a stream object for Morgan HTTP logger
export const loggerStream = {
    write: (message: string) => {
        logger.info(message.trim());
    },
};

export default logger;
