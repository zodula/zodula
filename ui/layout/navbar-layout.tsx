import { Navbar } from "../components/custom/navbar";
import { useRouter } from "../components/router";
import { useNavbar } from "../hooks/use-navbar";
import { cn } from "../lib/utils";

export interface NavbarLayoutProps {
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
  hideNavbar?: boolean;
}

export const NavbarLayout = ({
  children,
  className,
  contentClassName,
  hideNavbar,
}: NavbarLayoutProps) => {
  const { fullWidth } = useNavbar();
  const router = useRouter();
  

  return (
      <div className={cn("zd:flex zd:flex-col zd:items-center", className)}>
        {router.pathname.startsWith("/desk") && !hideNavbar && <Navbar />}
        <div
          className={cn(
            "zd:flex zd:flex-col zd:gap-4 zd:w-full zd:max-w-8xl zd:p-4 zd:overflow-visible zd:transition-all zd:duration-200 zd:ease-out",
            (fullWidth || hideNavbar) ? "zd:max-w-screen" : "",
            contentClassName || ""
          )}
        >
          {children}
        </div>
      </div>
  );
};
