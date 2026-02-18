export type SidebarItem = {
  key: string;
  title: string;
  icon?: string;
  href: string;
  requiredPlans?: string[];
};

export const SIDEBAR_ITEMS: SidebarItem[] = [
  {
    key: "home",
    title: "Home",
    icon: "solar:home-2-bold-duotone",
    href: "/dashboard",
  },
  {
    key: "clips",
    title: "Library",
    icon: "solar:video-library-bold-duotone",
    href: "/dashboard/clips",
  },
  {
    key: "create-clip",
    title: "AI Clipping",
    icon: "solar:scissors-bold-duotone",
    href: "/dashboard/create-clip",
  },
  {
    key: "ugc-studio",
    title: "UGC Studio",
    icon: "solar:video-frame-play-vertical-bold-duotone",
    href: "/dashboard/ugc-studio",
  },
  {
    key: "virality-tracker",
    title: "Virality Tracker",
    icon: "solar:chart-bold-duotone",
    href: "/dashboard/virality",
    requiredPlans: ["studio", "scale", "enterprise"],
  },
  {
    key: "mass-posting",
    title: "Publish Post",
    icon: "solar:posts-carousel-vertical-bold-duotone",
    href: "/dashboard/mass-posting",
    requiredPlans: ["studio", "scale", "enterprise"],
  },
];
