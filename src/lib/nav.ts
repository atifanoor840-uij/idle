import {
  Award,
  BadgeCheck,
  Banknote,
  CalendarDays,
  Download,
  Flag,
  Layers,
  LayoutDashboard,
  LifeBuoy,
  type LucideIcon,
  Medal,
  NotebookPen,
  Receipt,
  Settings,
  ShoppingCart,
  TrendingUp,
  Users,
} from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  external?: boolean;
}

export const navGroups: { label: string; items: NavItem[] }[] = [
  {
    label: "Main",
    items: [
      { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
      { label: "Challenges", href: "/challenges", icon: ShoppingCart },
      { label: "My Accounts", href: "/accounts", icon: Layers },
      { label: "Payouts", href: "/payouts", icon: Banknote },
      { label: "Billing", href: "/billing", icon: Receipt },
      { label: "Certificates", href: "/certificates", icon: Award },
    ],
  },
  {
    label: "Trading tools",
    items: [
      { label: "Trading Journal", href: "/trades", icon: NotebookPen },
      { label: "Economic Calendar", href: "/calendar", icon: CalendarDays },
      { label: "Market Overview", href: "/market", icon: TrendingUp },
      { label: "Downloads", href: "/downloads", icon: Download },
    ],
  },
  {
    label: "Grow",
    items: [
      { label: "Affiliate Program", href: "/affiliate", icon: Users },
      { label: "Leaderboard", href: "/leaderboard", icon: Medal },
      { label: "Competitions", href: "/competitions", icon: Flag },
    ],
  },
  {
    label: "Account",
    items: [
      { label: "Profile & KYC", href: "/profile", icon: BadgeCheck },
      { label: "Settings", href: "/settings", icon: Settings },
      { label: "Help Center", href: "#", icon: LifeBuoy, external: true },
    ],
  },
];

export const allNavItems = navGroups.flatMap((g) => g.items);
