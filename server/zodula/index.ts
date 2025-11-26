import { ZodulaDoctype } from "./doc";
import { ZodulaSession } from "./session";
import * as serverUtils from "./utils";
import * as clientUtils from "../../client/utils";
import { ctxContext } from "../async-context";
import { ZodulaWebsocketServer } from "./websocket";
import { ZodulaRealtime } from "./realtime";
import { Queue } from "bunmq";
import { logger } from "../logger";
import { loader } from "../loader";
import type { BackgroundMetadata } from "../loader/plugins/background";

export class ZodulaSDK {
    private worker: Queue;
    constructor() {
        this.worker = new Queue(process.env.WORKER_COUNT ? parseInt(process.env.WORKER_COUNT) : 4)
        this.worker.onJobComplete((job) => {
            logger.info(`[Worker] Job ${job.id} completed`)
        })
    }

    doctype<TN extends Zodula.DoctypeName = Zodula.DoctypeName>(doctypeName: TN) {
        return new ZodulaDoctype<TN>(doctypeName)
    }

    get session() {
        return new ZodulaSession()
    }

    get utils() {
        return {
            ...serverUtils,
            ...clientUtils
        }
    }

    get ctx() {
        const ctxStore = ctxContext.getStore()
        return ctxStore?.ctx
    }

    get wss() {
        return new ZodulaWebsocketServer()
    }

    get realtime() {
        return new ZodulaRealtime()
    }

    /**
     * Queue a background function with type safety
     * @param backgroundPath - The background function path (e.g., "zodula.example.sendEmail")
     * @param data - The data to pass to the background function
     * @param options - Queue options
     */
    async enqueue<T extends Zodula.BackgroundPath>(
        backgroundPath: T,
        data: Zodula.BackgroundRequest[T],
        options?: { priority?: number; delay?: number; attempts?: number }
    ) {
        const backgroundLoader = loader.from("background");
        const background = backgroundLoader.get(backgroundPath);

        if (!background) {
            throw new Error(`Background function ${backgroundPath} not found`);
        }
        // Validate input data if schema exists
        let validatedData = data;

        return this.worker.enqueue(background.handler, options, validatedData);
    }
}

export const zodula = new ZodulaSDK()