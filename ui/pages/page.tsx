import { useEffect, useState } from "react";
import { useRouter } from "../components/router";
import { useDoc } from "../hooks/use-doc";
import { Button } from "../components/ui/button";
import { ArrowRight, Settings, Database, Zap, Shield, Code, Globe } from "lucide-react";

export default function Page() {
    const { params, push, replace, location } = useRouter();
    const [showHomepage, setShowHomepage] = useState(false);

    const { doc } = useDoc({
        doctype: "zodula__Global Setting",
    });

    useEffect(() => {
        if (doc && doc.homepage) {
            replace(doc.homepage!);
        } else if (doc && !doc.homepage) {
            // Show homepage if no homepage setting is configured
            setShowHomepage(true);
        }
    }, [doc]);

    if (!showHomepage) {
        return <div className="zd:flex zd:items-center zd:justify-center zd:min-h-screen">
            <div className="zd:animate-spin zd:rounded-full zd:h-8 zd:w-8 zd:border-b-2 zd:border-primary"></div>
        </div>;
    }

    return (
        <div className="zd:min-h-screen zd:flex zd:flex-col zd:items-center zd:justify-center zd:bg-gradient-to-br zd:from-background zd:to-muted/20 zd:p-8">
            <div className="zd:max-w-2xl zd:text-center zd:space-y-8">
                {/* Logo and Title */}
                <div className="zd:flex zd:items-center zd:justify-center zd:space-x-3">
                    <div className="zd:w-12 zd:h-12 zd:bg-primary zd:rounded-lg zd:flex zd:items-center zd:justify-center">
                        <Zap className="zd:w-6! zd:h-6! zd:text-primary-foreground" />
                    </div>
                    <h1 className="zd:text-4xl zd:font-bold zd:text-foreground">
                        <span className="zd:text-4xl zd:text-primary">Zodula</span> Framework
                    </h1>
                </div>

                {/* Description */}
                <p className="zd:text-lg zd:text-muted-foreground zd:leading-relaxed">
                    A fully fullstack web framework that covers all-rounded web development without any third party dependencies.
                </p>

                {/* Action Buttons */}
                <div className="zd:flex zd:flex-col sm:zd:flex-row zd:gap-4 zd:justify-center">
                    <Button 
                        onClick={() => push("/desk/doctypes/zodula__Global Setting")}
                        className="zd:flex zd:items-center zd:space-x-2"
                    >
                        <span>Configure Homepage</span>
                        <ArrowRight className="zd:w-4 zd:h-4" />
                    </Button>
                    <Button 
                        variant="outline" 
                        onClick={() => push("/desk")}
                    >
                        Go to Admin
                    </Button>
                </div>

                {/* Key Features */}
                <div className="zd:bg-muted/30 zd:rounded-lg zd:p-6 zd:mt-8">
                    <h3 className="zd:text-lg zd:font-semibold zd:text-foreground zd:mb-4">
                        Key Features
                    </h3>
                    <div className="zd:grid zd:grid-cols-2 zd:gap-3 zd:text-sm">
                        <div className="zd:flex zd:items-center zd:space-x-2">
                            <Database className="zd:w-4 zd:h-4 zd:text-primary" />
                            <span>Database Schema</span>
                        </div>
                        <div className="zd:flex zd:items-center zd:space-x-2">
                            <Code className="zd:w-4 zd:h-4 zd:text-primary" />
                            <span>Interactive CLI</span>
                        </div>
                        <div className="zd:flex zd:items-center zd:space-x-2">
                            <Globe className="zd:w-4 zd:h-4 zd:text-primary" />
                            <span>WebSocket</span>
                        </div>
                        <div className="zd:flex zd:items-center zd:space-x-2">
                            <Zap className="zd:w-4 zd:h-4 zd:text-primary" />
                            <span>REST API</span>
                        </div>
                        <div className="zd:flex zd:items-center zd:space-x-2">
                            <Settings className="zd:w-4 zd:h-4 zd:text-primary" />
                            <span>Auto OpenAPI UI</span>
                        </div>
                        <div className="zd:flex zd:items-center zd:space-x-2">
                            <Shield className="zd:w-4 zd:h-4 zd:text-primary" />
                            <span>Modular React Pages</span>
                        </div>
                        <div className="zd:flex zd:items-center zd:space-x-2">
                            <Database className="zd:w-4 zd:h-4 zd:text-primary" />
                            <span>DocType System</span>
                        </div>
                        <div className="zd:flex zd:items-center zd:space-x-2">
                            <span className="zd:text-muted-foreground">+ More</span>
                        </div>
                    </div>
                </div>

                {/* Quick Setup */}
                <div className="zd:bg-muted/30 zd:rounded-lg zd:p-6 zd:mt-4">
                    <h3 className="zd:text-lg zd:font-semibold zd:text-foreground zd:mb-3">
                        Quick Setup
                    </h3>
                    <p className="zd:text-sm zd:text-muted-foreground zd:mb-4">
                        To set your homepage redirect, go to <code className="zd:bg-muted zd:px-2 zd:py-1 zd:rounded zd:text-xs">/desk/doctypes/zodula__Global Setting</code> 
                        and set the "homepage" field to your desired URL (e.g., <code className="zd:bg-muted zd:px-2 zd:py-1 zd:rounded zd:text-xs">/desk</code>).
                    </p>
                    <Button 
                        variant="outline" 
                        onClick={() => push("/desk/doctypes/zodula__Global Setting")}
                        className="zd:flex zd:items-center zd:space-x-2"
                    >
                        <Settings className="zd:w-4 zd:h-4" />
                        <span>Open Settings</span>
                    </Button>
                </div>

                {/* Footer */}
                <div className="zd:text-sm zd:text-muted-foreground">
                    <p>Powered by <span className="zd:font-semibold zd:text-foreground">Zodula Framework</span> • Version 0</p>
                </div>
            </div>
        </div>
    );
}