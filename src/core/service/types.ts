export interface IService {
    readonly name: string

    initialize(): Promise<void>
    shutdown(): Promise<void>
}

export type ServiceFactory<T extends IService> = () => T | Promise<T>

export type ServiceResolver<T> = {
    get(): T
    getOptional(): T | undefined
}

export type ServiceToken = string | symbol

export interface IServiceContainer {
    register<T extends IService>(token: ServiceToken, factory: ServiceFactory<T>): void
    registerSingleton<T extends IService>(token: ServiceToken, instance: T): void
    registerInstance<T>(token: ServiceToken, instance: T): void

    resolve<T>(token: ServiceToken): T
    resolveOptional<T>(token: ServiceToken): T | undefined
    resolveAsync<T>(token: ServiceToken): Promise<T>
    resolveAsyncOptional<T>(token: ServiceToken): Promise<T | undefined>

    has(token: ServiceToken): boolean

    getRegisteredServices(): readonly ServiceToken[]

    initialize(): Promise<void>
    shutdown(): Promise<void>
}

export const SERVICE_TOKENS = {
    DATABASE: 'database',
    CACHE: 'cache',
    MEDIA: 'media',
    AI: 'ai',
    SERIALIZER: 'serializer',
    EVENT_BUS: 'event-bus',
    MIDDLEWARE_CHAIN: 'middleware-chain',
    MESSAGE_DISPATCHER: 'message-dispatcher',
    GROUP_DISPATCHER: 'group-dispatcher',
    CALL_DISPATCHER: 'call-dispatcher',
    PRESENCE_DISPATCHER: 'presence-dispatcher',
    CONFIG: 'config',
    SOCKET_MANAGER: 'socket-manager'
} as const