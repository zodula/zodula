import React from "react"
import * as LucideIcons from "lucide-react"
import { cn } from "../../lib/utils"

// Define the available icon names as a union type for better type safety
export type IconName = 
  | "Folder" 
  | "FolderOpen" 
  | "FileText" 
  | "File" 
  | "Database" 
  | "Settings"
  | "Home" 
  | "User" 
  | "Users" 
  | "Calendar" 
  | "Mail" 
  | "MessageSquare" 
  | "Star"
  | "Heart" 
  | "Bookmark" 
  | "Tag" 
  | "Search" 
  | "Filter" 
  | "Grid" 
  | "List"
  | "Plus" 
  | "Minus" 
  | "Edit" 
  | "Trash2" 
  | "Copy" 
  | "Move" 
  | "Download"
  | "Upload" 
  | "Share" 
  | "Lock" 
  | "Unlock" 
  | "Eye" 
  | "EyeOff" 
  | "Bell"
  | "BellOff" 
  | "Check" 
  | "X" 
  | "AlertCircle" 
  | "Info" 
  | "HelpCircle"

// Create a mapping of icon names to their corresponding Lucide components
const iconMap: Record<IconName, React.ComponentType<{ className?: string }>> = {
  Folder: LucideIcons.Folder,
  FolderOpen: LucideIcons.FolderOpen,
  FileText: LucideIcons.FileText,
  File: LucideIcons.File,
  Database: LucideIcons.Database,
  Settings: LucideIcons.Settings,
  Home: LucideIcons.Home,
  User: LucideIcons.User,
  Users: LucideIcons.Users,
  Calendar: LucideIcons.Calendar,
  Mail: LucideIcons.Mail,
  MessageSquare: LucideIcons.MessageSquare,
  Star: LucideIcons.Star,
  Heart: LucideIcons.Heart,
  Bookmark: LucideIcons.Bookmark,
  Tag: LucideIcons.Tag,
  Search: LucideIcons.Search,
  Filter: LucideIcons.Filter,
  Grid: LucideIcons.Grid,
  List: LucideIcons.List,
  Plus: LucideIcons.Plus,
  Minus: LucideIcons.Minus,
  Edit: LucideIcons.Edit,
  Trash2: LucideIcons.Trash2,
  Copy: LucideIcons.Copy,
  Move: LucideIcons.Move,
  Download: LucideIcons.Download,
  Upload: LucideIcons.Upload,
  Share: LucideIcons.Share,
  Lock: LucideIcons.Lock,
  Unlock: LucideIcons.Unlock,
  Eye: LucideIcons.Eye,
  EyeOff: LucideIcons.EyeOff,
  Bell: LucideIcons.Bell,
  BellOff: LucideIcons.BellOff,
  Check: LucideIcons.Check,
  X: LucideIcons.X,
  AlertCircle: LucideIcons.AlertCircle,
  Info: LucideIcons.Info,
  HelpCircle: LucideIcons.HelpCircle,
}

interface DynamicIconProps {
  iconName?: IconName | string
  className?: string
  fallbackIcon?: IconName
}

export const DynamicIcon: React.FC<DynamicIconProps> = ({ 
  iconName, 
  className, 
  fallbackIcon = "Folder" 
}) => {
  // If no icon name is provided, use the fallback
  if (!iconName) {
    const FallbackIcon = iconMap[fallbackIcon]
    return <FallbackIcon className={className} />
  }

  // Check if the icon name is a valid IconName
  if (iconName in iconMap) {
    const IconComponent = iconMap[iconName as IconName]
    return <IconComponent className={className} />
  }

  // If the icon name is not in our map, try to access it directly from LucideIcons
  // This provides backward compatibility for any icons not explicitly mapped
  const IconComponent = (LucideIcons as any)[iconName]
  if (IconComponent && typeof IconComponent === 'function') {
    return <IconComponent className={className} />
  }

  // If all else fails, use the fallback icon
  const FallbackIcon = iconMap[fallbackIcon]
  return <FallbackIcon className={className} />
}

// Export the available icon names for use in other components
export const availableIcons: IconName[] = Object.keys(iconMap) as IconName[]
