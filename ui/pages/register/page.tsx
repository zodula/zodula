import React, { useEffect, useState, useCallback } from "react";
import { Link, useRouter } from "@/zodula/ui/components/router";
import { useForm } from "@/zodula/ui/hooks/use-form";
import { toast, ToastPortal } from "@/zodula/ui/components/ui/toast";
import { Form } from "@/zodula/ui/components/form/form";
import { Button } from "@/zodula/ui/components/ui/button";
import { useAuth } from "@/zodula/ui/hooks/use-auth";
import { zodula } from "@/zodula/client";

const FIELDS = {
    name: {
        type: "Text" as const,
        label: "Name",
        required: 0 as const,
        autocomplete: "name" as const,
    },
    email: {
        type: "Text" as const,
        label: "Email",
        required: 1 as const,
        autocomplete: "email" as const,
    },
    password: {
        type: "Password" as const,
        label: "Password",
        required: 1 as const,
        autocomplete: "new-password" as const,
    },
    confirm_password: {
        type: "Password" as const,
        label: "Confirm Password",
        required: 1 as const,
        autocomplete: "new-password" as const,
    },
} as const;

export default function RegisterPage() {
    const router = useRouter();
    const [websiteName, setWebsiteName] = useState("");
    const { isAuthenticated } = useAuth();
    const { formData, handleChange } = useForm<typeof FIELDS>({
        initialValues: { name: "", email: "", password: "", confirm_password: "" },
    });

    // Redirect if already authenticated
    useEffect(() => {
        if (isAuthenticated) {
            router.push("/desk");
        }
    }, [isAuthenticated, router]);

    useEffect(() => {
        const title = document.querySelector("title");
        if (title?.textContent) setWebsiteName(title.textContent);
    }, []);

    const handleSubmit = useCallback(
        async (e: React.FormEvent) => {
            e.preventDefault();

            const email = (formData.email ?? "").trim();
            const password = formData.password ?? "";
            const confirmPassword = formData.confirm_password ?? "";
            const name = (formData.name ?? "").trim();

            if (!email || !password) {
                toast.error("Registration failed", "Please enter your email and password");
                return;
            }

            if (password.length < 6) {
                toast.error("Registration failed", "Password must be at least 6 characters");
                return;
            }

            if (password !== confirmPassword) {
                toast.error("Registration failed", "Passwords do not match");
                return;
            }

            try {
                const response = await zodula.action("zodula.auth.register", {
                    data: { email, password, name: name || undefined },
                });

                if (response?.email_sent) {
                    toast.success(
                        "Registration successful",
                        "Please check your email to confirm your account."
                    );
                } else {
                    toast.success("Registration successful", response?.message ?? "");
                }

                await new Promise((r) => setTimeout(r, 400));
                router.push("/login");
            } catch (err: unknown) {
                const message =
                    (err as { response?: { data?: { message?: string } } })?.response?.data
                        ?.message ??
                    (err instanceof Error ? err.message : null) ??
                    "Registration failed. Please try again.";
                toast.error("Registration failed", message);
            }
        },
        [formData.email, formData.password, formData.confirm_password, formData.name, router]
    );

    return (
        <div className="auth-page-bg zd:flex zd:flex-col zd:gap-6 zd:items-center zd:justify-center zd:min-h-screen zd:relative">
            <div className="zd:relative zd:z-10 zd:flex zd:flex-col zd:gap-6 zd:max-w-sm zd:w-full zd:rounded-lg zd:p-6 zd:border zd:bg-background/95 zd:backdrop-blur-sm zd:shadow-lg zd:shadow-black/5">
                <div className="zd:flex zd:flex-col zd:gap-1 zd:text-center">
                    <h1 className="zd:text-xl zd:font-semibold zd:text-foreground">
                        {websiteName || "Create account"}
                    </h1>
                    <p className="zd:text-sm zd:text-muted-foreground">
                        Create a new account
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="zd:flex zd:flex-col zd:gap-4">
                    <Form
                        fields={FIELDS}
                        values={formData}
                        onChange={(fieldName: string, value: unknown) => {
                            handleChange(fieldName as keyof typeof FIELDS, value);
                        }}
                    />
                    <Button type="submit" className="zd:w-full">
                        Create account
                    </Button>
                </form>

                <p className="zd:text-sm zd:text-center zd:text-muted-foreground">
                    Already have an account?{" "}
                    <Link
                        to="/login"
                        className="zd:font-medium zd:text-primary zd:hover:underline"
                    >
                        Sign in
                    </Link>
                </p>

                <p className="zd:text-sm zd:text-center">
                    <Link
                        to="/"
                        className="zd:text-muted-foreground zd:hover:text-foreground zd:transition-colors"
                    >
                        ← Back to homepage
                    </Link>
                </p>
            </div>
            <ToastPortal />
        </div>
    );
}
