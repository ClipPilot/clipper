import { referralService } from "./referral.service";

export interface CodeValidationResult {
  valid: boolean;
  type: "referral" | null;
  code?: string;
}

class CodeValidationService {
  async validateCode(code: string): Promise<CodeValidationResult> {
    // Check if it's a valid referral code
    const referralCode = await referralService.getCodeByCode(code);
    if (referralCode) {
      return {
        valid: true,
        type: "referral",
        code: referralCode.code,
      };
    }

    return {
      valid: false,
      type: null,
    };
  }
}

export const codeValidationService = new CodeValidationService();
