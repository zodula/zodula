import { Navbar } from "../components/custom/navbar"
import { useRouter } from "../components/router"
import { useNavbar } from "../hooks/use-navbar"
import { OrganizationProvider } from "../hooks/use-organization"
import { cn } from "../lib/utils"

export const NavbarLayout = ({ children }: { children: React.ReactNode }) => {
    const { fullWidth } = useNavbar()
    const router = useRouter()
    return (
        <OrganizationProvider>
            <div className="zd:flex zd:flex-col zd:items-center">
                {router.pathname.startsWith("/desk") && <Navbar />}
                <div className={cn("zd:flex zd:flex-col zd:gap-4 zd:w-full zd:max-w-8xl zd:p-4 zd:overflow-visible", fullWidth ? "zd:max-w-screen" : "")}>
                    {children}
                </div>
            </div>
        </OrganizationProvider>
    )
}