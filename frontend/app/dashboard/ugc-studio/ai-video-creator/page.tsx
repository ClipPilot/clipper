"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, Button, Chip, Modal } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useRouter } from "next/navigation";
import { useAtomValue } from "jotai";
import { selectedTeamAtom } from "@/store/auth";
import { canAccessUGCStudio } from "@/lib/plans";
import { MyVideoJobsSection } from "@/components/ugc-studio/video-jobs";
import { ugcScriptAPI } from "@/api/ugc";
import type { ScriptSummary } from "@/components/ugc-studio/script/types";


export default function AIVideoCreatorPage() {
  const router = useRouter();
  const selectedTeam = useAtomValue(selectedTeamAtom);

  const handleCreateNew = () => {
    router.push("/dashboard/ugc-studio/ai-video-creator/create");
  };

  // Check if user has access to UGC Studio
  if (!selectedTeam || !canAccessUGCStudio(selectedTeam.plan)) {
    return (
      <div className="min-h-screen bg-surface-dark flex items-center justify-center p-4">
        <Card className="bg-surface-base border border-border-base max-w-md">
          <Card.Content className="p-8 text-center">
            <Icon
              icon="solar:lock-bold-duotone"
              className="text-amber-400 mx-auto mb-4"
              width={48}
            />
            <h2 className="text-xl font-bold text-text-accent mb-2">
              Scale Plan Required
            </h2>
            <p className="text-text-secondary text-sm mb-6">
              AI Video Creator requires a Scale plan or higher.
              Upgrade to unlock this feature.
            </p>
            <Button
 className="bg-accent-400 text-white font-semibold"
 onPress={() => router.push("/dashboard/pricing")}
 >
              View Plans
            </Button>
          </Card.Content>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-dark">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <button
                onClick={() => router.push("/dashboard/ugc-studio")}
                className="p-1.5 rounded-lg hover:bg-surface-elevated transition-colors"
              >
                <Icon icon="solar:arrow-left-linear" className="text-text-secondary" width={20} />
              </button>
              <h1 className="text-2xl sm:text-3xl font-bold text-text-accent">AI Video Creator</h1>
            </div>
            <p className="text-text-secondary ml-10">
              Create professional UGC ads in minutes with AI-powered video generation
            </p>
          </div>
          <Button
 size="lg"
 className="bg-accent-400 text-white font-semibold px-6"
 onPress={handleCreateNew}
 >
            <Icon icon="solar:add-circle-bold" width={20} />
            Create New Ad
          </Button>
        </div>

        {/* Drafts Section */}
        <DraftScriptsSection teamId={selectedTeam.id} />

        {/* My Videos Section - Full Width */}
        <div>
          <div className="flex items-center gap-2 mb-6">
            <Icon icon="solar:video-library-bold-duotone" className="text-accent-400" width={24} />
            <h2 className="text-xl font-semibold text-text-accent">My Videos</h2>
          </div>
          <MyVideoJobsSection teamId={selectedTeam.id} />
        </div>
      </div>
    </div>
  );
}

const DRAFTS_PER_PAGE = 9;

function DraftScriptsSection({ teamId }: { teamId: number }) {
  const router = useRouter();
  const [allDrafts, setAllDrafts] = useState<ScriptSummary[]>([]);
  const [page, setPage] = useState(0);
  const [deleteTarget, setDeleteTarget] = useState<ScriptSummary | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchDrafts = useCallback(() => {
    ugcScriptAPI.listScripts(teamId, { limit: 100 }).then((res) => {
      if (res.success) setAllDrafts(res.scripts.filter((s: any) => !s.hasVideo));
    }).catch(() => {});
  }, [teamId]);

  useEffect(() => {
    fetchDrafts();
  }, [fetchDrafts]);

  const totalPages = Math.ceil(allDrafts.length / DRAFTS_PER_PAGE);
  const paginatedDrafts = allDrafts.slice(
    page * DRAFTS_PER_PAGE,
    (page + 1) * DRAFTS_PER_PAGE
  );

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await ugcScriptAPI.deleteScript(deleteTarget.id, teamId);
      setAllDrafts((prev) => prev.filter((d) => d.id !== deleteTarget.id));
      // If current page is now empty and not the first page, go back
      const remaining = allDrafts.length - 1;
      const newTotalPages = Math.ceil(remaining / DRAFTS_PER_PAGE);
      if (page >= newTotalPages && page > 0) setPage(page - 1);
    } catch {
      // silently fail
    } finally {
      setIsDeleting(false);
      setDeleteTarget(null);
    }
  };

  if (allDrafts.length === 0) return null;

  return (
    <div className="mb-8">
      <div className="flex items-center gap-2 mb-4">
        <Icon icon="solar:document-text-bold-duotone" className="text-amber-400" width={20} />
        <h2 className="text-lg font-semibold text-text-accent">Drafts</h2>
        <Chip size="sm" variant="tertiary" className="text-[11px]">{allDrafts.length}</Chip>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {paginatedDrafts.map((script) => (
          <div
            key={script.id}
            className="relative text-left p-4 rounded-xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] hover:border-accent-400/20 transition-all group cursor-pointer"
            onClick={() => router.push(`/dashboard/ugc-studio/ai-video-creator/create?scriptId=${script.id}`)}
          >
            <div className="flex items-start justify-between mb-2">
              <h3 className="text-sm font-semibold text-text-accent line-clamp-1 group-hover:text-accent-400 transition-colors">
                {script.title || "Untitled Script"}
              </h3>
              <div className="flex items-center gap-1 shrink-0 ml-2">
                <Chip size="sm" variant="tertiary" className="text-[9px] bg-amber-500/10 text-amber-400">
                  Draft
                </Chip>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteTarget(script);
                  }}
                  className="p-1 rounded-md opacity-0 group-hover:opacity-100 hover:bg-red-500/10 transition-all"
                  aria-label="Delete draft"
                >
                  <Icon icon="solar:trash-bin-trash-bold" className="text-red-400" width={14} />
                </button>
              </div>
            </div>
            <p className="text-[11px] text-text-muted line-clamp-2 mb-2">{script.hook || script.scriptDirection || "No description"}</p>
            <div className="flex items-center gap-3 text-[10px] text-text-muted">
              <span>{script.sceneCount} scenes</span>
              <span>{Math.round(script.totalDuration)}s</span>
              <span>{new Date(script.createdAt).toLocaleDateString()}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          <Button
 size="sm"
 variant="tertiary"
 isDisabled={page === 0}
 onPress={() => setPage(page - 1)}
 >
            <Icon icon="solar:arrow-left-linear" width={14} />
            Prev
          </Button>
          <span className="text-xs text-text-secondary px-2">
            {page + 1} / {totalPages}
          </span>
          <Button
 size="sm"
 variant="tertiary"
 isDisabled={page >= totalPages - 1}
 onPress={() => setPage(page + 1)}
 >
            Next
            <Icon icon="solar:arrow-right-linear" width={14} />
</Button>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <Modal>
        <Modal.Backdrop isOpen={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}><Modal.Container><Modal.Dialog className="sm:max-w-sm">
          <Modal.Header className="text-text-accent">Delete Draft</Modal.Header>
          <Modal.Body>
            <p className="text-sm text-text-secondary">
              Are you sure you want to delete &quot;{deleteTarget?.title || "Untitled Script"}&quot;? This action cannot be undone.
            </p>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="tertiary" onPress={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button variant="danger"
 isPending={isDeleting}
 onPress={handleDelete}
 >
              Delete
            </Button>
          </Modal.Footer>
        </Modal.Dialog></Modal.Container></Modal.Backdrop>
      </Modal>
    </div>
  );
}
