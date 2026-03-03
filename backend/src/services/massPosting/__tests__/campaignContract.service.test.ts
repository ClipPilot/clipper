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
  const mockDrawText = vi.fn();
  const mockDrawImage = vi.fn();
  const mockGetSize = vi.fn().mockReturnValue({ width: 612, height: 792 });
  const mockDrawLine = vi.fn();
  const mockDrawRectangle = vi.fn();

  const makeMockPage = () => ({
    getSize: mockGetSize,
    drawText: mockDrawText,
    drawImage: mockDrawImage,
    drawLine: mockDrawLine,
    drawRectangle: mockDrawRectangle,
  });

  const mockSave = vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3]));
  const mockEmbedPng = vi.fn().mockResolvedValue({
    scale: vi.fn().mockReturnValue({ width: 100, height: 40 }),
    width: 200,
    height: 80,
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
    getPageCount: vi.fn().mockReturnValue(1),
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
// Module mocks
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
    TimesRoman: "Times-Roman",
    TimesRomanBold: "Times-Roman-Bold",
    TimesRomanBoldItalic: "Times-Roman-BoldItalic",
  },
}));

import { campaignContractService } from "../campaignContract.service";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const makeMasterContract = (overrides: Record<string, unknown> = {}) => ({
  id: 20,
  campaign_id: null,
  team_id: 5,
  is_master: true,
  terms: { _clientSignatureY: 200 },
  unsigned_pdf_key: "contracts/5/master/unsigned_123.pdf",
  signed_pdf_key: null,
  signature_image_key: null,
  status: "pending",
  signed_by_user_id: null,
  signer_legal_name: null,
  signer_legal_entity_name: null,
  signer_title: null,
  signer_email: null,
  signer_ip_address: null,
  effective_date: new Date(),
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
// getOrGenerateMasterAgreement
// ---------------------------------------------------------------------------

describe("CampaignContractService.getOrGenerateMasterAgreement", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns existing master agreement when found", async () => {
    const contract = makeMasterContract();
    mockDb.select.mockReturnValue(createDrizzleChain([contract]));
    mockGetPresignedUrl.mockResolvedValue("https://s3.example.com/unsigned.pdf");

    const result = await campaignContractService.getOrGenerateMasterAgreement(5);

    expect(result).toMatchObject({
      id: 20,
      team_id: 5,
      status: "pending",
      presigned_pdf_url: "https://s3.example.com/unsigned.pdf",
    });
    expect(mockPdfDocCreate).not.toHaveBeenCalled();
    expect(mockDb.insert).not.toHaveBeenCalled();
  });

  it("generates a new master agreement when none exists", async () => {
    const newContract = makeMasterContract();
    mockDb.select.mockReturnValue(createDrizzleChain([]));
    mockDb.insert.mockReturnValue(createDrizzleChain([newContract]));
    mockGetPresignedUrl.mockResolvedValue("https://s3.example.com/unsigned.pdf");

    const result = await campaignContractService.getOrGenerateMasterAgreement(5);

    expect(mockPdfDocCreate).toHaveBeenCalledTimes(1);
    expect(mockUploadBuffer).toHaveBeenCalledWith(
      expect.any(Buffer),
      expect.stringContaining("contracts/5/master/unsigned_"),
      "application/pdf",
    );
    expect(mockDb.insert).toHaveBeenCalledTimes(1);
    expect(result.team_id).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// signMasterAgreement
// ---------------------------------------------------------------------------

describe("CampaignContractService.signMasterAgreement", () => {
  beforeEach(() => vi.clearAllMocks());

  const signData = {
    legalEntityName: "Acme LLC",
    signerName: "John Doe",
    signerTitle: "CEO",
    signerEmail: "john@acme.com",
    signatureDataUrl: "data:image/png;base64,abc123",
  };

  it("stamps signature, uploads signed PDF, updates contract, and sends emails", async () => {
    const contract = makeMasterContract();
    const updatedContract = makeMasterContract({
      status: "signed",
      signed_by_user_id: 7,
      signer_legal_name: "John Doe",
      signer_legal_entity_name: "Acme LLC",
    });
    const team = { id: 5, name: "Acme Inc" };
    const owner = makeOwner();

    // Call order: getSignedOrPendingMaster, then update contract, update campaigns,
    // then email queries (team, owner)
    mockDb.select
      .mockReturnValueOnce(createDrizzleChain([contract]))     // getSignedOrPendingMaster
      .mockReturnValueOnce(createDrizzleChain([team]))         // email: team
      .mockReturnValueOnce(createDrizzleChain([owner]));       // email: owner

    mockDb.update.mockReturnValue(createDrizzleChain([updatedContract]));
    mockGetPresignedUrl.mockResolvedValue("https://s3.example.com/signed.pdf");

    const result = await campaignContractService.signMasterAgreement(
      5, 7, signData, "127.0.0.1",
    );

    // Signature uploaded
    expect(mockUploadBuffer).toHaveBeenCalledWith(
      expect.any(Buffer),
      expect.stringContaining("signature_"),
      "image/png",
    );

    // PDF stamped and uploaded
    expect(mockPdfDocLoad).toHaveBeenCalledTimes(1);
    expect(mockUploadBuffer).toHaveBeenCalledWith(
      expect.any(Buffer),
      expect.stringContaining("signed_"),
      "application/pdf",
    );

    // Emails sent
    expect(mockSendEmailNotification).toHaveBeenCalledTimes(2);
    expect(mockSendEmailNotification).toHaveBeenCalledWith(
      "owner@acme.com",
      expect.stringContaining("Master Agreement Signed"),
      expect.stringContaining("John Doe"),
    );

    expect(result.status).toBe("signed");
  });

  it("throws when no master agreement found", async () => {
    mockDb.select.mockReturnValue(createDrizzleChain([]));

    await expect(
      campaignContractService.signMasterAgreement(5, 1, signData, "127.0.0.1"),
    ).rejects.toThrow("No master agreement found");
  });

  it("throws when agreement is already signed", async () => {
    const contract = makeMasterContract({ status: "signed" });
    mockDb.select.mockReturnValue(createDrizzleChain([contract]));

    await expect(
      campaignContractService.signMasterAgreement(5, 1, signData, "127.0.0.1"),
    ).rejects.toThrow("Agreement already signed");
  });
});

// ---------------------------------------------------------------------------
// hasSignedMasterAgreement
// ---------------------------------------------------------------------------

describe("CampaignContractService.hasSignedMasterAgreement", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns true when a signed master agreement exists", async () => {
    mockDb.select.mockReturnValue(createDrizzleChain([{ id: 20 }]));

    const result = await campaignContractService.hasSignedMasterAgreement(5);

    expect(result).toBe(true);
  });

  it("returns false when no signed master agreement exists", async () => {
    mockDb.select.mockReturnValue(createDrizzleChain([]));

    const result = await campaignContractService.hasSignedMasterAgreement(5);

    expect(result).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// checkContractGate
// ---------------------------------------------------------------------------

describe("CampaignContractService.checkContractGate", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns true and marks contract_ready when master agreement is signed", async () => {
    // hasSignedMasterAgreement query returns a signed master
    mockDb.select.mockReturnValue(createDrizzleChain([{ id: 20 }]));
    mockDb.update.mockReturnValue(createDrizzleChain([]));

    const result = await campaignContractService.checkContractGate(5, 10);

    expect(result).toBe(true);
    expect(mockDb.update).toHaveBeenCalledTimes(1);
  });

  it("returns false when no signed master agreement exists", async () => {
    mockDb.select.mockReturnValue(createDrizzleChain([]));
    mockDb.update.mockReturnValue(createDrizzleChain([]));

    const result = await campaignContractService.checkContractGate(5, 10);

    expect(result).toBe(false);
    expect(mockDb.update).toHaveBeenCalledTimes(1);
  });
});
