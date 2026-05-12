import type {
    IService,
    ServiceFactory,
    ServiceToken,
    IServiceContainer,
    ServiceResolver
} from './types.js'

interface ServiceEntry {
    instance?: IService
    factory?: ServiceFactory<IService>
    isSingleton: boolean
}

export class ServiceContainer implements IServiceContainer {
    private services = new Map<ServiceToken, ServiceEntry>()
    private instances = new Map<ServiceToken, unknown>()
    private pending = new Map<ServiceToken, Promise<unknown>>()
    private resolving = new Set<ServiceToken>()

    register<T extends IService>(token: ServiceToken, factory: ServiceFactory<T>): void {
        this.services.set(token, { factory, isSingleton: true })
    }

    registerSingleton<T extends IService>(token: ServiceToken, instance: T): void {
        this.services.set(token, { instance, isSingleton: true })
    }

    registerInstance<T>(token: ServiceToken, instance: T): void {
        this.instances.set(token, instance)
    }

    resolve<T>(token: ServiceToken): T {
        const resolved = this.resolveOptional<T>(token)
        if (resolved === undefined) {
            throw new Error(`Service not registered: ${String(token)}`)
        }
        return resolved
    }

    resolveOptional<T>(token: ServiceToken): T | undefined {
        if (this.instances.has(token)) {
            return this.instances.get(token) as T
        }

        const entry = this.services.get(token)
        if (!entry) {
            return undefined
        }

        if (entry.instance) {
            if (entry.isSingleton) {
                this.instances.set(token, entry.instance)
            }
            return entry.instance as T
        }

        if (entry.factory) {
            const instance = entry.factory()
            if (instance instanceof Promise) {
                throw new Error(`Cannot resolve async service "${String(token)}" via resolve(). Use resolveAsync().`)
            }
            if (entry.isSingleton) {
                this.instances.set(token, instance)
            }
            return instance as T
        }

        return undefined
    }

    async resolveAsync<T>(token: ServiceToken): Promise<T> {
        if (this.resolving.has(token)) {
            throw new Error(`Circular dependency detected while resolving "${String(token)}"`)
        }

        if (this.instances.has(token)) {
            return this.instances.get(token) as T
        }

        if (this.pending.has(token)) {
            return this.pending.get(token) as Promise<T>
        }

        const entry = this.services.get(token)
        if (!entry) {
            throw new Error(`Service not registered: ${String(token)}`)
        }

        if (entry.instance) {
            if (entry.isSingleton) {
                this.instances.set(token, entry.instance)
            }
            return entry.instance as T
        }

        if (entry.factory) {
            if (!entry.isSingleton) {
                const instance = await entry.factory()
                return instance as T
            }

            this.resolving.add(token)
            try {
                const factoryResult = entry.factory()
                const normalizedPromise = Promise.resolve(factoryResult) as Promise<T>
                const promise = normalizedPromise.then(inst => {
                    this.pending.delete(token)
                    this.instances.set(token, inst)
                    return inst
                }).catch((err: unknown) => {
                    this.pending.delete(token)
                    throw err instanceof Error ? err : new Error(String(err))
                })
                this.pending.set(token, promise as Promise<unknown>)
                return promise
            } finally {
                this.resolving.delete(token)
            }
        }

        throw new Error(`Service not registered: ${String(token)}`)
    }

    resolveAsyncOptional<T>(token: ServiceToken): Promise<T | undefined> {
        return this.resolveAsync<T>(token).catch(() => undefined as T)
    }

    has(token: ServiceToken): boolean {
        return this.services.has(token) || this.instances.has(token)
    }

    getRegisteredServices(): readonly ServiceToken[] {
        return Array.from(this.services.keys())
    }

    async initialize(): Promise<void> {
        const initOrder: IService[] = []

        for (const [token, entry] of this.services.entries()) {
            if (entry.instance && typeof (entry.instance as IService).initialize === 'function') {
                initOrder.push(entry.instance)
            }
        }

        for (const service of initOrder) {
            try {
                await service.initialize()
            } catch (error) {
                console.error(`Failed to initialize service ${service.name}:`, error)
            }
        }
    }

    async shutdown(): Promise<void> {
        const shutdownOrder: IService[] = []

        for (const [token, entry] of this.services.entries()) {
            if (entry.instance && typeof (entry.instance as IService).shutdown === 'function') {
                shutdownOrder.push(entry.instance)
            }
        }

        shutdownOrder.reverse()

        for (const service of shutdownOrder) {
            try {
                await service.shutdown()
            } catch (error) {
                console.error(`Failed to shutdown service ${service.name}:`, error)
            }
        }

        this.instances.clear()
        this.pending.clear()
        this.services.clear()
    }

    createResolver<T>(token: ServiceToken): ServiceResolver<T> {
        return {
            get: () => this.resolve<T>(token),
            getOptional: () => this.resolveOptional<T>(token)
        }
    }
}

let containerInstance: ServiceContainer | null = null

export function getServiceContainer(): ServiceContainer {
    if (!containerInstance) {
        containerInstance = new ServiceContainer()
    }
    return containerInstance
}

export function createServiceContainer(): ServiceContainer {
    return new ServiceContainer()
}