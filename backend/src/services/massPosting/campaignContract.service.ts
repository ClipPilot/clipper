import {
  campaigns,
  campaignContracts,
  teams,
  users,
  teamMembers,
} from "@clipper/shared-db";
import { db } from "../../db";
import { eq, and } from "drizzle-orm";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { readFileSync } from "fs";
import { join } from "path";
import { s3Service } from "../s3.service";
import { emailNotiService } from "../emailNoti.service";

export interface ContractClauses {
  parties?: string;
  providerObligations?: string;
  clientObligations?: string;
  paymentTerms?: string;
  additionalClauses?: string[];
}

const DEFAULT_CLAUSES: Required<Omit<ContractClauses, "additionalClauses">> & {
  additionalClauses: string[];
} = {
  parties:
    'This Agreement is entered into between Cuttr Inc. ("Provider") and {{TEAM_NAME}} ("Client") for the campaign "{{CAMPAIGN_NAME}}".',
  providerObligations:
    "Provider agrees to distribute Client's video content across its network of social media accounts to achieve the guaranteed view count specified above.",
  clientObligations:
    "Client agrees to provide the minimum number of videos as specified above, deposit the agreed campaign budget, and ensure all content complies with platform guidelines.",
  paymentTerms:
    "Campaign budget must be deposited in full before the campaign can start. Funds will be drawn from the campaign wallet as posts are distributed.",
  additionalClauses: [],
};

class CampaignContractService {
  private buildPdf(
    campaign: { name: string; quoted_cpm: string | null; budget: string | null; video_minimum: number | null },
    teamName: string,
    clauses: ContractClauses,
  ) {
    const merged = {
      parties: (clauses.parties || DEFAULT_CLAUSES.parties)
        .replace(/\{\{TEAM_NAME\}\}/g, teamName)
        .replace(/\{\{CAMPAIGN_NAME\}\}/g, campaign.name),
      providerObligations: clauses.providerObligations || DEFAULT_CLAUSES.providerObligations,
      clientObligations: clauses.clientObligations || DEFAULT_CLAUSES.clientObligations,
      paymentTerms: clauses.paymentTerms || DEFAULT_CLAUSES.paymentTerms,
      additionalClauses: clauses.additionalClauses || DEFAULT_CLAUSES.additionalClauses,
    };
    return { merged, campaign, teamName };
  }

  async generateContract(campaignId: number, customClauses?: ContractClauses) {
    const [campaign] = await db
      .select()
      .from(campaigns)
      .where(eq(campaigns.id, campaignId))
      .limit(1);

    if (!campaign) throw new Error("Campaign not found");

    const [team] = await db
      .select()
      .from(teams)
      .where(eq(teams.id, campaign.team_id))
      .limit(1);

    if (!team) throw new Error("Team not found");

    const clauses = customClauses || {};

    // Build contract terms (stored in DB)
    const terms = {
      cpmRate: campaign.quoted_cpm,
      budget: campaign.budget,
      videoMinimum: campaign.video_minimum,
      teamName: team.name,
      campaignName: campaign.name,
      date: new Date().toISOString(),
      clauses: {
        parties: clauses.parties || DEFAULT_CLAUSES.parties,
        providerObligations: clauses.providerObligations || DEFAULT_CLAUSES.providerObligations,
        clientObligations: clauses.clientObligations || DEFAULT_CLAUSES.clientObligations,
        paymentTerms: clauses.paymentTerms || DEFAULT_CLAUSES.paymentTerms,
        additionalClauses: clauses.additionalClauses || DEFAULT_CLAUSES.additionalClauses,
      },
    };

    const { merged } = this.buildPdf(campaign, team.name, terms.clauses);

    // Generate PDF
    const { buffer: pdfBuffer, clientSignatureY } = await this.renderPdf(campaign, merged, team.name);

    // Store signature position in terms for later stamping
    (terms as any)._clientSignatureY = clientSignatureY;

    // Upload to S3
    const s3Key = `contracts/${campaign.team_id}/${campaignId}/unsigned_${Date.now()}.pdf`;
    await s3Service.uploadBuffer(pdfBuffer, s3Key, "application/pdf");

    // Create or update contract row
    const [existingContract] = await db
      .select()
      .from(campaignContracts)
      .where(eq(campaignContracts.campaign_id, campaignId))
      .limit(1);

    if (existingContract) {
      const [updated] = await db
        .update(campaignContracts)
        .set({
          terms,
          unsigned_pdf_key: s3Key,
          status: "pending",
          updated_at: new Date(),
        })
        .where(eq(campaignContracts.id, existingContract.id))
        .returning();
      return updated;
    }

    const [contract] = await db
      .insert(campaignContracts)
      .values({
        campaign_id: campaignId,
        team_id: campaign.team_id,
        terms,
        unsigned_pdf_key: s3Key,
        status: "pending",
      })
      .returning();

    return contract;
  }

  async updateAndRegenerate(campaignId: number, clauses: ContractClauses) {
    // Verify contract exists and isn't signed
    const [contract] = await db
      .select()
      .from(campaignContracts)
      .where(eq(campaignContracts.campaign_id, campaignId))
      .limit(1);

    if (!contract) throw new Error("Contract not found");
    if (contract.status === "signed") throw new Error("Cannot edit a signed contract");

    return this.generateContract(campaignId, clauses);
  }

  private async renderPdf(
    campaign: { name: string; quoted_cpm: string | null; budget: string | null; video_minimum: number | null },
    clauses: {
      parties: string;
      providerObligations: string;
      clientObligations: string;
      paymentTerms: string;
      additionalClauses: string[];
    },
    teamName: string,
  ): Promise<{ buffer: Buffer; clientSignatureY: number }> {
    const pdfDoc = await PDFDocument.create();
    const bodyFont = await pdfDoc.embedFont(StandardFonts.TimesRoman);
    const bodyBoldFont = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
    const headingFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const labelFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

    // Embed Cuttr logo
    let logoImage: Awaited<ReturnType<typeof pdfDoc.embedPng>> | null = null;
    try {
      const logoPath = join(__dirname, "../../templates/assets/cuttr-logo.png");
      const logoBytes = readFileSync(logoPath);
      logoImage = await pdfDoc.embedPng(logoBytes);
    } catch (err) {
      console.warn("[CampaignContract] Could not embed logo:", err);
    }

    const pageWidth = 612;
    const pageHeight = 792;
    const margin = 64;
    const contentWidth = pageWidth - margin * 2;
    const darkColor = rgb(0.1, 0.1, 0.14);
    const grayColor = rgb(0.42, 0.42, 0.48);
    const lightGray = rgb(0.82, 0.82, 0.85);
    const accentColor = rgb(0.22, 0.52, 1.0); // Cuttr blue

    let page = pdfDoc.addPage([pageWidth, pageHeight]);
    let y = pageHeight - margin;

    const ensureSpace = (needed: number) => {
      if (y - needed < margin + 36) {
        drawFooter();
        page = pdfDoc.addPage([pageWidth, pageHeight]);
        y = pageHeight - margin;
      }
    };

    const drawFooter = () => {
      const pageCount = pdfDoc.getPageCount();
      const footerText = `Cuttr Inc.  |  Campaign Service Agreement  |  Page ${pageCount}`;
      const footerWidth = labelFont.widthOfTextAtSize(footerText, 7.5);
      page.drawText(footerText, {
        x: (pageWidth - footerWidth) / 2,
        y: 32,
        size: 7.5,
        font: labelFont,
        color: grayColor,
      });
    };

    const drawRule = (thickness = 0.5, color = lightGray) => {
      ensureSpace(10);
      page.drawLine({
        start: { x: margin, y },
        end: { x: pageWidth - margin, y },
        thickness,
        color,
      });
      y -= 14;
    };

    const drawHeading = (text: string, size: number) => {
      ensureSpace(size + 16);
      page.drawText(text, {
        x: margin,
        y,
        size,
        font: headingFont,
        color: darkColor,
      });
      y -= size + 8;
    };

    const drawSectionTitle = (number: number, title: string) => {
      ensureSpace(30);
      y -= 10;
      const label = `${number}.  ${title.toUpperCase()}`;
      page.drawText(label, {
        x: margin,
        y,
        size: 10.5,
        font: headingFont,
        color: accentColor,
      });
      y -= 18;
    };

    const drawBody = (text: string, indent = 0) => {
      const fontSize = 10;
      const lineHeight = fontSize + 5.5;
      const maxWidth = contentWidth - indent;
      const words = text.split(" ");
      let line = "";
      for (const word of words) {
        const testLine = line ? `${line} ${word}` : word;
        const width = bodyFont.widthOfTextAtSize(testLine, fontSize);
        if (width > maxWidth && line) {
          ensureSpace(lineHeight);
          page.drawText(line, {
            x: margin + indent,
            y,
            size: fontSize,
            font: bodyFont,
            color: darkColor,
          });
          y -= lineHeight;
          line = word;
        } else {
          line = testLine;
        }
      }
      if (line) {
        ensureSpace(lineHeight);
        page.drawText(line, {
          x: margin + indent,
          y,
          size: fontSize,
          font: bodyFont,
          color: darkColor,
        });
        y -= lineHeight;
      }
    };

    const drawTermRow = (label: string, value: string) => {
      ensureSpace(20);
      page.drawText(label, {
        x: margin + 8,
        y,
        size: 9.5,
        font: labelFont,
        color: grayColor,
      });
      page.drawText(value, {
        x: margin + 180,
        y,
        size: 10,
        font: bodyBoldFont,
        color: darkColor,
      });
      y -= 18;
    };

    // ── Header with Logo ────────────────────────────────────────

    if (logoImage) {
      const logoScale = 36 / logoImage.height;
      const logoW = logoImage.width * logoScale;
      const logoH = 36;
      page.drawImage(logoImage, {
        x: margin,
        y: y - logoH + 10,
        width: logoW,
        height: logoH,
      });
    } else {
      page.drawText("CUTTR", {
        x: margin,
        y,
        size: 16,
        font: headingFont,
        color: accentColor,
      });
    }

    const dateStr = new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    const dateWidth = labelFont.widthOfTextAtSize(dateStr, 9);
    page.drawText(dateStr, {
      x: pageWidth - margin - dateWidth,
      y: y - 6,
      size: 9,
      font: labelFont,
      color: grayColor,
    });
    y -= 46;

    // Accent bar
    page.drawRectangle({
      x: margin,
      y: y + 2,
      width: contentWidth,
      height: 3,
      color: accentColor,
    });
    y -= 14;

    // Title
    drawHeading("Campaign Service Agreement", 20);
    y -= 2;

    // Campaign name subtitle
    page.drawText(campaign.name, {
      x: margin,
      y,
      size: 12,
      font: bodyBoldFont,
      color: grayColor,
    });
    y -= 24;

    drawRule(0.5);

    // ── Section 1: Parties ──────────────────────────────────────

    drawSectionTitle(1, "Parties");
    drawBody(clauses.parties);
    y -= 6;

    // ── Section 2: Campaign Terms ───────────────────────────────

    drawSectionTitle(2, "Campaign Terms");

    // Terms with left accent border
    ensureSpace(70);
    const termsStartY = y;
    drawTermRow("CPM Rate", `$${campaign.quoted_cpm || "TBD"}`);
    drawTermRow("Campaign Budget", campaign.budget ? `$${Number(campaign.budget).toLocaleString()}` : "TBD");
    drawTermRow("Minimum Videos", campaign.video_minimum != null ? String(campaign.video_minimum) : "TBD");
    // Left accent bar spanning the term rows
    page.drawRectangle({
      x: margin,
      y,
      width: 3,
      height: termsStartY - y + 4,
      color: accentColor,
    });
    y -= 6;

    // ── Section 3: Provider Obligations ─────────────────────────

    drawSectionTitle(3, "Provider Obligations");
    drawBody(clauses.providerObligations);
    y -= 6;

    // ── Section 4: Client Obligations ───────────────────────────

    drawSectionTitle(4, "Client Obligations");
    drawBody(clauses.clientObligations);
    y -= 6;

    // ── Section 5: Payment Terms ────────────────────────────────

    drawSectionTitle(5, "Payment Terms");
    drawBody(clauses.paymentTerms);
    y -= 6;

    // ── Additional Clauses ──────────────────────────────────────

    let sectionNum = 6;
    for (const clause of clauses.additionalClauses) {
      drawSectionTitle(sectionNum, "Additional Terms");
      drawBody(clause);
      y -= 6;
      sectionNum++;
    }

    // ── Signature Block ─────────────────────────────────────────

    const sigBlockHeight = 170;
    ensureSpace(sigBlockHeight);
    y -= 14;
    drawRule(0.75, accentColor);
    y -= 2;
    drawHeading("Signatures", 14);
    y -= 6;

    // Two-column layout: Provider (left) | Client (right)
    const colWidth = (contentWidth - 40) / 2; // 40px gap
    const leftX = margin;
    const rightX = margin + colWidth + 40;
    const sigTop = y;

    // ── Provider column (left) — auto-signed ──
    page.drawText("PROVIDER", {
      x: leftX,
      y: sigTop,
      size: 8,
      font: headingFont,
      color: grayColor,
    });

    // Auto-signature: "The Cuttr Team" in italic-style
    const sigFont = await pdfDoc.embedFont(StandardFonts.TimesRomanBoldItalic);
    page.drawText("The Cuttr Team", {
      x: leftX,
      y: sigTop - 28,
      size: 16,
      font: sigFont,
      color: accentColor,
    });

    // Signature line below the auto-signature
    page.drawLine({
      start: { x: leftX, y: sigTop - 36 },
      end: { x: leftX + colWidth, y: sigTop - 36 },
      thickness: 0.5,
      color: darkColor,
    });
    page.drawText("Signature", {
      x: leftX,
      y: sigTop - 48,
      size: 8,
      font: labelFont,
      color: grayColor,
    });

    // Printed name
    page.drawText("Cuttr Inc.", {
      x: leftX,
      y: sigTop - 66,
      size: 10,
      font: bodyFont,
      color: darkColor,
    });
    page.drawLine({
      start: { x: leftX, y: sigTop - 72 },
      end: { x: leftX + colWidth, y: sigTop - 72 },
      thickness: 0.5,
      color: darkColor,
    });
    page.drawText("Printed Name", {
      x: leftX,
      y: sigTop - 84,
      size: 8,
      font: labelFont,
      color: grayColor,
    });

    // Date
    page.drawText(dateStr, {
      x: leftX,
      y: sigTop - 102,
      size: 10,
      font: bodyFont,
      color: darkColor,
    });
    page.drawLine({
      start: { x: leftX, y: sigTop - 108 },
      end: { x: leftX + colWidth * 0.65, y: sigTop - 108 },
      thickness: 0.5,
      color: darkColor,
    });
    page.drawText("Date", {
      x: leftX,
      y: sigTop - 120,
      size: 8,
      font: labelFont,
      color: grayColor,
    });

    // ── Client column (right) — to be signed ──
    page.drawText("CLIENT", {
      x: rightX,
      y: sigTop,
      size: 8,
      font: headingFont,
      color: grayColor,
    });

    // Signature line (empty — filled when signed)
    page.drawLine({
      start: { x: rightX, y: sigTop - 36 },
      end: { x: rightX + colWidth, y: sigTop - 36 },
      thickness: 0.5,
      color: darkColor,
    });
    page.drawText("Signature", {
      x: rightX,
      y: sigTop - 48,
      size: 8,
      font: labelFont,
      color: grayColor,
    });

    // Name line
    page.drawLine({
      start: { x: rightX, y: sigTop - 72 },
      end: { x: rightX + colWidth, y: sigTop - 72 },
      thickness: 0.5,
      color: darkColor,
    });
    page.drawText("Printed Name", {
      x: rightX,
      y: sigTop - 84,
      size: 8,
      font: labelFont,
      color: grayColor,
    });

    // Date line
    page.drawLine({
      start: { x: rightX, y: sigTop - 108 },
      end: { x: rightX + colWidth * 0.65, y: sigTop - 108 },
      thickness: 0.5,
      color: darkColor,
    });
    page.drawText("Date", {
      x: rightX,
      y: sigTop - 120,
      size: 8,
      font: labelFont,
      color: grayColor,
    });

    // Team name hint under client column
    page.drawText(teamName, {
      x: rightX,
      y: sigTop - 136,
      size: 8,
      font: labelFont,
      color: grayColor,
    });

    // Footer on last page
    drawFooter();

    // Client signature line is at sigTop - 36
    const clientSignatureY = sigTop - 36;

    const pdfBytes = await pdfDoc.save();
    return { buffer: Buffer.from(pdfBytes), clientSignatureY };
  }

  async getContract(campaignId: number) {
    const [contract] = await db
      .select()
      .from(campaignContracts)
      .where(eq(campaignContracts.campaign_id, campaignId))
      .limit(1);

    if (!contract) return null;

    // Generate presigned URL for the PDF
    const pdfKey =
      contract.status === "signed" && contract.signed_pdf_key
        ? contract.signed_pdf_key
        : contract.unsigned_pdf_key;

    let presigned_pdf_url: string | null = null;
    if (pdfKey) {
      try {
        presigned_pdf_url = await s3Service.getPresignedUrl(pdfKey);
      } catch (err) {
        console.error("[CampaignContract] Failed to generate presigned URL:", err);
      }
    }

    return {
      id: contract.id,
      campaign_id: contract.campaign_id,
      team_id: contract.team_id,
      status: contract.status,
      terms: contract.terms,
      legal_name: contract.signer_legal_name,
      signed_at: contract.signed_at?.toISOString() ?? null,
      created_at: contract.created_at?.toISOString() ?? null,
      updated_at: contract.updated_at?.toISOString() ?? null,
      presigned_pdf_url,
    };
  }

  async signContract(
    contractId: number,
    userId: number,
    legalName: string,
    signatureDataUrl: string,
    ipAddress: string,
  ) {
    const [contract] = await db
      .select()
      .from(campaignContracts)
      .where(eq(campaignContracts.id, contractId))
      .limit(1);

    if (!contract) throw new Error("Contract not found");
    if (contract.status === "signed") throw new Error("Contract already signed");

    // Decode signature from data URL and upload to S3
    const signatureBuffer = Buffer.from(
      signatureDataUrl.replace(/^data:image\/\w+;base64,/, ""),
      "base64",
    );
    const signatureKey = `contracts/${contract.team_id}/${contract.campaign_id}/signature_${Date.now()}.png`;
    await s3Service.uploadBuffer(signatureBuffer, signatureKey, "image/png");

    // Stamp signature onto the unsigned PDF (client = right column)
    let signedPdfKey: string | null = null;
    if (contract.unsigned_pdf_key) {
      try {
        const pdfBuffer = await s3Service.getImageAsBuffer(
          contract.unsigned_pdf_key,
        );
        const pdfDoc = await PDFDocument.load(pdfBuffer);
        const pages = pdfDoc.getPages();
        const lastPage = pages[pages.length - 1];
        // Layout constants matching renderPdf's right column
        const pageMargin = 64;
        const pageContentWidth = 612 - pageMargin * 2;
        const colWidth = (pageContentWidth - 40) / 2;
        const rightX = pageMargin + colWidth + 40;

        // Read exact signature line Y from stored metadata, fallback to estimate
        const terms = contract.terms as Record<string, any> | null;
        const sigLineY = terms?._clientSignatureY ?? (pageMargin + 80);

        // Embed signature image
        const sigImage = await pdfDoc.embedPng(signatureBuffer);
        const maxW = colWidth - 10;
        const maxH = 30;
        const scale = Math.min(maxW / sigImage.width, maxH / sigImage.height, 0.4);
        const sigW = sigImage.width * scale;
        const sigH = sigImage.height * scale;
        lastPage.drawImage(sigImage, {
          x: rightX + 2,
          y: sigLineY + 4,
          width: sigW,
          height: sigH,
        });

        // Add name text (below sig line, on the name line)
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        lastPage.drawText(legalName, {
          x: rightX,
          y: sigLineY - 28,
          size: 10,
          font,
          color: rgb(0.1, 0.1, 0.14),
        });

        // Add date text (on the date line)
        lastPage.drawText(new Date().toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
        }), {
          x: rightX,
          y: sigLineY - 64,
          size: 10,
          font,
          color: rgb(0.1, 0.1, 0.14),
        });

        const signedBytes = await pdfDoc.save();
        const signedBuffer = Buffer.from(signedBytes);
        signedPdfKey = `contracts/${contract.team_id}/${contract.campaign_id}/signed_${Date.now()}.pdf`;
        await s3Service.uploadBuffer(
          signedBuffer,
          signedPdfKey,
          "application/pdf",
        );
      } catch (err) {
        console.error("[CampaignContract] Failed to stamp signature on PDF:", err);
      }
    }

    // Update contract
    const [updated] = await db
      .update(campaignContracts)
      .set({
        signed_by_user_id: userId,
        signer_legal_name: legalName,
        signer_ip_address: ipAddress,
        signature_image_key: signatureKey,
        signed_pdf_key: signedPdfKey,
        signed_at: new Date(),
        status: "signed",
        updated_at: new Date(),
      })
      .where(eq(campaignContracts.id, contractId))
      .returning();

    // Update contract gate
    await this.checkContractGate(contract.campaign_id);

    // Send signed contract email to team owner + contact@cuttr.com
    try {
      const [campaign] = await db
        .select()
        .from(campaigns)
        .where(eq(campaigns.id, contract.campaign_id))
        .limit(1);

      const [team] = await db
        .select()
        .from(teams)
        .where(eq(teams.id, contract.team_id))
        .limit(1);

      const [owner] = await db
        .select({ email: users.email, firstName: users.first_name })
        .from(teamMembers)
        .innerJoin(users, eq(teamMembers.user_id, users.id))
        .where(
          and(
            eq(teamMembers.team_id, contract.team_id),
            eq(teamMembers.role, "owner"),
          ),
        )
        .limit(1);

      if (owner?.email) {
        const recipients = [owner.email, "contact@cuttr.com"];
        for (const to of recipients) {
          try {
            await emailNotiService.sendEmailNotification(
              to,
              `Contract Signed: ${campaign?.name || "Campaign"} - ${team?.name}`,
              `<p>The contract for campaign "${campaign?.name}" has been signed by ${legalName}.</p>`,
            );
          } catch {}
        }
      }
    } catch (emailError) {
      console.error("Failed to send contract signed email:", emailError);
    }

    return updated;
  }

  async checkContractGate(campaignId: number): Promise<boolean> {
    const [contract] = await db
      .select({ status: campaignContracts.status })
      .from(campaignContracts)
      .where(eq(campaignContracts.campaign_id, campaignId))
      .limit(1);

    const ready = contract?.status === "signed";

    await db
      .update(campaigns)
      .set({ contract_ready: ready, updated_at: new Date() })
      .where(eq(campaigns.id, campaignId));

    return ready;
  }
}

export const campaignContractService = new CampaignContractService();
