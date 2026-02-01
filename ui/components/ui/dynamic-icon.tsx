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
  | "Building"
  | "Building2"
  | "CreditCard"
  | "DollarSign"
  | "TrendingUp"
  | "TrendingDown"
  | "PieChart"
  | "BarChart"
  | "Wallet"
  | "Phone"
  | "PhoneCall"
  | "Video"
  | "VideoOff"
  | "Send"
  | "Inbox"
  | "Save"
  | "SaveAll"
  | "RefreshCw"
  | "RotateCw"
  | "Power"
  | "PowerOff"
  | "Play"
  | "Pause"
  | "StopCircle"
  | "ArrowLeft"
  | "ArrowRight"
  | "ArrowUp"
  | "ArrowDown"
  | "ChevronLeft"
  | "ChevronRight"
  | "ChevronUp"
  | "ChevronDown"
  | "Image"
  | "Images"
  | "Music"
  | "Film"
  | "Wrench"
  | "Hammer"
  | "Palette"
  | "Paintbrush"
  | "CheckCircle"
  | "XCircle"
  | "AlertTriangle"
  | "Zap"
  | "Flame"
  | "Sparkles"
  | "Circle"
  | "Square"
  | "Triangle"
  | "Globe"
  | "Map"
  | "MapPin"
  | "Compass"
  | "Target"
  | "Flag"
  | "Award"
  | "Trophy"
  | "Gift"
  | "Package"
  | "Box"
  | "ShoppingCart"
  | "Store"
  | "Coffee"
  | "Briefcase"
  | "Laptop"
  | "Monitor"
  | "Smartphone"
  | "Tablet"
  | "Printer"
  | "Server"
  | "Cloud"
  | "CloudUpload"
  | "CloudDownload"
  | "Shield"
  | "Key"
  | "Fingerprint"
  | "Activity"
  | "Gauge"
  | "Timer"
  | "Clock"
  | "Sun"
  | "Moon"
  | "Lightbulb"
  | "Flashlight"
  | "Camera"
  | "Mic"
  | "Headphones"
  | "Radio"
  | "Tv"
  | "Gamepad2"
  | "Dice1"
  | "Dice2"
  | "Dice3"
  | "Dice4"
  | "Dice5"
  | "Dice6"

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
  Building: LucideIcons.Building,
  Building2: LucideIcons.Building2,
  CreditCard: LucideIcons.CreditCard,
  DollarSign: LucideIcons.DollarSign,
  TrendingUp: LucideIcons.TrendingUp,
  TrendingDown: LucideIcons.TrendingDown,
  PieChart: LucideIcons.PieChart,
  BarChart: LucideIcons.BarChart,
  Wallet: LucideIcons.Wallet,
  Phone: LucideIcons.Phone,
  PhoneCall: LucideIcons.PhoneCall,
  Video: LucideIcons.Video,
  VideoOff: LucideIcons.VideoOff,
  Send: LucideIcons.Send,
  Inbox: LucideIcons.Inbox,
  Save: LucideIcons.Save,
  SaveAll: LucideIcons.SaveAll,
  RefreshCw: LucideIcons.RefreshCw,
  RotateCw: LucideIcons.RotateCw,
  Power: LucideIcons.Power,
  PowerOff: LucideIcons.PowerOff,
  Play: LucideIcons.Play,
  Pause: LucideIcons.Pause,
  StopCircle: LucideIcons.StopCircle,
  ArrowLeft: LucideIcons.ArrowLeft,
  ArrowRight: LucideIcons.ArrowRight,
  ArrowUp: LucideIcons.ArrowUp,
  ArrowDown: LucideIcons.ArrowDown,
  ChevronLeft: LucideIcons.ChevronLeft,
  ChevronRight: LucideIcons.ChevronRight,
  ChevronUp: LucideIcons.ChevronUp,
  ChevronDown: LucideIcons.ChevronDown,
  Image: LucideIcons.Image,
  Images: LucideIcons.Images,
  Music: LucideIcons.Music,
  Film: LucideIcons.Film,
  Wrench: LucideIcons.Wrench,
  Hammer: LucideIcons.Hammer,
  Palette: LucideIcons.Palette,
  Paintbrush: LucideIcons.Paintbrush,
  CheckCircle: LucideIcons.CheckCircle,
  XCircle: LucideIcons.XCircle,
  AlertTriangle: LucideIcons.AlertTriangle,
  Zap: LucideIcons.Zap,
  Flame: LucideIcons.Flame,
  Sparkles: LucideIcons.Sparkles,
  Circle: LucideIcons.Circle,
  Square: LucideIcons.Square,
  Triangle: LucideIcons.Triangle,
  Globe: LucideIcons.Globe,
  Map: LucideIcons.Map,
  MapPin: LucideIcons.MapPin,
  Compass: LucideIcons.Compass,
  Target: LucideIcons.Target,
  Flag: LucideIcons.Flag,
  Award: LucideIcons.Award,
  Trophy: LucideIcons.Trophy,
  Gift: LucideIcons.Gift,
  Package: LucideIcons.Package,
  Box: LucideIcons.Box,
  ShoppingCart: LucideIcons.ShoppingCart,
  Store: LucideIcons.Store,
  Coffee: LucideIcons.Coffee,
  Briefcase: LucideIcons.Briefcase,
  Laptop: LucideIcons.Laptop,
  Monitor: LucideIcons.Monitor,
  Smartphone: LucideIcons.Smartphone,
  Tablet: LucideIcons.Tablet,
  Printer: LucideIcons.Printer,
  Server: LucideIcons.Server,
  Cloud: LucideIcons.Cloud,
  CloudUpload: LucideIcons.CloudUpload,
  CloudDownload: LucideIcons.CloudDownload,
  Shield: LucideIcons.Shield,
  Key: LucideIcons.Key,
  Fingerprint: LucideIcons.Fingerprint,
  Activity: LucideIcons.Activity,
  Gauge: LucideIcons.Gauge,
  Timer: LucideIcons.Timer,
  Clock: LucideIcons.Clock,
  Sun: LucideIcons.Sun,
  Moon: LucideIcons.Moon,
  Lightbulb: LucideIcons.Lightbulb,
  Flashlight: LucideIcons.Flashlight,
  Camera: LucideIcons.Camera,
  Mic: LucideIcons.Mic,
  Headphones: LucideIcons.Headphones,
  Radio: LucideIcons.Radio,
  Tv: LucideIcons.Tv,
  Gamepad2: LucideIcons.Gamepad2,
  Dice1: LucideIcons.Dice1,
  Dice2: LucideIcons.Dice2,
  Dice3: LucideIcons.Dice3,
  Dice4: LucideIcons.Dice4,
  Dice5: LucideIcons.Dice5,
  Dice6: LucideIcons.Dice6,
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
