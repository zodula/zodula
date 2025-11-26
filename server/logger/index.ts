import signale from "signale"

export let logger = signale

export class LoggerHelper {
    private oldLog: any
    private oldWarn: any
    private oldError: any
    private oldDebug: any
    private oldInfo: any

    constructor() {
        this.oldLog = logger.log
        this.oldWarn = logger.warn
        this.oldError = logger.error
        this.oldDebug = logger.debug
        this.oldInfo = logger.info
    }

    disable() {
        logger.log = () => { }
        logger.warn = () => { }
        logger.error = () => { }
        logger.debug = () => { }
        logger.info = () => { }
    }

    enable() {
        logger.log = this.oldLog
        logger.warn = this.oldWarn
        logger.error = this.oldError
        logger.debug = this.oldDebug
        logger.info = this.oldInfo
    }
}