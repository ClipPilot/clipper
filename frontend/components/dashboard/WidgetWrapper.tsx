"use client";

import { ReactNode } from "react";
import { Card, Popover } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useAtomValue } from "jotai";
import { isEditModeAtom, WIDGET_COLOR_OPTIONS } from "@/store/dashboard";

interface WidgetWrapperProps {
  id: string;
  title: string;
  icon: string;
  color?: string;
  onColorChange?: (color: string) => void;
  children: ReactNode;
}

export function WidgetWrapper({
  id,
  title,
  icon,
  color = "#4F47E6",
  onColorChange,
  children,
}: WidgetWrapperProps) {
  const isEditMode = useAtomValue(isEditModeAtom);

  return (
    <Card className="h-full bg-surface-base border border-border-base overflow-hidden">
      <div
        className="flex items-center justify-between px-4 py-3 border-b border-border-base"
        style={{ backgroundColor: `${color}15` }}
      >
        <div className="flex items-center gap-2">
          {isEditMode && (
            <div className="drag-handle cursor-grab active:cursor-grabbing">
              <Icon
                icon="solar:hamburger-menu-linear"
                width={16}
                className="text-text-tertiary"
              />
            </div>
          )}
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: color }}
          >
            <Icon icon={icon} width={16} className="text-white" />
          </div>
          <span className="font-medium text-text-accent text-sm">{title}</span>
        </div>
        {isEditMode && onColorChange && (
          <Popover placement="bottom-end">
            <Popover.Trigger>
              <button className="p-1 rounded hover:bg-surface-hover transition-colors">
                <Icon
                  icon="solar:palette-linear"
                  width={16}
                  className="text-text-tertiary"
                />
              </button>
            </Popover.Trigger>
            <Popover.Content className="bg-surface-elevated border border-border-base p-3">
              <div className="flex gap-2">
                {WIDGET_COLOR_OPTIONS.map((option) => (
                  <button
                    key={option.name}
                    onClick={() => onColorChange(option.value)}
                    className="w-6 h-6 rounded-full border-2 transition-transform hover:scale-110"
                    style={{
                      backgroundColor: option.value,
                      borderColor: color === option.value ? "white" : "transparent",
                    }}
                  />
                ))}
              </div>
            </Popover.Content>
          </Popover>
        )}
      </div>
      <Card.Content className="p-4 overflow-auto">{children}</Card.Content>
    </Card>
  );
}
