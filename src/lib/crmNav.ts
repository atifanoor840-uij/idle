import { Banknote, BadgeCheck, Boxes, ClipboardList, LayoutDashboard, ScrollText, Tag, Tags, Users } from "lucide-react";
import type { NavItem } from "./nav";

export const crmNav: { label: string; items: NavItem[] }[] = [
  {
    label: "Operations",
    items: [
      { label: "Overview", href: "/idlecrm", icon: LayoutDashboard },
      { label: "Orders & Accounts", href: "/idlecrm/orders", icon: ClipboardList },
      { label: "Payouts", href: "/idlecrm/payouts", icon: Banknote },
      { label: "KYC", href: "/idlecrm/kyc", icon: BadgeCheck },
      { label: "Users", href: "/idlecrm/users", icon: Users },
    ],
  },
  {
    label: "Catalog",
    items: [
      { label: "Pricing", href: "/idlecrm/pricing", icon: Tags },
      { label: "Coupons", href: "/idlecrm/coupons", icon: Tag },
      { label: "Credential inventory", href: "/idlecrm/inventory", icon: Boxes },
    ],
  },
  {
    label: "System",
    items: [{ label: "Audit log", href: "/idlecrm/audit", icon: ScrollText }],
  },
];
