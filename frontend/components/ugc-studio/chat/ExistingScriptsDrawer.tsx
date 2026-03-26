"use client";

import { useState, useEffect } from "react";
import { Button, Spinner } from "@heroui/react";
import { Icon } from "@iconify/react";
import { motion, AnimatePresence } from "framer-motion";
import { ugcScriptAPI } from "@/api/ugc";
import type { ScriptSummary } from "@/components/ugc-studio/script/types";

interface ExistingScriptsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  teamId: number;
  onSelectScript: (scriptId: string) => void;
}

export function ExistingScriptsDrawer({
  isOpen,
  onClose,
  teamId,
  onSelectScript,
}: ExistingScriptsDrawerProps) {
  const [scripts, setScripts] = useState<ScriptSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);

  useEffect(() => {
    if (isOpen && scripts.length === 0) {
      loadScripts();
    }
  }, [isOpen]);

  const loadScripts = async (offset = 0) => {
    setIsLoading(true);
    try {
      const res = await ugcScriptAPI.listScripts(teamId, { limit: 10, offset });
      setScripts((prev) => (offset === 0 ? res.scripts : [...prev, ...res.scripts]));
      setHasMore(res.hasMore);
    } catch (err) {
      console.error("Failed to load scripts:", err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/50"
            onClick={onClose}
          />

          {/* Drawer */}
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-md bg-surface-dark border-l border-border-base flex flex-col"
          >
            <div className="flex items-center justify-between p-4 border-b border-border-base">
              <h3 className="text-lg font-semibold text-text-primary">Existing Scripts</h3>
              <Button isIconOnly variant="tertiary" size="sm" onPress={onClose}>
                <Icon icon="solar:close-circle-bold" width={20} />
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {scripts.map((script, index) => (
                <div
                  key={`${script.id}-${index}`}
                  onClick={() => onSelectScript(script.id)}
                  className="w-full text-left p-3 rounded-xl bg-surface-base border border-border-base hover:border-accent-400/40 transition-all cursor-pointer space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-text-primary truncate">
                      {script.title}
                    </span>
                    <span className="text-xs text-text-tertiary shrink-0 ml-2">
                      {script.sceneCount} scenes
                    </span>
                  </div>
                  {script.scriptDirection && (
                    <p className="text-xs text-text-secondary line-clamp-2">
                      {script.scriptDirection}
                    </p>
                  )}
                </div>
              ))}

              {isLoading && (
                <div className="flex justify-center py-4">
                  <Spinner size="sm" />
                </div>
              )}

              {hasMore && !isLoading && (
                <Button
 variant="tertiary"
 size="sm"
 className="w-full"
 onPress={() => loadScripts(scripts.length)}
 >
                  Load More
                </Button>
              )}

              {!isLoading && scripts.length === 0 && (
                <p className="text-sm text-text-secondary text-center py-8">
                  No existing scripts found
                </p>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
