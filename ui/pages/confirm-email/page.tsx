import React, { useEffect, useState } from "react";
import { Link, useRouter } from "@/zodula/ui/components/router";
import { toast, ToastPortal } from "@/zodula/ui/components/ui/toast";
import { Button } from "@/zodula/ui/components/ui/button";
import { useAuth } from "@/zodula/ui/hooks/use-auth";
import { zodula } from "@/zodula/client";

export default function ConfirmEmailPage() {
    const router = useRouter();
    const [websiteName, setWebsiteName] = useState("");
    const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const code = router.search?.code ?? null;
    const email = router.search?.email ?? null;

    useEffect(() => {
        const title = document.querySelector("title");
        if (title?.textContent) setWebsiteName(title.textContent);
    }, []);

    useEffect(() => {
        if (!code || !email) {
            setStatus("error");
            setErrorMessage("Invalid confirmation link. Please check your email and try again.");
            return;
        }

        let cancelled = false;

        const confirm = async () => {
            setStatus("loading");
            try {
                await zodula.action("zodula.auth.confirm-email", {
                    data: { code, email },
                });

                if (!cancelled) {
                    setStatus("success");
                    toast.success("Email confirmed", "You can now sign in to your account.");
                    await new Promise((r) => setTimeout(r, 800));
                    router.push("/login");
                }
            } catch (err: unknown) {
                const message =
                    (err as { response?: { data?: { message?: string } } })?.response?.data
                        ?.message ??
                    (err instanceof Error ? err.message : null) ??
                    "Confirmation failed. The link may have expired.";
                if (!cancelled) {
                    setStatus("error");
                    setErrorMessage(message);
                }
            }
        };

        confirm();
        return () => {
            cancelled = true;
        };
    }, [code, email]);

    return (
        <div className="auth-page-bg zd:flex zd:flex-col zd:gap-6 zd:items-center zd:justify-center zd:min-h-screen zd:relative">
            <div className="zd:relative zd:z-10 zd:flex zd:flex-col zd:gap-6 zd:max-w-sm zd:w-full zd:rounded-lg zd:p-6 zd:border zd:bg-background/95 zd:backdrop-blur-sm zd:shadow-lg zd:shadow-black/5">
                <div className="zd:flex zd:flex-col zd:gap-1 zd:text-center">
                    <h1 className="zd:text-xl zd:font-semibold zd:text-foreground">
                        {websiteName ? `${websiteName} - ` : ""}Confirm Email
                    </h1>
                    <p className="zd:text-sm zd:text-muted-foreground">
                        {status === "loading" && "Confirming your email address..."}
                        {status === "success" && "Email confirmed! Redirecting to sign in..."}
                        {status === "error" && "Unable to confirm"}
                        {status === "idle" && "Please wait..."}
                    </p>
                </div>

                {status === "error" && errorMessage && (
                    <div className="zd:rounded-md zd:bg-destructive/10 zd:border zd:border-destructive/20 zd:px-4 zd:py-3 zd:text-sm zd:text-destructive">
                        {errorMessage}
                    </div>
                )}

                {(status === "error" || status === "idle") && (
                    <div className="zd:flex zd:flex-col zd:gap-3">
                        <Button className="zd:w-full" onClick={() => router.push("/login")}>
                            Sign in
                        </Button>
                        <p className="zd:text-sm zd:text-center zd:text-muted-foreground">
                            <Link
                                to="/"
                                className="zd:text-muted-foreground zd:hover:text-foreground zd:transition-colors"
                            >
                                ← Back to homepage
                            </Link>
                        </p>
                    </div>
                )}

                {status === "loading" && (
                    <div className="zd:flex zd:justify-center">
                        <div className="zd:h-8 zd:w-8 zd:animate-spin zd:rounded-full zd:border-2 zd:border-primary zd:border-t-transparent" />
                    </div>
                )}
            </div>
            <ToastPortal />
        </div>
    );
}
