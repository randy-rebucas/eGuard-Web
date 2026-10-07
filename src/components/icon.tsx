import {
  AppWindow, ArrowLeft, ArrowRight, ArrowRightLeft, BadgeCheck, Briefcase, Building2, Bell, BellOff, BellRing, BookOpen, Calendar, Camera, ChartColumn, Check, CheckCheck,
  ChevronDown, ChevronRight, CircleCheck, CreditCard, CircleDashed, CircleSlash, Copy, Crown, Database, Download, Eye, EyeOff,
  Film, Globe, History, Hourglass, House, Inbox, Info, KeyRound, LayoutGrid, LifeBuoy, ListChecks, LoaderCircle, Lock,
  LogOut, Mail, Map, MapPin, MapPinOff, Menu, MessageCircle, Monitor, Moon, OctagonAlert, Pencil, Plug, Plus, Receipt,
  RefreshCw, Route, ScanSearch, School, Search, SearchX, Settings, Shield, ShieldAlert, ShieldCheck, Siren, SlidersHorizontal,
  Printer, Smartphone, Star, Sun, Table, Tablet, TabletSmartphone, Ticket, Trash2, TriangleAlert, User, UserPlus, Users, Wallet, WifiOff, X,
  type LucideIcon,
} from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  "app-window": AppWindow, "arrow-left": ArrowLeft, "arrow-right": ArrowRight, "arrow-right-left": ArrowRightLeft, "badge-check": BadgeCheck, bell: Bell, "bell-off": BellOff,
  briefcase: Briefcase, building: Building2, printer: Printer, school: School, ticket: Ticket,
  "bell-ring": BellRing, "book-open": BookOpen, calendar: Calendar, camera: Camera, "chart-column": ChartColumn, check: Check,
  "check-check": CheckCheck, "chevron-down": ChevronDown, "chevron-right": ChevronRight, "circle-check": CircleCheck, "credit-card": CreditCard,
  "circle-dashed": CircleDashed, "circle-slash": CircleSlash, copy: Copy, crown: Crown, database: Database,
  download: Download, eye: Eye, "eye-off": EyeOff, film: Film, globe: Globe, history: History, hourglass: Hourglass,
  house: House, inbox: Inbox, info: Info, "key-round": KeyRound, "layout-grid": LayoutGrid, "life-buoy": LifeBuoy,
  "list-checks": ListChecks, "loader-circle": LoaderCircle, lock: Lock, "log-out": LogOut, mail: Mail, map: Map, "map-pin": MapPin,
  "map-pin-off": MapPinOff, menu: Menu, "message-circle": MessageCircle, monitor: Monitor, moon: Moon,
  "octagon-alert": OctagonAlert, pencil: Pencil, plug: Plug, plus: Plus, receipt: Receipt, "refresh-cw": RefreshCw, route: Route,
  "scan-search": ScanSearch, search: Search, "search-x": SearchX, settings: Settings, shield: Shield,
  "shield-alert": ShieldAlert, "shield-check": ShieldCheck, siren: Siren, "sliders-horizontal": SlidersHorizontal,
  smartphone: Smartphone, star: Star, sun: Sun, table: Table, tablet: Tablet, "tablet-smartphone": TabletSmartphone,
  trash: Trash2, "triangle-alert": TriangleAlert, user: User, "user-plus": UserPlus, users: Users, wallet: Wallet, "wifi-off": WifiOff, x: X,
};

export function Icon({ name, className, style, size }: { name: string; className?: string; style?: React.CSSProperties; size?: number }) {
  const C = ICONS[name] ?? Info;
  return <C aria-hidden="true" className={`lucide ${className ?? ""}`} style={size ? { width: size, height: size, ...style } : style} strokeWidth={1.75} />;
}
