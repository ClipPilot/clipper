export type SidebarItem = {
  key: string;
  title: string;
  icon: string;
  href: string;
  requiredPlans?: string[];
};

export type SidebarSection = {
  title: string | null;
  items: SidebarItem[];
};

export const SIDEBAR_SECTIONS: SidebarSection[] = [
  {
    title: null,
    items: [
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
    ],
  },
  {
    title: "AI Tools",
    items: [
      {
        key: "ugc-studio",
        title: "UGC Studio",
        icon: "solar:video-frame-play-vertical-bold-duotone",
        href: "/dashboard/ugc-studio",
      },
      {
        key: "create-clip",
        title: "AI Clipping",
        icon: "solar:scissors-bold-duotone",
        href: "/dashboard/create-clip",
      },
    ],
  },
  {
    title: "Distribution",
    items: [
      {
        key: "publish-posts",
        title: "Publish Posts",
        icon: "solar:posts-carousel-vertical-bold-duotone",
        href: "/dashboard/publish-posts",
        requiredPlans: ["studio", "scale", "enterprise"],
      },
    ],
  },
  {
    title: "Intelligence",
    items: [
      {
        key: "your-performance",
        title: "Your Performance",
        icon: "solar:graph-up-bold-duotone",
        href: "/dashboard/your-performance",
        requiredPlans: ["studio", "scale", "enterprise", "analytics_starter", "analytics_pro", "analytics_business"],
      },
      {
        key: "your-competitors",
        title: "Your Competitors",
        icon: "solar:users-group-two-rounded-bold-duotone",
        href: "/dashboard/your-competitors",
        requiredPlans: ["studio", "scale", "enterprise", "analytics_starter", "analytics_pro", "analytics_business"],
      },
      {
        key: "alerts",
        title: "Alerts",
        icon: "solar:bell-bold-duotone",
        href: "/dashboard/alerts",
        requiredPlans: ["studio", "scale", "enterprise", "analytics_starter", "analytics_pro", "analytics_business"],
      },
      {
        key: "reports",
        title: "Reports",
        icon: "solar:chart-square-bold-duotone",
        href: "/dashboard/reports",
        requiredPlans: ["studio", "scale", "enterprise", "analytics_starter", "analytics_pro", "analytics_business"],
      },
    ],
  },
];

export const ALL_SIDEBAR_ITEMS: SidebarItem[] = SIDEBAR_SECTIONS.flatMap(
  (s) => s.items
);
