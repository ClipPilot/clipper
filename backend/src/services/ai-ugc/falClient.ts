import { fal } from "@fal-ai/client";
import { config } from "../../config/env";

/**
 * Configures the fal client once with the API key from environment config
 * and re-exports it for use across all ai-ugc services.
 *
 * Import `fal` from this module instead of calling fal.config() in each file.
 */
fal.config({
  credentials: config.fal.apiKey,
});

export { fal };
