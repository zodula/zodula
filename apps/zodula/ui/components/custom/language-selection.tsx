import { useTranslation } from "../../hooks/use-translation"
import { Button } from "../ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../ui/dropdown-menu"

export const LanguageSelection = (props: {
    filterLanguages?: string[]
}) => {
    const { availableLanguages, currentLanguage, setLanguage } = useTranslation()
    return <DropdownMenu>
        <DropdownMenuTrigger asChild>
            <Button variant="outline" className="zd:flex zd:items-center zd:gap-2">
                {currentLanguage?.toUpperCase()}
            </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
            {availableLanguages.filter((language) => !props.filterLanguages || props.filterLanguages.includes(language.code || "")).map((language) => (
                <DropdownMenuItem key={language.code} className="zd:flex zd:items-center zd:gap-2" onClick={() => setLanguage(language.code || "")}>
                    <span className="zd:w-5">
                        {language.flag}
                    </span>
                    <span>
                        {language.name} ({language.code?.toUpperCase()})
                    </span>
                </DropdownMenuItem>
            ))}
        </DropdownMenuContent>
    </DropdownMenu>
}