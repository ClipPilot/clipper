export interface NavItem {
  label: string;
  href: string;
}

export const NAV_ITEMS: NavItem[] = [
  { label: "Teams", href: "/dashboard" },
  { label: "Referrals", href: "/dashboard/referrals" },
  { label: "Affiliates", href: "/dashboard/affiliates" },
  { label: "Announcements", href: "/dashboard/announcements" },
  { label: "Applications", href: "/dashboard/applications" },
];
