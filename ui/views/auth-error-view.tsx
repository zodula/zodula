import { Lock, LogIn, Shield, UserX } from "lucide-react"
import { Button } from "../components/ui/button"
import { useRouter } from "../components/router"

interface AuthErrorViewProps {
    message: string
    status?: number
    showRetry?: boolean
    onRetry?: () => void
}

export default function AuthErrorView(props: AuthErrorViewProps) {
    const { message = "Authentication required", status = 401, showRetry = false, onRetry } = props
    const router = useRouter()

    const getAuthStatusColor = (status: number) => {
        if (status === 401) return "warning"
        if (status === 403) return "destructive"
        if (status === 423) return "warning" // Account locked
        return "muted"
    }

    const getAuthStatusMessage = (status: number) => {
        switch (status) {
            case 401:
                return "Authentication Required"
            case 403:
                return "Access Denied"
            case 423:
                return "Account Locked"
            case 419:
                return "Session Expired"
            default:
                return "Authentication Error"
        }
    }

    const getAuthIcon = (status: number) => {
        switch (status) {
            case 401:
                return Lock
            case 403:
                return Shield
            case 423:
                return UserX
            case 419:
                return Lock
            default:
                return Lock
        }
    }

    const handleGoToLogin = () => {
        router.push("/login")
    }

    const handleRetry = () => {
        if (onRetry) {
            onRetry()
        } else {
            window.location.reload()
        }
    }

    const AuthIcon = getAuthIcon(status)

    return (
        <div className="zd:min-h-[calc(100vh-100px)] zd:flex zd:items-center zd:justify-center zd:bg-background zd:px-4">
            <div className="zd:max-w-md zd:w-full zd:text-center">
                {/* Auth Error Icon */}
                <div className="zd:flex zd:justify-center zd:mb-6">
                    <div className={`zd:rounded-full zd:p-4 zd:bg-${getAuthStatusColor(status)}/10`}>
                        <AuthIcon className={`zd:w-12 zd:h-12 zd:text-${getAuthStatusColor(status)}`} />
                    </div>
                </div>

                {/* Auth Error Status */}
                <div className="zd:mb-4">
                    <h1 className="zd:text-2xl zd:font-semibold zd:text-foreground zd:mb-2">
                        {getAuthStatusMessage(status)}
                    </h1>
                    <div className="zd:inline-flex zd:items-center zd:px-3 zd:py-1 zd:rounded-full zd:bg-muted zd:text-muted-foreground zd:text-sm zd:font-medium">
                        {status}
                    </div>
                </div>

                {/* Auth Error Message */}
                <div className="zd:mb-8">
                    <p className="zd:text-muted-foreground zd:leading-relaxed">
                        {message}
                    </p>
                </div>

                {/* Action Buttons */}
                <div className="zd:flex zd:flex-col zd:gap-3 zd:sm:flex-row zd:sm:justify-center">
                    <Button
                        variant="solid"
                        onClick={handleGoToLogin}
                        className="zd:flex zd:items-center zd:gap-2"
                    >
                        <LogIn className="zd:w-4 zd:h-4" />
                        Go to Login
                    </Button>

                    {showRetry && (
                        <Button
                            variant="outline"
                            onClick={handleRetry}
                            className="zd:flex zd:items-center zd:gap-2"
                        >
                            <Lock className="zd:w-4 zd:h-4" />
                            Try Again
                        </Button>
                    )}
                </div>

                {/* Additional Help */}
                <div className="zd:mt-8 zd:pt-6 zd:border-t zd:border-border">
                    <p className="zd:text-sm zd:text-muted-foreground">
                        {status === 401 && "Please log in to access this page."}
                        {status === 403 && "You don't have permission to access this resource."}
                        {status === 423 && "Your account has been temporarily locked. Please contact support."}
                        {status === 419 && "Your session has expired. Please log in again."}
                        {![401, 403, 423, 419].includes(status) && "Please contact support if this issue persists."}
                    </p>
                </div>
            </div>
        </div>
    )
}
