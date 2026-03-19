import { useEffect } from "react";
import { useRouter } from "../components/router";
import { useDoc } from "../hooks/use-doc";
import { WebsiteNavbar } from "../components/custom/website-navbar";
import { SearchIcon } from "lucide-react";
import { zodula } from "@/zodula/client";

export default function Page() {
    const { replace } = useRouter();
    const { doc } = useDoc({
        doctype: "Global Setting",
        id: "Global Setting"
    });

    const logoUrl = doc?.logo
        ? zodula.utils.getDoctypeFileUrl(
            "Global Setting",
            doc?.id || "",
            "logo",
            (doc?.logo as string) || ""
        ) + "?w=40&h=40"
        : "/public/zodula/zodula-logo.png";

    useEffect(() => {
        if (doc?.homepage) replace(doc.homepage);
    }, [doc, replace]);

    return (
        <div className="auth-page-bg zd:min-h-screen zd:flex zd:flex-col zd:relative">
            <WebsiteNavbar currentPage="Home" logoUrl={logoUrl} />
            <main className="zd:flex-1 zd:flex zd:flex-col zd:gap-4 zd:items-center zd:justify-center zd:relative zd:z-10 zd:pt-20 zd:p-8 zd:text-muted-foreground">
                <SearchIcon className="zd:w-10 zd:h-10" />
                Please Set Homepage
            </main>
        </div>
    );
}