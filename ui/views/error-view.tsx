import { AlertCircle, Home, RefreshCw } from "lucide-react"
import { Button } from "../components/ui/button"
import { useRouter } from "../components/router"

interface ErrorViewProps {
    message: string
    status?: number
    showRetry?: boolean
    onRetry?: () => void
}

export default function ErrorView(props: ErrorViewProps) {
    const { message = "An error occurred", status = 500, showRetry = false, onRetry } = props
    const router = useRouter()

    const getStatusColor = (status: number) => {
        if (status >= 500) return "destructive"
        if (status >= 400) return "warning"
        return "muted"
    }

    const getStatusMessage = (status: number) => {
        switch (status) {
            case 404:
                return "Page Not Found"
            case 403:
                return "Access Denied"
            case 401:
                return "Unauthorized"
            case 500:
                return "Internal Server Error"
            case 502:
                return "Bad Gateway"
            case 503:
                return "Service Unavailable"
            default:
                return "Something went wrong"
        }
    }

    const handleGoHome = () => {
        router.push("/")
    }

    const handleRetry = () => {
        if (onRetry) {
            onRetry()
        } else {
            window.location.reload()
        }
    }

    return (
        <div className="zd:min-h-screen zd:flex zd:items-center zd:justify-center zd:bg-background zd:px-4">
            <div className="zd:max-w-md zd:w-full zd:text-center">
                {/* Error Icon */}
                <div className="zd:flex zd:justify-center zd:mb-6">
                    <div className={`zd:rounded-full zd:p-4 zd:bg-${getStatusColor(status)}/10`}>
                        <AlertCircle className={`zd:w-12 zd:h-12 zd:text-${getStatusColor(status)}`} />
                    </div>
                </div>

                {/* Error Status */}
                <div className="zd:mb-4">
                    <h1 className="zd:text-2xl zd:font-semibold zd:text-foreground zd:mb-2">
                        {getStatusMessage(status)}
                    </h1>
                    <div className="zd:inline-flex zd:items-center zd:px-3 zd:py-1 zd:rounded-full zd:bg-muted zd:text-muted-foreground zd:text-sm zd:font-medium">
                        {status}
                    </div>
                </div>

                {/* Error Message */}
                <div className="zd:mb-8">
                    <p className="zd:text-muted-foreground zd:leading-relaxed">
                        {message}
                    </p>
                </div>

                {/* Action Buttons */}
                <div className="zd:flex zd:gap-3 zd:flex-row zd:justify-center">
                    <Button
                        variant="solid"
                        onClick={handleGoHome}
                        className="zd:flex zd:items-center zd:gap-2"
                    >
                        <Home className="zd:w-4 zd:h-4" />
                        Back to Home
                    </Button>

                    {showRetry && (
                        <Button
                            variant="outline"
                            onClick={handleRetry}
                            className="zd:flex zd:items-center zd:gap-2"
                        >
                            <RefreshCw className="zd:w-4 zd:h-4" />
                            Try Again
                        </Button>
                    )}
                </div>

                {/* Additional Help */}
                <div className="zd:mt-8 zd:pt-6 zd:border-t zd:border-border">
                    <p className="zd:text-sm zd:text-muted-foreground">
                        If this problem persists, please contact support.
                    </p>
                </div>
            </div>
        </div>
    )
}