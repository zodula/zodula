import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from '@/zodula/ui/components/router';
import { useForm } from '@/zodula/ui/hooks/use-form';
import { toast, ToastPortal } from '@/zodula/ui/components/ui/toast';
import { Form } from '@/zodula/ui/components/form/form';
import { Button } from '@/zodula/ui/components/ui/button';
import { useAuth } from '@/zodula/ui/hooks/use-auth';

export default function RouteComponent() {
    const router = useRouter()
    const [websiteName, setWebsiteName] = useState("")
    const { isAuthenticated, user, login } = useAuth()
    const fields = {
        email: {
            type: "Text" as const,
            label: "Email",
            required: 1 as const,
        },
        password: {
            type: "Password" as const,
            label: "Password",
            required: 1 as const,
        },
    }

    const { formData, handleChange } = useForm<typeof fields>({
        initialValues: {
            email: '',
            password: ''
        }
    });

    async function handleSubmit() {
        await login(formData.email, formData.password)
        toast.success("Login successful")
        // delay 1 second
        await new Promise(resolve => setTimeout(resolve, 500))
        router.push("/desk")
    }

    useEffect(() => {
        const cssQuery = document.querySelector("meta[name='website-name']")
        if (cssQuery) {
            setWebsiteName(cssQuery.getAttribute("content") || "")
        }
    }, [])

    return <div className="zd:flex zd:flex-col zd:gap-4 zd:items-center zd:justify-start zd:h-screen">
        <div className="zd:flex zd:flex-col zd:gap-4 zd:max-w-md zd:w-full zd:rounded zd:p-4 zd:border zd:mt-16">
            <span className="zd:text-2xl zd:text-center zd:font-semibold">{websiteName}</span>
            <span className="zd:text-sm zd:text-center">Sign in to your account</span>
            <Form
                fields={fields}
                values={formData}
                onChange={(fieldName: string, value: any) => {
                    handleChange(fieldName as keyof typeof fields, value);
                }}
            />
            <Button className="zd:w-full" onClick={async e => {
                await handleSubmit()
            }}>Sign in</Button>
        </div>
        <ToastPortal />
    </div>
}