import pino from 'pino'
import moment from 'moment'

type LogLevel = 'info' | 'warn' | 'error' | 'debug'

interface LogContext {
    module?: string
    session?: string
    [key: string]: unknown
}

export default class Logger {
    private logger: pino.Logger
    private moduleName: string

    constructor(module: string = 'core') {
        this.moduleName = module
        this.logger = pino({
            level: process.env.LOG_LEVEL || 'info',
            transport: process.env.NODE_ENV !== 'production' ? {
                target: 'pino-pretty',
                options: {
                    colorize: true,
                    translateTime: 'SYS:standard',
                    ignore: 'pid,hostname'
                }
            } : undefined
        })
    }

    private formatMessage(level: LogLevel, message: string, context?: LogContext): string {
        const timestamp = moment().format('DD/MM HH:mm:ss')
        const prefix = `[${this.moduleName.toUpperCase()}]`
        
        if (context && Object.keys(context).length > 0) {
            const contextStr = Object.entries(context)
                .map(([k, v]) => `${k}=${v}`)
                .join(' ')
            return `${timestamp} ${prefix} ${message} ${contextStr}`
        }
        
        return `${timestamp} ${prefix} ${message}`
    }

    info(message: string, context?: LogContext): void {
        this.logger.info(this.formatMessage('info', message, context))
    }

    warn(message: string, context?: LogContext): void {
        this.logger.warn(this.formatMessage('warn', message, context))
    }

    error(message: string, context?: LogContext): void {
        this.logger.error(this.formatMessage('error', message, context))
    }

    debug(message: string, context?: LogContext): void {
        this.logger.debug(this.formatMessage('debug', message, context))
    }

    child(bindings: LogContext): Logger {
        const child = new Logger(this.moduleName)
        Object.assign(child, { logger: this.logger.child(bindings) })
        return child
    }

    static formatMessage(message: string): string {
        return message
    }
}

export const createLogger = (module: string): Logger => new Logger(module)