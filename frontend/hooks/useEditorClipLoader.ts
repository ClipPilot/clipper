"use client";

import { useEffect } from "react";
import { useAtom, useSetAtom } from "jotai";
import { selectedTeamAtom } from "@/store/auth";
import { clipsAPI } from "@/api/clips";
import {
  editorClipAtom,
  editorLoadingAtom,
  editorAccessDeniedAtom,
  captionsEnabledAtom,
  captionsDataAtom,
  captionColorAtom,
  captionFontAtom,
  headingStateAtom,
} from "@/store/videoEditor";

/**
 * useEditorClipLoader
 *
 * Fetches the clip by ID for the active team, validates access, and
 * initialises caption/heading atoms from the clip's metadata.
 * Manages editorLoadingAtom and editorAccessDeniedAtom throughout.
 *
 * Usage:
 *   useEditorClipLoader(clipId);
 *   // Then read editorClipAtom, editorLoadingAtom, editorAccessDeniedAtom
 *   // from the store in the consuming component.
 */
export function useEditorClipLoader(clipId: number) {
  const [selectedTeam] = useAtom(selectedTeamAtom);
  const [, setClip] = useAtom(editorClipAtom);
  const [, setLoading] = useAtom(editorLoadingAtom);
  const [, setAccessDenied] = useAtom(editorAccessDeniedAtom);

  const setCaptionsEnabled = useSetAtom(captionsEnabledAtom);
  const setCaptionsData = useSetAtom(captionsDataAtom);
  const setCaptionColor = useSetAtom(captionColorAtom);
  const setCaptionFont = useSetAtom(captionFontAtom);
  const setHeadingState = useSetAtom(headingStateAtom);

  useEffect(() => {
    if (!selectedTeam?.id || !clipId) return;

    const load = async () => {
      setLoading(true);
      try {
        const data = await clipsAPI.getClip(selectedTeam.id, clipId);

        if (!data.saved || data.team_id !== selectedTeam.id) {
          setAccessDenied(true);
          setLoading(false);
          return;
        }

        setClip(data);

        // Initialise captions data
        if (data.captions_data) {
          setCaptionsData(JSON.parse(JSON.stringify(data.captions_data)));
        }

        // Initialise caption settings from clip metadata
        const metadata = data.clip_metadata as any;
        if (metadata?.parameters?.captionColor) {
          setCaptionColor(metadata.parameters.captionColor);
        }
        if (metadata?.parameters?.captionFont) {
          setCaptionFont(metadata.parameters.captionFont);
        }
        if (metadata?.parameters?.captionsEnabled !== undefined) {
          setCaptionsEnabled(metadata.parameters.captionsEnabled);
        } else {
          setCaptionsEnabled(metadata?.parameters?.captions !== false);
        }

        // Initialise heading state from metadata — always reset to prevent
        // stale heading from previous clip leaking into the new editor session
        if (metadata?.editorConfig?.heading) {
          setHeadingState(metadata.editorConfig.heading);
        } else {
          setHeadingState(null);
        }
      } catch (error) {
        console.error("Failed to load clip:", error);
        setAccessDenied(true);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [selectedTeam?.id, clipId]);
}
