"use client";

import { useState } from "react";
import { Card, CardBody, Button, Chip } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useRouter } from "next/navigation";

// Template definitions
const templates = [
  {
    id: "talking-head",
    title: "Talking Head UGC",
    description: "AI actor delivers your script directly to camera. Perfect for testimonials and reviews.",
    icon: "solar:user-speak-bold-duotone",
    gradient: "from-violet-500/20 via-purple-500/10 to-transparent",
    iconColor: "text-violet-400",
    popular: true,
  },
  {
    id: "product-demo",
    title: "Product Demo",
    description: "Showcase your product with dynamic shots and AI narration. Great for launches.",
    icon: "solar:box-bold-duotone",
    gradient: "from-cyan-500/20 via-blue-500/10 to-transparent",
    iconColor: "text-cyan-400",
    popular: false,
  },
  {
    id: "faceless-broll",
    title: "Faceless B-roll Ad",
    description: "Cinematic B-roll with voiceover. No face needed, just compelling visuals.",
    icon: "solar:clapperboard-play-bold-duotone",
    gradient: "from-amber-500/20 via-orange-500/10 to-transparent",
    iconColor: "text-amber-400",
    popular: false,
  },
  {
    id: "testimonial",
    title: "Testimonial Style",
    description: "Authentic customer story format. Build trust with social proof ads.",
    icon: "solar:chat-square-like-bold-duotone",
    gradient: "from-emerald-500/20 via-green-500/10 to-transparent",
    iconColor: "text-emerald-400",
    popular: false,
  },
];

// Mock recent ads data
const recentAds = [
  {
    id: "1",
    title: "Summer Sale Promo",
    template: "Talking Head UGC",
    status: "completed",
    thumbnail: "/api/placeholder/160/90",
    createdAt: "2 hours ago",
  },
  {
    id: "2",
    title: "Product Launch Video",
    template: "Product Demo",
    status: "processing",
    thumbnail: "/api/placeholder/160/90",
    createdAt: "5 hours ago",
  },
  {
    id: "3",
    title: "Customer Review #4",
    template: "Testimonial Style",
    status: "completed",
    thumbnail: "/api/placeholder/160/90",
    createdAt: "1 day ago",
  },
];

function StatusChip({ status }: { status: string }) {
  const config = {
    completed: { color: "success" as const, icon: "solar:check-circle-bold", label: "Completed" },
    processing: { color: "warning" as const, icon: "solar:refresh-bold", label: "Processing" },
    draft: { color: "default" as const, icon: "solar:document-bold", label: "Draft" },
    failed: { color: "danger" as const, icon: "solar:danger-triangle-bold", label: "Failed" },
  }[status] || { color: "default" as const, icon: "solar:question-circle-bold", label: status };

  return (
    <Chip
      size="sm"
      variant="flat"
      color={config.color}
      startContent={
        <Icon
          icon={config.icon}
          width={14}
          className={status === "processing" ? "animate-spin" : ""}
        />
      }
      classNames={{
        base: "h-6",
        content: "text-xs font-medium",
      }}
    >
      {config.label}
    </Chip>
  );
}

function TemplateCard({
  template,
  onSelect,
}: {
  template: (typeof templates)[0];
  onSelect: (id: string) => void;
}) {
  return (
    <Card
      isPressable
      onPress={() => onSelect(template.id)}
      className="bg-surface-base border border-border-base hover:border-accent-400/50 transition-all duration-200 group"
    >
      <CardBody className="p-5">
        <div className="flex flex-col gap-4">
          {/* Icon with gradient background */}
          <div
            className={`w-12 h-12 rounded-xl bg-gradient-to-br ${template.gradient} flex items-center justify-center border border-white/5`}
          >
            <Icon icon={template.icon} className={template.iconColor} width={26} />
          </div>

          {/* Title with popular badge */}
          <div className="flex items-center gap-2">
            <h3 className="text-text-primary font-semibold text-base">{template.title}</h3>
            {template.popular && (
              <Chip
                size="sm"
                variant="flat"
                classNames={{
                  base: "bg-accent-400/20 h-5",
                  content: "text-accent-400 text-[10px] font-semibold px-1",
                }}
              >
                POPULAR
              </Chip>
            )}
          </div>

          {/* Description */}
          <p className="text-text-secondary text-sm leading-relaxed">{template.description}</p>

          {/* Hover indicator */}
          <div className="flex items-center gap-1.5 text-accent-400 opacity-0 group-hover:opacity-100 transition-opacity">
            <span className="text-sm font-medium">Use template</span>
            <Icon icon="solar:arrow-right-linear" width={16} />
          </div>
        </div>
      </CardBody>
    </Card>
  );
}

function RecentAdCard({ ad }: { ad: (typeof recentAds)[0] }) {
  return (
    <Card className="bg-surface-base border border-border-base hover:border-border-base/80 transition-colors">
      <CardBody className="p-3">
        <div className="flex gap-3">
          {/* Thumbnail */}
          <div className="w-20 h-14 rounded-lg bg-surface-elevated flex items-center justify-center overflow-hidden flex-shrink-0">
            <Icon icon="solar:video-frame-bold-duotone" className="text-text-secondary/50" width={24} />
          </div>

          {/* Info */}
          <div className="flex flex-col justify-between flex-1 min-w-0">
            <div>
              <h4 className="text-text-primary font-medium text-sm truncate">{ad.title}</h4>
              <p className="text-text-secondary text-xs truncate">{ad.template}</p>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-text-secondary/70 text-xs">{ad.createdAt}</span>
              <StatusChip status={ad.status} />
            </div>
          </div>
        </div>
      </CardBody>
    </Card>
  );
}

export default function AIVideoCreatorPage() {
  const router = useRouter();
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);

  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplate(templateId);
    router.push(`/dashboard/ugc-studio/ai-video-creator/create?template=${templateId}`);
  };

  const handleCreateNew = () => {
    router.push("/dashboard/ugc-studio/ai-video-creator/create");
  };

  const handleManageActors = () => {
    router.push("/dashboard/ugc-studio/ai-video-creator/create");
  };

  return (
    <div className="min-h-screen bg-surface-dark">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <button
              onClick={() => router.push("/dashboard/ugc-studio")}
              className="p-1.5 rounded-lg hover:bg-surface-elevated transition-colors"
            >
              <Icon icon="solar:arrow-left-linear" className="text-text-secondary" width={20} />
            </button>
            <h1 className="text-2xl sm:text-3xl font-bold text-text-primary">AI Video Creator</h1>
          </div>
          <p className="text-text-secondary ml-10">
            Create professional UGC ads in minutes with AI-powered video generation
          </p>
        </div>

        {/* Main Actions */}
        <div className="flex flex-wrap gap-3 mb-10">
          <Button
            size="lg"
            className="bg-accent-400 text-white font-semibold px-6"
            startContent={<Icon icon="solar:add-circle-bold" width={20} />}
            onPress={handleCreateNew}
          >
            Create New Ad
          </Button>
          <Button
            size="lg"
            variant="bordered"
            className="border-border-base text-text-primary font-medium px-6"
            startContent={<Icon icon="solar:users-group-rounded-bold-duotone" width={20} />}
            onPress={handleManageActors}
          >
            Actors
          </Button>
        </div>

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Templates Section - Takes 2 columns */}
          <div className="lg:col-span-2">
            <div className="flex items-center gap-2 mb-4">
              <Icon icon="solar:widget-4-bold-duotone" className="text-accent-400" width={22} />
              <h2 className="text-lg font-semibold text-text-primary">Templates</h2>
            </div>
            <p className="text-text-secondary text-sm mb-5">
              Choose a template to get started quickly. Each template pre-fills your shot plan.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {templates.map((template) => (
                <TemplateCard
                  key={template.id}
                  template={template}
                  onSelect={handleTemplateSelect}
                />
              ))}
            </div>
          </div>

          {/* Recent Ads Section - Takes 1 column */}
          <div className="lg:col-span-1">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Icon icon="solar:history-bold-duotone" className="text-accent-400" width={22} />
                <h2 className="text-lg font-semibold text-text-primary">Recent Ads</h2>
              </div>
              <Button
                size="sm"
                variant="light"
                className="text-text-secondary hover:text-text-primary"
                endContent={<Icon icon="solar:arrow-right-linear" width={14} />}
              >
                View all
              </Button>
            </div>

            {recentAds.length > 0 ? (
              <div className="flex flex-col gap-3">
                {recentAds.map((ad) => (
                  <RecentAdCard key={ad.id} ad={ad} />
                ))}
              </div>
            ) : (
              <Card className="bg-surface-base border border-border-base border-dashed">
                <CardBody className="py-12 flex flex-col items-center justify-center text-center">
                  <div className="w-14 h-14 rounded-full bg-surface-elevated flex items-center justify-center mb-4">
                    <Icon
                      icon="solar:video-frame-play-vertical-bold-duotone"
                      className="text-text-secondary/50"
                      width={28}
                    />
                  </div>
                  <p className="text-text-secondary text-sm mb-1">No ads yet</p>
                  <p className="text-text-secondary/70 text-xs">
                    Create your first ad to see it here
                  </p>
                </CardBody>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
