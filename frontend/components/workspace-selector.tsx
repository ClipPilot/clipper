"use client";

import React from "react";
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  ScrollShadow,
  Avatar,
  cn,
  type CardProps,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { useAtom } from "jotai";
import { selectedWorkspaceAtom } from "@/store/auth";

type Workspace = {
  key: string;
  label: string;
  icon?: string;
  members?: number;
};

const workspaces: Workspace[] = [
  { key: "personal", label: "Personal Workspace", icon: "solar:user-bold-duotone", members: 1 },
  { key: "work", label: "Work Workspace", icon: "solar:buildings-2-bold-duotone", members: 12 },
  { key: "team", label: "Team Projects", icon: "solar:users-group-two-rounded-bold-duotone", members: 5 },
];

export default function WorkspaceSelector(props: CardProps) {
  const [selectedWorkspace, setSelectedWorkspace] = useAtom(selectedWorkspaceAtom);

  return (
    <Card className="w-full max-w-[320px] bg-surface-base border border-border-base" {...props}>
      <CardHeader className="flex flex-col px-0 pb-0">
        <div className="flex w-full items-center justify-between px-5 py-3 border-b border-border-base">
          <h4 className="text-medium font-semibold text-text-primary">Switch Workspace</h4>
          <Button
            isIconOnly
            size="sm"
            variant="light"
            className="text-text-tertiary"
          >
            <Icon icon="solar:settings-bold-duotone" width={18} />
          </Button>
        </div>
      </CardHeader>
      <CardBody className="w-full gap-0 p-0">
        <ScrollShadow className="max-h-[300px] w-full">
          {workspaces.map((workspace) => (
            <button
              key={workspace.key}
              onClick={() => setSelectedWorkspace(workspace.key)}
              className={cn(
                "w-full flex items-center gap-3 px-5 py-3 border-b border-border-base transition-colors hover:bg-surface-elevated",
                {
                  "bg-accent-400/10": selectedWorkspace === workspace.key,
                }
              )}
            >
              <div className={cn(
                "flex items-center justify-center w-10 h-10 rounded-lg",
                selectedWorkspace === workspace.key ? "bg-accent-400 text-white" : "bg-surface-elevated text-text-tertiary"
              )}>
                <Icon icon={workspace.icon || "solar:buildings-2-bold-duotone"} width={20} />
              </div>
              <div className="flex-1 flex flex-col items-start">
                <span className={cn(
                  "text-sm font-medium",
                  selectedWorkspace === workspace.key ? "text-accent-400" : "text-text-primary"
                )}>
                  {workspace.label}
                </span>
                <span className="text-xs text-text-tertiary">
                  {workspace.members} {workspace.members === 1 ? "member" : "members"}
                </span>
              </div>
              {selectedWorkspace === workspace.key && (
                <Icon icon="solar:check-circle-bold" className="text-accent-400" width={20} />
              )}
            </button>
          ))}
        </ScrollShadow>
      </CardBody>
      <div className="px-4 py-3 border-t border-border-base">
        <Button
          variant="flat"
          className="w-full"
          startContent={<Icon icon="solar:add-circle-bold-duotone" width={18} />}
        >
          Create Workspace
        </Button>
      </div>
    </Card>
  );
}
