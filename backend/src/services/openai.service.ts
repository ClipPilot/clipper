import OpenAI from "openai";
import { ENV } from "../config/env";

export const openaiClient = new OpenAI({
  apiKey: ENV.OPENAI_API_KEY,
  timeout: 5 * 60 * 1000,
  maxRetries: 3,
});
