"use client";

import { Card, CardBody, Button } from "@heroui/react";
import { Icon } from "@iconify/react";
import type { ScriptSummary } from "../types";

interface ExistingScriptsListProps {
  scripts: ScriptSummary[];
  isLoading: boolean;
  isLoadingScript: boolean;
  hasMore: boolean;
  isLoadingMore: boolean;
  onLoadScript: (script: ScriptSummary) => void;
  onLoadMore: () => void;
  onCreateNew: () => void;
}

export function ExistingScriptsList({
  scripts,
  isLoading,
  isLoadingScript,
  hasMore,
  isLoadingMore,
  onLoadScript,
  onLoadMore,
  onCreateNew,
}: ExistingScriptsListProps) {
  return (
    <div className="space-y-4">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-text-primary mb-2">
          Your Scripts
        </h2>
        <p className="text-text-secondary">
          Select a script to continue editing or generate videos from it.
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Icon icon="solar:spinner-bold" className="animate-spin text-accent-400" width={32} />
        </div>
      ) : scripts.length === 0 ? (
        <Card className="bg-surface-elevated border border-border-base">
          <CardBody className="py-12 text-center">
            <Icon icon="solar:document-text-bold-duotone" className="text-text-muted mx-auto mb-4" width={48} />
            <h3 className="text-lg font-semibold text-text-primary mb-2">No Scripts Yet</h3>
            <p className="text-text-secondary text-sm mb-4">
              Create your first script to get started!
            </p>
            <Button
              className="bg-accent-400 text-white"
              onPress={onCreateNew}
              startContent={<Icon icon="solar:add-circle-bold" width={18} />}
            >
              Create New Script
            </Button>
          </CardBody>
        </Card>
      ) : (
        <div className="grid gap-3">
          {scripts.map((script) => (
            <Card
              key={script.id}
              isPressable
              className="bg-surface-elevated border border-border-base hover:border-accent-400/50 transition-all"
              onPress={() => onLoadScript(script)}
            >
              <CardBody className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-text-primary truncate">
                        {script.title || "Untitled Script"}
                      </h3>
                      <span className="flex items-center gap-1 text-xs bg-accent-400/20 text-accent-400 px-2 py-0.5 rounded-full">
                        <Icon icon="solar:fire-bold" width={12} />
                        {script.viralScore}
                      </span>
                    </div>
                    <p className="text-sm text-text-secondary line-clamp-1 mb-2">
                      {script.hook || script.scriptDirection || "No description"}
                    </p>
                    <div className="flex items-center gap-3 text-xs text-text-muted">
                      {script.productName && (
                        <span className="flex items-center gap-1">
                          <Icon icon="solar:box-bold-duotone" width={14} />
                          {script.productName}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Icon icon="solar:video-frame-bold-duotone" width={14} />
                        {script.sceneCount} scenes
                      </span>
                      <span className="flex items-center gap-1">
                        <Icon icon="solar:clock-circle-bold-duotone" width={14} />
                        {script.totalDuration}s
                      </span>
                      <span className="flex items-center gap-1">
                        <Icon icon="solar:calendar-bold-duotone" width={14} />
                        {new Date(script.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center">
                    {isLoadingScript ? (
                      <Icon icon="solar:spinner-bold" className="animate-spin text-accent-400" width={20} />
                    ) : (
                      <Icon icon="solar:arrow-right-linear" className="text-text-muted" width={20} />
                    )}
                  </div>
                </div>
              </CardBody>
            </Card>
          ))}
          {hasMore && (
            <div className="flex justify-center pt-4">
              <Button
                variant="flat"
                className="bg-surface-elevated text-text-secondary"
                onPress={onLoadMore}
                isLoading={isLoadingMore}
                startContent={!isLoadingMore && <Icon icon="solar:arrow-down-bold" width={16} />}
              >
                {isLoadingMore ? "Loading..." : "Load More"}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
