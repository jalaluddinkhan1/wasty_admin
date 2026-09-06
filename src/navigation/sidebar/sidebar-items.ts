import {
  AlertTriangle,
  Banknote,
  Bell,
  Boxes,
  BrainCircuit,
  Building2,
  Fingerprint,
  FileText,
  Download,
  Home,
  Inbox,
  Handshake,
  LayoutDashboard,
  Leaf,
  LineChart,
  Lock,
  type LucideIcon,
  MapPinned,
  Package,
  QrCode,
  Recycle,
  Route,
  ScanSearch,
  Settings2,
  ShoppingBag,
  Truck,
  Users,
  Wallet,
  Warehouse,
} from "lucide-react";

import type { AdminType, Permission } from "@/lib/auth/permissions";

export type NavBadge = "new" | "soon";

export interface NavSubItem {
  id: string;
  title: string;
  url: string;
  icon?: LucideIcon;
  badge?: NavBadge;
  disabled?: boolean;
  newTab?: boolean;
  permission?: Permission;
  /** When set, only these roles see the item (after permission checks). */
  roles?: AdminType[];
}

interface NavItemBase {
  id: string;
  title: string;
  icon?: LucideIcon;
  badge?: NavBadge;
  disabled?: boolean;
  newTab?: boolean;
  permission?: Permission;
  roles?: AdminType[];
}

export interface NavMainLinkItem extends NavItemBase {
  url: string;
  subItems?: never;
}

export interface NavMainParentItem extends NavItemBase {
  subItems: NavSubItem[];
}

export type NavMainItem = NavMainLinkItem | NavMainParentItem;

export interface NavGroup {
  id: number;
  label?: string;
  items: NavMainItem[];
}

export const sidebarItems: NavGroup[] = [
  {
    id: 1,
    label: "Operations",
    items: [
      {
        id: "ops",
        title: "Command Center",
        url: "/dashboard/ops",
        icon: LayoutDashboard,
        permission: "ops:read",
      },
      {
        id: "live-map",
        title: "Live Map",
        url: "/dashboard/live-map",
        icon: MapPinned,
        permission: "map:read",
        roles: ["owner", "ops_manager"],
      },
      {
        id: "pickups",
        title: "Jobs",
        url: "/dashboard/pickups",
        icon: Package,
        permission: "ops:read",
      },
      {
        id: "routes",
        title: "Routes & Dispatch",
        url: "/dashboard/routes",
        icon: Route,
        permission: "ops:read",
      },
      {
        id: "support",
        title: "Ops Reports",
        url: "/dashboard/support",
        icon: AlertTriangle,
        permission: "ops:read",
      },
      {
        id: "notifications",
        title: "Notifications",
        url: "/dashboard/notifications",
        icon: Bell,
        permission: "notifications:read",
      },
    ],
  },
  {
    id: 2,
    label: "People",
    items: [
      {
        id: "users",
        title: "Users",
        url: "/dashboard/users",
        icon: Users,
        permission: "people:read",
      },
      {
        id: "partners",
        title: "Partners",
        url: "/dashboard/partners",
        icon: Truck,
        permission: "people:read",
      },
      {
        id: "buyers",
        title: "Buyers",
        url: "/dashboard/buyers",
        icon: Building2,
        permission: "people:read",
      },
      {
        id: "roles",
        title: "Admin Roles",
        url: "/dashboard/roles",
        icon: Lock,
        permission: "roles:manage",
      },
    ],
  },
  {
    id: 3,
    label: "Assets",
    items: [
      {
        id: "bags",
        title: "Bags & QR",
        url: "/dashboard/bags",
        icon: QrCode,
        permission: "assets:read",
      },
      {
        id: "bins",
        title: "Bins",
        url: "/dashboard/bins",
        icon: Boxes,
        permission: "assets:read",
      },
      {
        id: "zones",
        title: "Zones & Slots",
        url: "/dashboard/zones",
        icon: MapPinned,
        permission: "assets:read",
      },
      {
        id: "passport",
        title: "Waste Passport",
        url: "/dashboard/passport",
        icon: ScanSearch,
        permission: "passport:read",
      },
    ],
  },
  {
    id: 4,
    label: "Recovery (MRF)",
    items: [
      {
        id: "mrf",
        title: "MRF Facilities",
        url: "/dashboard/mrf",
        icon: Warehouse,
        permission: "mrf:read",
      },
      {
        id: "ai-segregation",
        title: "AI Segregation",
        url: "/dashboard/ai-segregation",
        icon: BrainCircuit,
        permission: "mrf:read",
      },
      {
        id: "inventory",
        title: "Material Inventory",
        url: "/dashboard/inventory",
        icon: Boxes,
        permission: "mrf:read",
      },
    ],
  },
  {
    id: 5,
    label: "Commerce",
    items: [
      {
        id: "p2p",
        title: "P2P Trade",
        url: "/dashboard/p2p",
        icon: Handshake,
        permission: "commerce:read",
      },
      {
        id: "sell-waste",
        title: "Sell Waste",
        url: "/dashboard/sell-waste",
        icon: Recycle,
        permission: "commerce:read",
      },
      {
        id: "marketplace",
        title: "Product Shop",
        url: "/dashboard/marketplace",
        icon: ShoppingBag,
        permission: "commerce:read",
      },
      {
        id: "orders",
        title: "Orders",
        url: "/dashboard/orders",
        icon: Package,
        permission: "commerce:read",
      },
      {
        id: "settlements",
        title: "Settlements",
        url: "/dashboard/settlements",
        icon: Banknote,
        permission: "settlements:read",
      },
      {
        id: "rewards",
        title: "Rewards & Points",
        url: "/dashboard/rewards",
        icon: Wallet,
        permission: "commerce:read",
      },
    ],
  },
  {
    id: 8,
    label: "City Oversight",
    items: [
      {
        id: "gov-desk",
        title: "Command Desk",
        url: "/dashboard/compliance",
        icon: LayoutDashboard,
        permission: "compliance:read",
      },
      {
        id: "gov-reports",
        title: "Citizen Reports",
        url: "/dashboard/compliance/reports",
        icon: Inbox,
        permission: "citizen_reports:read",
      },
      {
        id: "gov-jobs",
        title: "Pickups & Jobs",
        url: "/dashboard/compliance/jobs",
        icon: Package,
        permission: "compliance:read",
      },
      {
        id: "gov-map",
        title: "Live Map",
        url: "/dashboard/live-map",
        icon: MapPinned,
        permission: "map:read",
        roles: ["government"],
      },
      {
        id: "gov-households",
        title: "Households",
        url: "/dashboard/compliance/households",
        icon: Home,
        permission: "compliance:read",
      },
      {
        id: "gov-zones",
        title: "Zones & Coverage",
        url: "/dashboard/compliance/zones",
        icon: MapPinned,
        permission: "compliance:read",
      },
      {
        id: "gov-mrf",
        title: "MRF Facilities",
        url: "/dashboard/compliance/mrf",
        icon: Warehouse,
        permission: "compliance:read",
      },
      {
        id: "gov-passport",
        title: "Waste Passport",
        url: "/dashboard/passport",
        icon: ScanSearch,
        permission: "passport:read",
      },
      {
        id: "gov-audit",
        title: "Audit Log",
        url: "/dashboard/compliance/audit",
        icon: FileText,
        permission: "audit:read",
      },
      {
        id: "gov-exports",
        title: "Reports & Exports",
        url: "/dashboard/compliance/exports",
        icon: Download,
        permission: "compliance:read",
      },
    ],
  },
  {
    id: 6,
    label: "Impact",
    items: [
      {
        id: "analytics",
        title: "Analytics",
        url: "/dashboard/analytics",
        icon: LineChart,
        permission: "analytics:read",
      },
      {
        id: "impact",
        title: "Impact & ESG",
        url: "/dashboard/impact",
        icon: Leaf,
        permission: "impact:read",
      },
    ],
  },
  {
    id: 7,
    label: "Platform",
    items: [
      {
        id: "config",
        title: "App Config",
        url: "/dashboard/config",
        icon: Settings2,
        permission: "config:write",
      },
      {
        id: "authentication",
        title: "Authentication",
        icon: Fingerprint,
        permission: "config:write",
        subItems: [
          { id: "auth-login", title: "Login", url: "/auth/v2/login", newTab: true },
          { id: "auth-register", title: "Register", url: "/auth/v2/register", newTab: true },
        ],
      },
    ],
  },
];
