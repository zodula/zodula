// @ts-nocheck
import React, { Component, type ErrorInfo, type ReactNode } from "react";
import ErrorView from "../../views/error-view";

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
}

interface State {
    hasError: boolean;
    error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = {
            hasError: false,
        };
    }

    static getDerivedStateFromError(error: Error): State {
        // Update state to show fallback UI
        return {
            hasError: true,
            error,
        };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        // Log to monitoring service here
        console.error("Error caught by ErrorBoundary:", error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                this.props.fallback ?? (
                    <ErrorView message={this.state.error?.message || "Something went wrong"} details={this.state.error?.stack} status={500} />
                )
            );
        }

        return this.props.children;
    }
}