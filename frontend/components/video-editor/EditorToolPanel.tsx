"use client";

import React from "react";
import { useAtom } from "jotai";
import { Icon } from "@iconify/react";
import { activeToolAtom, EditorTool } from "@/store/videoEditor";
import { TrimTool } from "./tools/TrimTool";
import { SpeedTool } from "./tools/SpeedTool";
import { CropTool } from "./tools/CropTool";
import { AudioTool } from "./tools/AudioTool";
import { CaptionsTool } from "./tools/CaptionsTool";
import { HeadingTool } from "./tools/HeadingTool";
import { OverlayTool } from "./tools/OverlayTool";

interface ToolTab {
  id: EditorTool;
  label: string;
  icon: string;
}

const TOOL_TABS: ToolTab[] = [
  { id: "trim", label: "Trim", icon: "solar:scissors-bold" },
  { id: "crop", label: "Crop", icon: "solar:crop-bold" },
  { id: "speed", label: "Speed", icon: "solar:playback-speed-bold" },
  { id: "audio", label: "Audio", icon: "solar:volume-loud-bold" },
  { id: "captions", label: "Captions", icon: "solar:subtitles-bold" },
  { id: "heading", label: "Heading", icon: "solar:text-bold" },
  { id: "overlay", label: "Overlay", icon: "solar:layers-bold" },
];

export function EditorToolPanel() {
  const [activeTool, setActiveTool] = useAtom(activeToolAtom);

  const renderActiveTool = () => {
    switch (activeTool) {
      case "trim":
        return <TrimTool />;
      case "crop":
        return <CropTool />;
      case "speed":
        return <SpeedTool />;
      case "audio":
        return <AudioTool />;
      case "captions":
        return <CaptionsTool />;
      case "heading":
        return <HeadingTool />;
      case "overlay":
        return <OverlayTool />;
      default:
        return null;
    }
  };

  return (
    <div className="bg-surface-base border border-border-base rounded-xl overflow-hidden h-full flex flex-col">
      {/* Tab Navigation */}
      <div className="flex flex-wrap border-b border-border-base bg-surface-elevated">
        {TOOL_TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTool(tab.id)}
            className={`flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium transition-colors ${
              activeTool === tab.id
                ? "text-accent-400 bg-accent-400/10 border-b-2 border-accent-400"
                : "text-text-secondary hover:text-text-primary hover:bg-surface-hover"
            }`}
          >
            <Icon icon={tab.icon} className="text-lg" />
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tool Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {renderActiveTool()}
      </div>
    </div>
  );
}
