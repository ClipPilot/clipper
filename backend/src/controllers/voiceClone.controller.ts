import { Response } from "express";
import * as Sentry from "@sentry/node";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { clonedVoices } from "@clipper/shared-db/src/schema";
import { AuthRequest } from "../middleware/auth.middleware";
import { elevenLabsService } from "../services/ai-ugc/elevenlabs.service";
import { s3Service } from "../services/s3.service";

class VoiceCloneController {
  async cloneVoice(req: AuthRequest, res: Response) {
    try {
      const { teamId, name, gender } = req.body;
      const audioFile = req.file;

      if (!teamId || !name || !gender || !audioFile) {
        return res.status(400).json({
          error: "Missing required fields: teamId, name, gender, and audio file",
        });
      }

      if (!["male", "female", "other"].includes(gender)) {
        return res.status(400).json({ error: "Invalid gender. Must be male, female, or other" });
      }

      const parsedTeamId = parseInt(teamId);
      if (isNaN(parsedTeamId)) {
        return res.status(400).json({ error: "Invalid team ID" });
      }

      // Clone voice via ElevenLabs
      const { voiceId } = await elevenLabsService.cloneVoice(name, audioFile.buffer);

      // Generate preview audio with the cloned voice
      const previewBuffer = await elevenLabsService.generateClonePreview(voiceId);

      // Upload preview to S3
      const sampleAudioKey = await s3Service.uploadVoiceSample(
        previewBuffer,
        parsedTeamId,
        voiceId,
      );

      // Save to database
      const [voice] = await db
        .insert(clonedVoices)
        .values({
          team_id: parsedTeamId,
          name,
          voice_id: voiceId,
          sample_audio_key: sampleAudioKey,
          gender,
        })
        .returning();

      // Generate presigned URL for the preview
      const previewUrl = await s3Service.getPresignedUrl(sampleAudioKey);

      return res.status(201).json({
        success: true,
        voice: {
          id: voice.id,
          name: voice.name,
          voiceId: voice.voice_id,
          previewUrl,
          gender: voice.gender,
        },
      });
    } catch (error) {
      console.error("[VoiceClone] Clone failed:", error);
      Sentry.captureException(error);
      return res.status(500).json({ error: "Failed to clone voice" });
    }
  }

  async listClonedVoices(req: AuthRequest, res: Response) {
    try {
      const teamId = parseInt(req.query.teamId as string);
      if (isNaN(teamId)) {
        return res.status(400).json({ error: "Invalid team ID" });
      }

      const voices = await db
        .select()
        .from(clonedVoices)
        .where(eq(clonedVoices.team_id, teamId));

      // Generate presigned URLs for all voice samples
      const voicesWithUrls = await Promise.all(
        voices.map(async (voice) => ({
          id: voice.id,
          name: voice.name,
          voiceId: voice.voice_id,
          previewUrl: await s3Service.getPresignedUrl(voice.sample_audio_key),
          gender: voice.gender,
          createdAt: voice.created_at,
        })),
      );

      return res.json({ success: true, voices: voicesWithUrls });
    } catch (error) {
      console.error("[VoiceClone] List failed:", error);
      Sentry.captureException(error);
      return res.status(500).json({ error: "Failed to list cloned voices" });
    }
  }

  async deleteClonedVoice(req: AuthRequest, res: Response) {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid voice ID" });
      }

      // Fetch the voice record first
      const [voice] = await db
        .select()
        .from(clonedVoices)
        .where(eq(clonedVoices.id, id));

      if (!voice) {
        return res.status(404).json({ error: "Cloned voice not found" });
      }

      // Delete from ElevenLabs, S3, and DB in parallel
      await Promise.allSettled([
        elevenLabsService.deleteClonedVoice(voice.voice_id),
        s3Service.deleteObject(voice.sample_audio_key),
        db.delete(clonedVoices).where(eq(clonedVoices.id, id)),
      ]);

      return res.json({ success: true });
    } catch (error) {
      console.error("[VoiceClone] Delete failed:", error);
      Sentry.captureException(error);
      return res.status(500).json({ error: "Failed to delete cloned voice" });
    }
  }
}

export const voiceCloneController = new VoiceCloneController();
