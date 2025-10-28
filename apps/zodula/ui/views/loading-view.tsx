import { Loader } from "lucide-react";
import { cn } from "../lib/utils";

export interface LoadingViewProps {
    message?: string;
    size?: "small" | "medium" | "large";
    className?: string;
}

export interface SpinnerProps {
    size?: "small" | "medium" | "large";
    className?: string;
}

export const Spinner = ({ size = "medium", className = "" }: SpinnerProps) => {
    return <Loader className={cn("zd:animate-spin", size === "small" ? "zd:w-4! zd:h-4!" : size === "medium" ? "zd:w-8! zd:h-8!" : "zd:w-16! zd:h-16!", className)} />
}

export default function LoadingView({ message = "Loading...", size = "medium", className = "" }: LoadingViewProps) {
    // Spinner
    return <div className={cn("zd:flex zd:flex-col zd:items-center zd:justify-center zd:h-screen zd:gap-4", className)}>
        <Spinner size={size} />
        <span className="zd:text-sm zd:text-muted-foreground">{message}</span>
    </div>
}