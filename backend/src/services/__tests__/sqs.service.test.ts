import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockSend } = vi.hoisted(() => ({
  mockSend: vi.fn(),
}));

vi.mock("@aws-sdk/client-sqs", () => ({
  SQSClient: class MockSQS {
    send = mockSend;
  },
  SendMessageCommand: class MockCmd {
    input: any;
    constructor(input: any) {
      this.input = input;
    }
  },
}));

vi.mock("../../config/env", () => ({
  config: { aws: { region: "us-east-1", sqsQueueUrl: "https://sqs.example.com/queue" } },
}));

import { sqsService } from "../sqs.service";

describe("SQSService", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("sendJob", () => {
    it("sends message to SQS and returns MessageId", async () => {
      mockSend.mockResolvedValue({ MessageId: "msg-123" });

      const job = {
        type: "clip-video" as const,
        clipIds: [1],
        teamId: 5,
        userId: 10,
        s3Key: "raw-videos/5/file.mp4",
        options: {},
        createdAt: "2024-01-01",
      };

      const result = await sqsService.sendJob(job);
      expect(result).toBe("msg-123");
      expect(mockSend).toHaveBeenCalledTimes(1);
    });

    it("includes job type and teamId as message attributes", async () => {
      mockSend.mockResolvedValue({ MessageId: "msg-456" });

      await sqsService.sendJob({
        type: "update-captions" as const,
        clipId: 1,
        teamId: 5,
        userId: 10,
        captionsData: [],
        createdAt: "2024-01-01",
      });

      const cmd = mockSend.mock.calls[0][0];
      expect(cmd.input.MessageAttributes.JobType.StringValue).toBe("update-captions");
      expect(cmd.input.MessageAttributes.TeamId.StringValue).toBe("5");
    });
  });

  describe("sendClipVideoJob", () => {
    it("constructs and sends a clip-video job", async () => {
      mockSend.mockResolvedValue({ MessageId: "msg-789" });

      const result = await sqsService.sendClipVideoJob({
        clipIds: [1, 2],
        teamId: 5,
        userId: 10,
        s3Key: "raw-videos/5/file.mp4",
        options: { length: 30, captions: true },
        originalFileName: "video.mp4",
      });

      expect(result).toBe("msg-789");
      const body = JSON.parse(mockSend.mock.calls[0][0].input.MessageBody);
      expect(body.type).toBe("clip-video");
      expect(body.clipIds).toEqual([1, 2]);
      expect(body.options.captions).toBe(true);
    });
  });

  describe("sendGenerateCharacterJob", () => {
    it("constructs and sends a generate-character job", async () => {
      mockSend.mockResolvedValue({ MessageId: "msg-char" });

      await sqsService.sendGenerateCharacterJob({
        jobId: "job-1",
        teamId: 5,
        userId: 10,
        config: {
          gender: "female",
          ageRange: "25-35",
          appearance: { hairColor: "brown", hairStyle: "long", skinTone: "medium", eyeColor: "blue", bodyType: "average" },
          style: { outfit: "casual", setting: "studio" },
        },
      });

      const body = JSON.parse(mockSend.mock.calls[0][0].input.MessageBody);
      expect(body.type).toBe("generate-character");
      expect(body.jobId).toBe("job-1");
    });
  });

  describe("sendAdCloneAnalyzeJob", () => {
    it("constructs and sends an ad-clone-analyze job", async () => {
      mockSend.mockResolvedValue({ MessageId: "msg-ad" });

      await sqsService.sendAdCloneAnalyzeJob({
        projectId: "proj-1",
        teamId: 5,
        userId: 10,
      });

      const body = JSON.parse(mockSend.mock.calls[0][0].input.MessageBody);
      expect(body.type).toBe("ad-clone-analyze");
      expect(body.projectId).toBe("proj-1");
    });
  });
});
