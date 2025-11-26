import { useDocList } from "../../hooks/use-doc-list"
import { Button } from "../ui/button"
import { Badge } from "../ui/badge"
import { ExternalLink, Github, Globe, GraduationCap, Linkedin, Twitter, Youtube } from "lucide-react"

interface AboutZodulaDialogProps {
    isOpen: boolean
    onClose: (result?: any) => void
}

export const AboutZodulaDialog = ({ isOpen, onClose }: AboutZodulaDialogProps) => {
    const { docs: apps } = useDocList({
        doctype: "zodula__App",
        limit: 1000,
        sort: "created_at",
        order: "asc"
    })

    const links = [
        { label: "Website", url: "https://zodula.dev", icon: Globe },
        { label: "Source", url: "https://github.com/zodula/zodula", icon: Github },
        { label: "Documentation", url: "https://zodula.dev/docs", icon: GraduationCap },
        { label: "LinkedIn", url: "https://linkedin.com/techsakan/zodula", icon: Linkedin },
        { label: "Twitter", url: "https://twitter.com/zodula_dev", icon: Twitter },
        { label: "YouTube", url: "https://youtube.com/@zodula", icon: Youtube }
    ]

    return (
        <div className="zd:flex zd:flex-col zd:gap-6">
            {/* Links Section */}
            <div className="zd:space-y-3">
                <h3 className="zd:text-lg zd:font-semibold zd:text-gray-900">Open Source Applications for the Web</h3>
                <div className="zd:grid zd:grid-cols-2 zd:gap-3">
                    {links.map((link) => {
                        const IconComponent = link.icon
                        return (
                            <a
                                key={link.label}
                                href={link.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="zd:flex zd:items-center zd:space-x-3 zd:p-3 zd:rounded-lg zd:border zd:border-gray-200 zd:hover:bg-gray-50 zd:transition-colors"
                            >
                                <IconComponent className="zd:h-5 zd:w-5 zd:text-gray-600" />
                                <div>
                                    <div className="zd:font-medium zd:text-gray-900">{link.label}</div>
                                    <div className="zd:text-sm zd:text-gray-500 zd:truncate">{link.url}</div>
                                </div>
                                <ExternalLink className="zd:h-4 zd:w-4 zd:text-gray-400 zd:ml-auto" />
                            </a>
                        )
                    })}
                </div>
            </div>

            {/* Installed Apps Section */}
            <div className="zd:space-y-3">
                <h3 className="zd:text-lg zd:font-semibold zd:text-gray-900">Installed Apps</h3>
                {apps.length > 0 ? (
                    <div className="zd:space-y-2">
                        {apps.map((app) => (
                            <div key={app.id} className="zd:flex zd:items-center zd:justify-between zd:p-4 zd:border zd:border-gray-200 zd:rounded-lg zd:bg-white">
                                <div className="zd:flex-1">
                                    <div className="zd:flex zd:items-center zd:space-x-3">
                                        <span className="zd:font-semibold zd:text-gray-900">{app.name}</span>
                                        <Badge size="sm">
                                            {app.version}
                                        </Badge>
                                    </div>
                                    {app.description && (
                                        <p className="zd:text-sm zd:text-gray-600 zd:mt-1">{app.description}</p>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="zd:text-center zd:py-8">
                        <p className="zd:text-sm zd:text-gray-500 zd:italic">No apps installed</p>
                    </div>
                )}
            </div>

            {/* Footer */}
            <div className="zd:border-t zd:pt-4 zd:mt-4">
                <p className="zd:text-xs zd:text-gray-500 zd:text-center">
                    © Zodula Framework and contributors
                </p>
            </div>

            {/* Close Button */}
            <div className="zd:flex zd:justify-end">
                <Button onClick={() => onClose()} variant="outline" className="zd:px-6">
                    Close
                </Button>
            </div>
        </div>
    )
}
