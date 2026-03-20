import { z } from "zod";
import { scriptAgentSceneSchema } from "./scriptAgent.js";
import { videoTypeEnum } from "./initAgent.js";

export const adDeconstructorSchema = z.object({
  responseType: z.enum(["conversation", "script"]),
  message: z.string(),
  videoType: videoTypeEnum,
  isSilent: z.boolean(),
  character: z.boolean(),
  targetAudience: z.string(),
  title: z.string(),
  totalDuration: z.number(),
  scenes: z.array(scriptAgentSceneSchema),
  videoAnalysis: z.any().nullable().optional(),
});
