"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useAtom } from "jotai";
import { preferencesAPI } from "@/api/preferences";
import {
  dashboardLayoutAtom,
  widgetColorsAtom,
  preferencesLoadedAtom,
  DEFAULT_LAYOUT,
  WidgetConfig,
} from "@/store/dashboard";

export function useDashboardPreferences() {
  const [layout, setLayout] = useAtom(dashboardLayoutAtom);
  const [colors, setColors] = useAtom(widgetColorsAtom);
  const [loaded, setLoaded] = useAtom(preferencesLoadedAtom);
  const [isLoading, setIsLoading] = useState(!loaded);
  const [error, setError] = useState<string | null>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isFetchingRef = useRef(false);

  const fetchPreferences = useCallback(async () => {
    if (isFetchingRef.current || loaded) return;

    if (typeof window !== "undefined") {
      const token = localStorage.getItem("access_token");
      if (!token) {
        setIsLoading(false);
        setLoaded(true);
        return;
      }
    }

    isFetchingRef.current = true;

    try {
      setError(null);
      const prefs = await preferencesAPI.getPreferences();
      if (prefs.dashboardLayout) {
        setLayout(prefs.dashboardLayout);
      }
      if (prefs.widgetColors) {
        setColors(prefs.widgetColors);
      }
      setLoaded(true);
      setIsLoading(false);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Failed to fetch preferences";
      setError(errorMessage);
      setIsLoading(false);
      setLoaded(true);
    } finally {
      isFetchingRef.current = false;
    }
  }, [loaded, setLayout, setColors, setLoaded]);

  useEffect(() => {
    fetchPreferences();
  }, [fetchPreferences]);

  const savePreferences = useCallback(
    async (newLayout?: WidgetConfig[], newColors?: Record<string, string>) => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      saveTimeoutRef.current = setTimeout(async () => {
        try {
          await preferencesAPI.updatePreferences({
            dashboardLayout: newLayout,
            widgetColors: newColors,
          });
        } catch (err) {
          console.error("Failed to save preferences:", err);
        }
      }, 500);
    },
    []
  );

  const updateLayout = useCallback(
    (newLayout: WidgetConfig[]) => {
      setLayout(newLayout);
      savePreferences(newLayout, undefined);
    },
    [setLayout, savePreferences]
  );

  const updateWidgetColor = useCallback(
    (widgetId: string, color: string) => {
      const newColors = { ...colors, [widgetId]: color };
      setColors(newColors);
      savePreferences(undefined, newColors);
    },
    [colors, setColors, savePreferences]
  );

  const resetToDefault = useCallback(async () => {
    try {
      await preferencesAPI.resetPreferences();
      setLayout(DEFAULT_LAYOUT);
      setColors({});
    } catch (err) {
      console.error("Failed to reset preferences:", err);
    }
  }, [setLayout, setColors]);

  return {
    layout,
    colors,
    isLoading,
    error,
    updateLayout,
    updateWidgetColor,
    resetToDefault,
  };
}
