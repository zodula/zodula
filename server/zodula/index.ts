import { ZodulaDoctype } from "./doc";
import { ZodulaSession } from "./session";
import { ZodulaEmail } from "./email";
import * as serverUtils from "./utils";
import * as clientUtils from "../../client/utils";
import { ctxContext } from "../async-context";
import { ZodulaWebsocketServer } from "./websocket";
import { ZodulaRealtime, broadcastToUsers } from "./realtime";
import { Queue, type JobData } from "bunmq";
import { logger } from "../logger";
import { loader } from "../loader";
import type { BackgroundMetadata } from "../loader/plugins/background";
import { Database } from "../database/database";
import { globalContext } from "../async-context";

// Extended JobData with requester
interface ExtendedJobData extends JobData {
    requester?: string | null;
    backgroundPath?: string;
}

export class ZodulaSDK {
    private worker: Queue;
    private jobMetadata: Map<string, { requester: string | null; backgroundPath: string }> = new Map();
    private _emailInstance: ZodulaEmail | null = null;
    
    constructor() {
        this.worker = new Queue(process.env.WORKER_COUNT ? parseInt(process.env.WORKER_COUNT) : 4)
        
        this.worker.onJobStart((job: JobData) => {
            this.handleJobStart(job as ExtendedJobData);
        });
        
        this.worker.onJobComplete((job: JobData, result: any) => {
            this.handleJobComplete(job as ExtendedJobData, result);
        });
        
        this.worker.onJobError((job: JobData, error: string) => {
            this.handleJobError(job as ExtendedJobData, error);
        });
        
        this.worker.onJobRetry((job: JobData, attempt: number) => {
            this.handleJobRetry(job as ExtendedJobData, attempt);
        });
        
        this.worker.onJobFailed((job: JobData, error: string) => {
            this.handleJobFailed(job as ExtendedJobData, error);
        });
    }
    
    private async handleJobStart(job: ExtendedJobData) {
        const metadata = this.jobMetadata.get(job.id);
        if (!metadata) return;
        
        await this.updateJobLog(job.id, {
            status: "active",
            started_at: new Date().toISOString()
        });
        
        this.broadcastJobEvent(metadata.backgroundPath, "start", {
            job_id: job.id,
            status: "active",
            started_at: new Date().toISOString()
        }, metadata.requester);
    }
    
    private async handleJobComplete(job: ExtendedJobData, result: any) {
        const metadata = this.jobMetadata.get(job.id);
        if (!metadata) return;
        
        await this.updateJobLog(job.id, {
            status: "completed",
            completed_at: new Date().toISOString(),
            result: result ? JSON.stringify(result) : null
        });
        
        this.broadcastJobEvent(metadata.backgroundPath, "complete", {
            job_id: job.id,
            status: "completed",
            result: result,
            completed_at: new Date().toISOString()
        }, metadata.requester);
        
        this.jobMetadata.delete(job.id);
    }
    
    private async handleJobError(job: ExtendedJobData, error: string) {
        const metadata = this.jobMetadata.get(job.id);
        if (!metadata) return;
        
        await this.updateJobLog(job.id, {
            status: job.status === "failed" ? "failed" : "active",
            error: error,
            attempts: job.attempts
        });
        
        this.broadcastJobEvent(metadata.backgroundPath, "error", {
            job_id: job.id,
            status: job.status,
            error: error,
            attempts: job.attempts
        }, metadata.requester);
    }
    
    private async handleJobRetry(job: ExtendedJobData, attempt: number) {
        const metadata = this.jobMetadata.get(job.id);
        if (!metadata) return;
        
        await this.updateJobLog(job.id, {
            attempts: attempt
        });
        
        this.broadcastJobEvent(metadata.backgroundPath, "retry", {
            job_id: job.id,
            attempts: attempt
        }, metadata.requester);
    }
    
    private async handleJobFailed(job: ExtendedJobData, error: string) {
        const metadata = this.jobMetadata.get(job.id);
        if (!metadata) return;
        
        await this.updateJobLog(job.id, {
            status: "failed",
            error: error,
            completed_at: new Date().toISOString()
        });
        
        this.broadcastJobEvent(metadata.backgroundPath, "failed", {
            job_id: job.id,
            status: "failed",
            error: error,
            completed_at: new Date().toISOString()
        }, metadata.requester);
        
        this.jobMetadata.delete(job.id);
    }
    
    private async updateJobLog(jobId: string, updates: any) {
        try {
            globalContext.enterWith({
                global: { bypass: true }
            });
            
            const db = Database("main");
            const existing = await db
                .select("*")
                .from("Background Job Log" as Zodula.DoctypeName)
                .where("job_id", "=", jobId)
                .first();
            
            if (existing) {
                await zodula.doctype("Background Job Log")
                    .update(existing.id, updates as any)
                    .bypass(true);
            }
        } catch (error) {
            logger.error(`Failed to update job log for ${jobId}:`, error);
        }
    }
    
    private broadcastJobEvent(backgroundPath: string, event: string, data: any, requester: string | null) {
        if (!requester) return;
        
        const message = JSON.stringify({
            type: "background_event",
            background_path: backgroundPath,
            event: event,
            data: data
        });
        
        broadcastToUsers([requester], message);
    }

    doctype<TN extends Zodula.DoctypeName = Zodula.DoctypeName>(doctypeName: TN) {
        return new ZodulaDoctype<TN>(doctypeName)
    }

    get session() {
        return new ZodulaSession()
    }

    get email(): ZodulaEmail {
        if (!this._emailInstance) {
            this._emailInstance = new ZodulaEmail(this as any);
        }
        return this._emailInstance;
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
        
        // Get requester from session
        const user = await this.session.user(true).catch(() => null);
        const requester = user?.id || null;
        
        // Validate input data if schema exists
        let validatedData = data;

        const jobId = this.worker.enqueue(background.handler, options, validatedData);
        
        // Store metadata for this job
        this.jobMetadata.set(jobId, {
            requester,
            backgroundPath
        });
        
        // Create job log entry
        try {
            globalContext.enterWith({
                global: { bypass: true }
            });
            
            await zodula.doctype("Background Job Log").insert({
                job_id: jobId,
                background_path: backgroundPath,
                requester: requester || null,
                status: "waiting",
                attempts: 0,
                created_at: new Date().toISOString()
            } as any).bypass(true);
        } catch (error) {
            logger.error(`Failed to create job log for ${jobId}:`, error);
        }
        
        return jobId;
    }
}

export const zodula = new ZodulaSDK()