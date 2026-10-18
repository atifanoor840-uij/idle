import { Banknote, BadgeCheck, Boxes, ClipboardList, KeyRound, LayoutDashboard, ScrollText, Tag, Tags, Users } from "lucide-react";
import type { NavItem } from "./nav";

export const crmNav: { label: string; items: NavItem[] }[] = [
  {
    label: "Operations",
    items: [
      { label: "Overview", href: "/admin", icon: LayoutDashboard },
      { label: "Orders", href: "/admin/orders", icon: ClipboardList },
      { label: "Accounts & Delivery", href: "/admin/accounts", icon: KeyRound },
      { label: "Payouts", href: "/admin/payouts", icon: Banknote },
      { label: "KYC", href: "/admin/kyc", icon: BadgeCheck },
      { label: "Users", href: "/admin/users", icon: Users },
    ],
  },
  {
    label: "Catalog",
    items: [
      { label: "Pricing", href: "/admin/pricing", icon: Tags },
      { label: "Coupons", href: "/admin/coupons", icon: Tag },
      { label: "Credential inventory", href: "/admin/inventory", icon: Boxes },
    ],
  },
  {
    label: "System",
    items: [{ label: "Audit log", href: "/admin/audit", icon: ScrollText }],
  },
];
