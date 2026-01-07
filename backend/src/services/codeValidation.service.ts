import { referralService } from "./referral.service";
import { affiliateService } from "./affiliate.service";

export interface CodeValidationResult {
  valid: boolean;
  type: "affiliate" | "referral" | null;
  code?: string;
}

class CodeValidationService {
  async validateCode(code: string): Promise<CodeValidationResult> {
    const upperCode = code.toUpperCase().trim();

    if (upperCode.startsWith("AFF-")) {
      const result = await affiliateService.validateCode(upperCode);
      if (result.valid) {
        return { valid: true, type: "affiliate", code: result.code };
      }
    }

    if (upperCode.startsWith("CUTTR-")) {
      const referralCode = await referralService.getCodeByCode(upperCode);
      if (referralCode) {
        return { valid: true, type: "referral", code: referralCode.code };
      }
    }

    const affiliateResult = await affiliateService.validateCode(upperCode);
    if (affiliateResult.valid) {
      return { valid: true, type: "affiliate", code: affiliateResult.code };
    }

    const referralCode = await referralService.getCodeByCode(upperCode);
    if (referralCode) {
      return { valid: true, type: "referral", code: referralCode.code };
    }

    return { valid: false, type: null };
  }
}

export const codeValidationService = new CodeValidationService();
