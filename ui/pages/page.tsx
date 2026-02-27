import { useEffect, useState } from "react";
import { useRouter } from "../components/router";
import { useDoc } from "../hooks/use-doc";
import { Button } from "../components/ui/button";
import { ArrowRight, Settings, Database, Zap, Shield, Code, Globe, SearchIcon } from "lucide-react";

export default function Page() {
    const { params, push, replace, location } = useRouter();

    const { doc } = useDoc({
        doctype: "Global Setting",
        id: "Global Setting"
    });

    useEffect(() => {
        if (doc && doc.homepage) {
            replace(doc.homepage!);
        } else if (doc && !doc.homepage) {

        }
    }, [doc]);

    return (
        <div className="zd:min-h-screen zd:flex zd:flex-col zd:gap-4 zd:items-center zd:justify-center zd:bg-gradient-to-br zd:from-background zd:to-muted/20 zd:p-8 zd:text-muted-foreground">
            <SearchIcon className="zd:w-10 zd:h-10" />
            Please Set Homepage
        </div>
    );
}