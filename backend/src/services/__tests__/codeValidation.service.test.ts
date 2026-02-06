import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockGetCodeByCode } = vi.hoisted(() => ({
  mockGetCodeByCode: vi.fn(),
}));

vi.mock("../referral.service", () => ({
  referralService: { getCodeByCode: mockGetCodeByCode },
}));

import { codeValidationService } from "../codeValidation.service";

describe("codeValidationService.validateCode", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns valid=true with type=referral for a known referral code", async () => {
    mockGetCodeByCode.mockResolvedValue({ code: "FRIEND10", discount: 10 });

    const result = await codeValidationService.validateCode("FRIEND10");

    expect(mockGetCodeByCode).toHaveBeenCalledWith("FRIEND10");
    expect(result).toEqual({
      valid: true,
      type: "referral",
      code: "FRIEND10",
    });
  });

  it("returns valid=false with type=null for unknown code", async () => {
    mockGetCodeByCode.mockResolvedValue(null);

    const result = await codeValidationService.validateCode("INVALID");

    expect(result).toEqual({
      valid: false,
      type: null,
    });
  });

  it("returns valid=false when referral service returns undefined", async () => {
    mockGetCodeByCode.mockResolvedValue(undefined);

    const result = await codeValidationService.validateCode("NOPE");

    expect(result).toEqual({
      valid: false,
      type: null,
    });
  });

  it("preserves the code string from the referral record", async () => {
    // Code in DB may be normalized differently
    mockGetCodeByCode.mockResolvedValue({ code: "WELCOME2024", discount: 20 });

    const result = await codeValidationService.validateCode("welcome2024");

    expect(result.code).toBe("WELCOME2024");
  });
});
