import { describe, it, expect, vi, beforeEach } from "vitest";
import { createDrizzleChain } from "../../../../test/helpers/db.helper";

// ---------------------------------------------------------------------------
// Hoist all mock factories so vi.mock() closures can reference them
// ---------------------------------------------------------------------------

const {
  mockDb,
  mockUploadBuffer,
  mockGetPresignedUrl,
  mockGetImageAsBuffer,
  mockSendEmailNotification,
  mockPdfSave,
  mockEmbedPng,
  mockDrawImage,
  mockDrawText,
  mockEmbedFont,
  mockGetPages,
  mockAddPage,
  mockPdfDocCreate,
  mockPdfDocLoad,
} = vi.hoisted(() => {
  // Shared page mock — reused by both create() and load()
  const mockDrawText = vi.fn();
  const mockDrawImage = vi.fn();
  const mockGetSize = vi.fn().mockReturnValue({ width: 612, height: 792 });

  const makeMockPage = () => ({
    getSize: mockGetSize,
    drawText: mockDrawText,
    drawImage: mockDrawImage,
  });

  const mockSave = vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3]));
  const mockEmbedPng = vi.fn().mockResolvedValue({
    scale: vi.fn().mockReturnValue({ width: 100, height: 40 }),
  });
  const mockEmbedFont = vi.fn().mockResolvedValue({
    widthOfTextAtSize: vi.fn().mockReturnValue(50),
  });
  const mockGetPages = vi.fn().mockReturnValue([makeMockPage()]);
  const mockAddPage = vi.fn().mockReturnValue(makeMockPage());

  const mockPdfDocCreate = vi.fn().mockResolvedValue({
    embedFont: mockEmbedFont,
    addPage: mockAddPage,
    embedPng: mockEmbedPng,
    save: mockSave,
  });

  const mockPdfDocLoad = vi.fn().mockResolvedValue({
    getPages: mockGetPages,
    embedFont: mockEmbedFont,
    embedPng: mockEmbedPng,
    save: mockSave,
  });

  return {
    mockDb: {
      select: vi.fn(),
      insert: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    mockUploadBuffer: vi.fn().mockResolvedValue(undefined),
    mockGetPresignedUrl: vi.fn().mockResolvedValue("https://s3.example.com/file.pdf"),
    mockGetImageAsBuffer: vi.fn().mockResolvedValue(Buffer.from("pdf-bytes")),
    mockSendEmailNotification: vi.fn().mockResolvedValue(undefined),
    mockPdfSave: mockSave,
    mockEmbedPng,
    mockDrawImage,
    mockDrawText,
    mockEmbedFont,
    mockGetPages,
    mockAddPage,
    mockPdfDocCreate,
    mockPdfDocLoad,
  };
});

// ---------------------------------------------------------------------------
// Module mocks — must appear before any import of the tested module
// ---------------------------------------------------------------------------

vi.mock("../../../db", () => ({ db: mockDb }));

vi.mock("../../s3.service", () => ({
  s3Service: {
    uploadBuffer: mockUploadBuffer,
    getPresignedUrl: mockGetPresignedUrl,
    getImageAsBuffer: mockGetImageAsBuffer,
  },
}));

vi.mock("../../emailNoti.service", () => ({
  emailNotiService: {
    sendEmailNotification: mockSendEmailNotification,
  },
}));

vi.mock("pdf-lib", () => ({
  PDFDocument: {
    create: mockPdfDocCreate,
    load: mockPdfDocLoad,
  },
  rgb: vi.fn().mockReturnValue({ r: 0.1, g: 0.1, b: 0.1 }),
  StandardFonts: {
    Helvetica: "Helvetica",
    HelveticaBold: "Helvetica-Bold",
  },
}));

import { campaignContractService } from "../campaignContract.service";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const makeCampaign = (overrides: Record<string, unknown> = {}) => ({
  id: 10,
  team_id: 5,
  name: "Test Campaign",
  quoted_cpm: "5.00",
  budget: "1000",
  video_minimum: 10,
  payment_ready: false,
  contract_ready: false,
  created_at: new Date(),
  updated_at: new Date(),
  ...overrides,
});

const makeTeam = (overrides: Record<string, unknown> = {}) => ({
  id: 5,
  name: "Acme Inc",
  type: "business",
  created_at: new Date(),
  updated_at: new Date(),
  ...overrides,
});

const makeContract = (overrides: Record<string, unknown> = {}) => ({
  id: 20,
  campaign_id: 10,
  team_id: 5,
  terms: {},
  unsigned_pdf_key: "contracts/5/10/unsigned_123.pdf",
  signed_pdf_key: null,
  signature_image_key: null,
  status: "pending",
  signed_by_user_id: null,
  signer_legal_name: null,
  signer_ip_address: null,
  signed_at: null,
  created_at: new Date(),
  updated_at: new Date(),
  ...overrides,
});

const makeOwner = (overrides: Record<string, unknown> = {}) => ({
  email: "owner@acme.com",
  firstName: "Alice",
  ...overrides,
});

// ---------------------------------------------------------------------------
// generateContract
// ---------------------------------------------------------------------------

describe("CampaignContractService.generateContract", () => {
  beforeEach(() => vi.clearAllMocks());

  it("generates PDF, uploads to S3, and inserts a new contract row", async () => {
    const campaign = makeCampaign();
    const team = makeTeam();
    const contract = makeContract();

    // select campaign, select team, select existing contract (none), insert contract
    mockDb.select
      .mockReturnValueOnce(createDrizzleChain([campaign])) // campaign lookup
      .mockReturnValueOnce(createDrizzleChain([team]))     // team lookup
      .mockReturnValueOnce(createDrizzleChain([]));        // existing contract check
    mockDb.insert.mockReturnValue(createDrizzleChain([contract]));

    const result = await campaignContractService.generateContract(10);

    expect(mockPdfDocCreate).toHaveBeenCalledTimes(1);
    expect(mockUploadBuffer).toHaveBeenCalledTimes(1);
    expect(mockUploadBuffer).toHaveBeenCalledWith(
      expect.any(Buffer),
      expect.stringContaining("contracts/5/10/unsigned_"),
      "application/pdf",
    );
    expect(mockDb.insert).toHaveBeenCalledTimes(1);
    expect(result).toEqual(contract);
  });

  it("throws when campaign is not found", async () => {
    mockDb.select.mockReturnValue(createDrizzleChain([]));

    await expect(campaignContractService.generateContract(999)).rejects.toThrow(
      "Campaign not found",
    );

    expect(mockPdfDocCreate).not.toHaveBeenCalled();
    expect(mockUploadBuffer).not.toHaveBeenCalled();
  });

  it("throws when team is not found", async () => {
    const campaign = makeCampaign();
    mockDb.select
      .mockReturnValueOnce(createDrizzleChain([campaign]))
      .mockReturnValueOnce(createDrizzleChain([])); // team missing

    await expect(campaignContractService.generateContract(10)).rejects.toThrow(
      "Team not found",
    );
  });

  it("updates an existing contract row instead of inserting", async () => {
    const campaign = makeCampaign();
    const team = makeTeam();
    const existing = makeContract({ id: 99 });
    const updated = makeContract({ id: 99, unsigned_pdf_key: "contracts/5/10/unsigned_999.pdf" });

    mockDb.select
      .mockReturnValueOnce(createDrizzleChain([campaign]))
      .mockReturnValueOnce(createDrizzleChain([team]))
      .mockReturnValueOnce(createDrizzleChain([existing])); // existing contract found
    mockDb.update.mockReturnValue(createDrizzleChain([updated]));

    const result = await campaignContractService.generateContract(10);

    expect(mockDb.insert).not.toHaveBeenCalled();
    expect(mockDb.update).toHaveBeenCalledTimes(1);
    expect(result).toEqual(updated);
  });
});

// ---------------------------------------------------------------------------
// getContract
// ---------------------------------------------------------------------------

describe("CampaignContractService.getContract", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns contract with presigned URL when found", async () => {
    const contract = makeContract();
    mockDb.select.mockReturnValue(createDrizzleChain([contract]));
    mockGetPresignedUrl.mockResolvedValue("https://s3.example.com/unsigned.pdf");

    const result = await campaignContractService.getContract(10);

    expect(result).toMatchObject({
      ...contract,
      pdfUrl: "https://s3.example.com/unsigned.pdf",
    });
    expect(mockGetPresignedUrl).toHaveBeenCalledWith(contract.unsigned_pdf_key);
  });

  it("returns null when no contract exists", async () => {
    mockDb.select.mockReturnValue(createDrizzleChain([]));

    const result = await campaignContractService.getContract(99);

    expect(result).toBeNull();
    expect(mockGetPresignedUrl).not.toHaveBeenCalled();
  });

  it("uses signed_pdf_key for the presigned URL when contract is signed", async () => {
    const contract = makeContract({
      status: "signed",
      signed_pdf_key: "contracts/5/10/signed_abc.pdf",
    });
    mockDb.select.mockReturnValue(createDrizzleChain([contract]));
    mockGetPresignedUrl.mockResolvedValue("https://s3.example.com/signed.pdf");

    const result = await campaignContractService.getContract(10);

    expect(mockGetPresignedUrl).toHaveBeenCalledWith("contracts/5/10/signed_abc.pdf");
    expect(result?.pdfUrl).toBe("https://s3.example.com/signed.pdf");
  });

  it("returns contract with pdfUrl null when S3 presign throws", async () => {
    const contract = makeContract();
    mockDb.select.mockReturnValue(createDrizzleChain([contract]));
    mockGetPresignedUrl.mockRejectedValue(new Error("S3 error"));

    const result = await campaignContractService.getContract(10);

    expect(result).toMatchObject({ ...contract, pdfUrl: null });
  });
});

// ---------------------------------------------------------------------------
// signContract
// ---------------------------------------------------------------------------

describe("CampaignContractService.signContract", () => {
  beforeEach(() => vi.clearAllMocks());

  it("stamps signature, uploads signed PDF, updates contract, triggers gate and email", async () => {
    const contract = makeContract();
    const updatedContract = makeContract({
      status: "signed",
      signed_by_user_id: 7,
      signer_legal_name: "John Doe",
      signed_pdf_key: "contracts/5/10/signed_ts.pdf",
    });
    const campaign = makeCampaign();
    const team = makeTeam();
    const owner = makeOwner();
    const signedStatus = makeContract({ status: "signed" });

    // signContract call order:
    //   1. select: fetch contract by id
    //   2. upload: signature image
    //   3. getImageAsBuffer: fetch unsigned PDF
    //   4. PDFDocument.load, getPages, embedPng, drawImage, drawText×2, embedFont
    //   5. upload: signed PDF
    //   6. update: contract row
    //   7. select: checkContractGate -> contract status
    //   8. update: campaigns.contract_ready
    //   9. select: campaign (for email)
    //  10. select: team (for email)
    //  11. select (innerJoin): team owner email
    //  12. sendEmailNotification × 2
    mockDb.select
      .mockReturnValueOnce(createDrizzleChain([contract]))      // fetch contract
      .mockReturnValueOnce(createDrizzleChain([signedStatus]))  // checkContractGate
      .mockReturnValueOnce(createDrizzleChain([campaign]))      // email: campaign
      .mockReturnValueOnce(createDrizzleChain([team]))          // email: team
      .mockReturnValueOnce(createDrizzleChain([owner]));        // email: owner

    mockDb.update.mockReturnValue(createDrizzleChain([updatedContract]));

    const result = await campaignContractService.signContract(
      20,
      7,
      "John Doe",
      "data:image/png;base64,abc123",
      "127.0.0.1",
    );

    // Signature image uploaded
    expect(mockUploadBuffer).toHaveBeenCalledWith(
      expect.any(Buffer),
      expect.stringContaining("signature_"),
      "image/png",
    );

    // PDF stamped and uploaded
    expect(mockPdfDocLoad).toHaveBeenCalledTimes(1);
    expect(mockGetImageAsBuffer).toHaveBeenCalledWith(contract.unsigned_pdf_key);
    expect(mockUploadBuffer).toHaveBeenCalledWith(
      expect.any(Buffer),
      expect.stringContaining("signed_"),
      "application/pdf",
    );

    // Contract row updated
    expect(mockDb.update).toHaveBeenCalledTimes(2); // contract + campaign gate

    // Email sent to both owner and contact@cuttr.com
    expect(mockSendEmailNotification).toHaveBeenCalledTimes(2);
    expect(mockSendEmailNotification).toHaveBeenCalledWith(
      "owner@acme.com",
      expect.stringContaining("Contract Signed"),
      expect.stringContaining("John Doe"),
    );
    expect(mockSendEmailNotification).toHaveBeenCalledWith(
      "contact@cuttr.com",
      expect.stringContaining("Contract Signed"),
      expect.stringContaining("John Doe"),
    );

    expect(result).toEqual(updatedContract);
  });

  it("throws when contract is not found", async () => {
    mockDb.select.mockReturnValue(createDrizzleChain([]));

    await expect(
      campaignContractService.signContract(999, 1, "Name", "data:image/png;base64,x", "127.0.0.1"),
    ).rejects.toThrow("Contract not found");

    expect(mockUploadBuffer).not.toHaveBeenCalled();
  });

  it("throws when contract is already signed", async () => {
    const contract = makeContract({ status: "signed" });
    mockDb.select.mockReturnValue(createDrizzleChain([contract]));

    await expect(
      campaignContractService.signContract(20, 1, "Name", "data:image/png;base64,x", "127.0.0.1"),
    ).rejects.toThrow("Contract already signed");

    expect(mockUploadBuffer).not.toHaveBeenCalled();
  });

  it("still updates contract row even if PDF stamping fails", async () => {
    const contract = makeContract();
    const updatedContract = makeContract({
      status: "signed",
      signed_pdf_key: null, // stamping failed so no signed PDF key
    });
    const campaign = makeCampaign();
    const team = makeTeam();
    const owner = makeOwner();
    const signedStatus = makeContract({ status: "signed" });

    // Make getImageAsBuffer throw to simulate PDF stamp failure
    mockGetImageAsBuffer.mockRejectedValueOnce(new Error("S3 read error"));

    mockDb.select
      .mockReturnValueOnce(createDrizzleChain([contract]))
      .mockReturnValueOnce(createDrizzleChain([signedStatus]))
      .mockReturnValueOnce(createDrizzleChain([campaign]))
      .mockReturnValueOnce(createDrizzleChain([team]))
      .mockReturnValueOnce(createDrizzleChain([owner]));

    mockDb.update.mockReturnValue(createDrizzleChain([updatedContract]));

    const result = await campaignContractService.signContract(
      20,
      7,
      "John Doe",
      "data:image/png;base64,abc123",
      "127.0.0.1",
    );

    // Contract update must still have been called despite PDF stamping error
    expect(mockDb.update).toHaveBeenCalledTimes(2);
    expect(result).toEqual(updatedContract);
  });
});

// ---------------------------------------------------------------------------
// checkContractGate
// ---------------------------------------------------------------------------

describe("CampaignContractService.checkContractGate", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns true and marks contract_ready when contract is signed", async () => {
    const contract = makeContract({ status: "signed" });
    mockDb.select.mockReturnValue(createDrizzleChain([contract]));
    mockDb.update.mockReturnValue(createDrizzleChain([]));

    const result = await campaignContractService.checkContractGate(10);

    expect(result).toBe(true);
    expect(mockDb.update).toHaveBeenCalledTimes(1);
  });

  it("returns false when contract exists but is not signed", async () => {
    const contract = makeContract({ status: "pending" });
    mockDb.select.mockReturnValue(createDrizzleChain([contract]));
    mockDb.update.mockReturnValue(createDrizzleChain([]));

    const result = await campaignContractService.checkContractGate(10);

    expect(result).toBe(false);
    expect(mockDb.update).toHaveBeenCalledTimes(1);
  });

  it("returns false when no contract exists for the campaign", async () => {
    mockDb.select.mockReturnValue(createDrizzleChain([]));
    mockDb.update.mockReturnValue(createDrizzleChain([]));

    const result = await campaignContractService.checkContractGate(99);

    expect(result).toBe(false);
    expect(mockDb.update).toHaveBeenCalledTimes(1);
  });
});
