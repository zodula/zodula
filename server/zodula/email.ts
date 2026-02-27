import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";

export interface EmailOptions {
    to: string | string[];
    subject: string;
    text?: string;
    html?: string;
    from?: string;
    replyTo?: string;
    cc?: string | string[];
    bcc?: string | string[];
}

export interface SMTPConfig {
    host: string;
    port: number;
    secure?: boolean;
    user?: string;
    pass?: string;
    fromEmail?: string;
}

export class ZodulaEmail {
    private sdk: any;

    constructor(sdk: any) {
        this.sdk = sdk;
    }

    private async getSMTPConfig(): Promise<SMTPConfig | null> {

        try {
            const globalSetting = await this.sdk
                .doctype("Global Setting")
                .get("Global Setting")
                .bypass(true)
                .catch(() => null);

            const emailId = globalSetting?.default_outgoing_email;
            if (!emailId || typeof emailId !== "string") {
                return null;
            }

            const emailDoc = await this.sdk
                .doctype("Email")
                .get(emailId)
                .bypass(true)
                .catch(() => null);

            if (!emailDoc?.host || !emailDoc?.port) {
                return null;
            }

            const port = typeof emailDoc.port === "number" ? emailDoc.port : parseInt(String(emailDoc.port), 10);
            if (isNaN(port)) {
                return null;
            }

            const config: SMTPConfig = {
                host: String(emailDoc.host),
                port,
                secure: emailDoc.secure === 1 || emailDoc.secure === "1",
                user: emailDoc.user ? String(emailDoc.user) : undefined,
                pass: emailDoc.password ? String(emailDoc.password) : undefined,
                fromEmail: emailDoc.from_email ? String(emailDoc.from_email) : undefined,
            };

            return config;
        } catch {
            return null;
        }
    }

    private createTransporter(config: SMTPConfig): Transporter {
        return nodemailer.createTransport({
            host: config.host,
            port: config.port,
            secure: config.secure ?? config.port === 465,
            auth:
                config.user && config.pass
                    ? { user: config.user, pass: config.pass }
                    : undefined,
        });
    }

    /**
     * Send an email via the configured SMTP server (from Global Setting → Default Outgoing Email)
     */
    async send(options: EmailOptions): Promise<void> {
        const config = await this.getSMTPConfig();
        if (!config) {
            throw new Error(
                "Email is not configured. Set up an Email account in Global Setting → Default Outgoing Email."
            );
        }

        const transporter = this.createTransporter(config);
        const from =
            options.from ||
            config.fromEmail ||
            config.user ||
            "noreply@localhost";
        const to = Array.isArray(options.to) ? options.to.join(", ") : options.to;

        await transporter.sendMail({
            from,
            to,
            subject: options.subject,
            text: options.text,
            html: options.html,
            replyTo: options.replyTo,
            cc: options.cc,
            bcc: options.bcc,
        });
    }

    /**
     * Test SMTP connection with given config (e.g. from form before save)
     */
    async testConnection(config: SMTPConfig): Promise<void> {
        const transporter = this.createTransporter(config);
        await transporter.verify();
    }

    /**
     * Check if email is configured (Global Setting has Default Outgoing Email with valid Email doc)
     */
    async isConfigured(): Promise<boolean> {
        const config = await this.getSMTPConfig();
        return !!config;
    }
}
