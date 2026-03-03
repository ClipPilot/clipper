import {
  campaigns,
  campaignContracts,
  teams,
  users,
  teamMembers,
} from "@clipper/shared-db";
import { db } from "../../db";
import { eq, and, ne } from "drizzle-orm";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { readFileSync } from "fs";
import { join } from "path";
import { s3Service } from "../s3.service";
import { emailNotiService } from "../emailNoti.service";
import {
  MASTER_AGREEMENT_TITLE,
  COMPANY_ENTITY,
  AGREEMENT_SECTIONS,
  PREAMBLE_PARAGRAPHS,
  ELECTRONIC_SIGNATURE_TITLE,
  ELECTRONIC_SIGNATURE_PARAGRAPHS,
  CLOSING_NOTE,
} from "../../constants/masterAgreementText";

class CampaignContractService {
  // ── Master Agreement Methods ──────────────────────────────────────────────

  async getOrGenerateMasterAgreement(teamId: number) {
    // Check for existing master agreement (any status except voided)
    const existing = await this.getSignedOrPendingMaster(teamId);
    if (existing) {
      return this.formatMasterAgreement(existing);
    }

    // Generate a new unsigned master agreement
    const { buffer: pdfBuffer, clientSignatureY } =
      await this.renderMasterAgreementPdf();

    const s3Key = `contracts/${teamId}/master/unsigned_${Date.now()}.pdf`;
    await s3Service.uploadBuffer(pdfBuffer, s3Key, "application/pdf");

    const [contract] = await db
      .insert(campaignContracts)
      .values({
        campaign_id: null,
        team_id: teamId,
        is_master: true,
        terms: { _clientSignatureY: clientSignatureY },
        unsigned_pdf_key: s3Key,
        effective_date: new Date(),
        status: "pending",
      })
      .returning();

    return this.formatMasterAgreement(contract);
  }

  async signMasterAgreement(
    teamId: number,
    userId: number,
    data: {
      legalEntityName: string;
      signerName: string;
      signerTitle: string;
      signerEmail: string;
      signatureDataUrl: string;
    },
    ipAddress: string,
  ) {
    const master = await this.getSignedOrPendingMaster(teamId);
    if (!master) throw new Error("No master agreement found");
    if (master.status === "signed") throw new Error("Agreement already signed");

    // Decode signature and upload to S3
    const signatureBuffer = Buffer.from(
      data.signatureDataUrl.replace(/^data:image\/\w+;base64,/, ""),
      "base64",
    );
    const signatureKey = `contracts/${teamId}/master/signature_${Date.now()}.png`;
    await s3Service.uploadBuffer(signatureBuffer, signatureKey, "image/png");

    // Stamp signature onto the unsigned PDF
    let signedPdfKey: string | null = null;
    if (master.unsigned_pdf_key) {
      try {
        const pdfBuffer = await s3Service.getImageAsBuffer(
          master.unsigned_pdf_key,
        );
        const pdfDoc = await PDFDocument.load(pdfBuffer);
        const pages = pdfDoc.getPages();
        const lastPage = pages[pages.length - 1];

        const pageMargin = 64;
        const pageContentWidth = 612 - pageMargin * 2;
        const colWidth = (pageContentWidth - 40) / 2;
        const rightX = pageMargin + colWidth + 40;

        const terms = master.terms as Record<string, any> | null;
        const sigLineY = terms?._clientSignatureY ?? pageMargin + 80;

        // Embed signature image
        const sigImage = await pdfDoc.embedPng(signatureBuffer);
        const maxW = colWidth - 10;
        const maxH = 30;
        const scale = Math.min(
          maxW / sigImage.width,
          maxH / sigImage.height,
          0.4,
        );
        const sigW = sigImage.width * scale;
        const sigH = sigImage.height * scale;
        lastPage.drawImage(sigImage, {
          x: rightX + 2,
          y: sigLineY + 4,
          width: sigW,
          height: sigH,
        });

        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const darkColor = rgb(0.1, 0.1, 0.14);

        // Entity name (above entity line at sigLineY - 36)
        lastPage.drawText(data.legalEntityName, {
          x: rightX,
          y: sigLineY - 30,
          size: 10,
          font,
          color: darkColor,
        });

        // Signer name + title (above name/title line at sigLineY - 72)
        lastPage.drawText(`${data.signerName}, ${data.signerTitle}`, {
          x: rightX,
          y: sigLineY - 66,
          size: 9,
          font,
          color: darkColor,
        });

        // Date (above date line at sigLineY - 108)
        lastPage.drawText(
          new Date().toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
          }),
          {
            x: rightX,
            y: sigLineY - 102,
            size: 10,
            font,
            color: darkColor,
          },
        );

        const signedBytes = await pdfDoc.save();
        signedPdfKey = `contracts/${teamId}/master/signed_${Date.now()}.pdf`;
        await s3Service.uploadBuffer(
          Buffer.from(signedBytes),
          signedPdfKey,
          "application/pdf",
        );
      } catch (err) {
        console.error(
          "[MasterAgreement] Failed to stamp signature on PDF:",
          err,
        );
      }
    }

    // Update contract record
    const [updated] = await db
      .update(campaignContracts)
      .set({
        signed_by_user_id: userId,
        signer_legal_name: data.signerName,
        signer_legal_entity_name: data.legalEntityName,
        signer_title: data.signerTitle,
        signer_email: data.signerEmail,
        signer_ip_address: ipAddress,
        signature_image_key: signatureKey,
        signed_pdf_key: signedPdfKey,
        signed_at: new Date(),
        status: "signed",
        updated_at: new Date(),
      })
      .where(eq(campaignContracts.id, master.id))
      .returning();

    // Auto-mark contract_ready on all accepted campaigns for this team
    await db
      .update(campaigns)
      .set({ contract_ready: true, updated_at: new Date() })
      .where(
        and(
          eq(campaigns.team_id, teamId),
          eq(campaigns.status, "accepted"),
        ),
      );

    // Send notification emails
    try {
      const [team] = await db
        .select()
        .from(teams)
        .where(eq(teams.id, teamId))
        .limit(1);

      const [owner] = await db
        .select({ email: users.email, firstName: users.first_name })
        .from(teamMembers)
        .innerJoin(users, eq(teamMembers.user_id, users.id))
        .where(
          and(
            eq(teamMembers.team_id, teamId),
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
              `Master Agreement Signed — ${team?.name || "Team"}`,
              `<p>The Cuttr Campaign Services Agreement has been signed by ${data.signerName} (${data.legalEntityName}).</p>`,
            );
          } catch {}
        }
      }
    } catch (emailError) {
      console.error(
        "Failed to send master agreement signed email:",
        emailError,
      );
    }

    return this.formatMasterAgreement(updated);
  }

  async getSignedMasterAgreement(teamId: number) {
    const [contract] = await db
      .select()
      .from(campaignContracts)
      .where(
        and(
          eq(campaignContracts.team_id, teamId),
          eq(campaignContracts.is_master, true),
          eq(campaignContracts.status, "signed"),
        ),
      )
      .limit(1);

    if (!contract) return null;
    return this.formatMasterAgreement(contract);
  }

  async hasSignedMasterAgreement(teamId: number): Promise<boolean> {
    const [contract] = await db
      .select({ id: campaignContracts.id })
      .from(campaignContracts)
      .where(
        and(
          eq(campaignContracts.team_id, teamId),
          eq(campaignContracts.is_master, true),
          eq(campaignContracts.status, "signed"),
        ),
      )
      .limit(1);

    return !!contract;
  }

  // ── Contract Gate (updated for master agreement) ──────────────────────────

  async checkContractGate(teamId: number, campaignId: number): Promise<boolean> {
    const hasMaster = await this.hasSignedMasterAgreement(teamId);

    await db
      .update(campaigns)
      .set({ contract_ready: hasMaster, updated_at: new Date() })
      .where(eq(campaigns.id, campaignId));

    return hasMaster;
  }

  // ── PDF Rendering ─────────────────────────────────────────────────────────

  async renderMasterAgreementPdf(): Promise<{
    buffer: Buffer;
    clientSignatureY: number;
  }> {
    const pdfDoc = await PDFDocument.create();
    const bodyFont = await pdfDoc.embedFont(StandardFonts.TimesRoman);
    const bodyBoldFont = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
    const headingFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const labelFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

    // Embed Cuttr logo
    let logoImage: Awaited<ReturnType<typeof pdfDoc.embedPng>> | null = null;
    try {
      const logoPath = join(
        __dirname,
        "../../templates/assets/cuttr-logo.png",
      );
      const logoBytes = readFileSync(logoPath);
      logoImage = await pdfDoc.embedPng(logoBytes);
    } catch (err) {
      console.warn("[MasterAgreement] Could not embed logo:", err);
    }

    const pageWidth = 612;
    const pageHeight = 792;
    const margin = 64;
    const contentWidth = pageWidth - margin * 2;
    const darkColor = rgb(0.1, 0.1, 0.14);
    const grayColor = rgb(0.42, 0.42, 0.48);
    const lightGray = rgb(0.82, 0.82, 0.85);
    const accentColor = rgb(0.22, 0.52, 1.0);

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
      const footerText = `${COMPANY_ENTITY}  |  ${MASTER_AGREEMENT_TITLE}  |  Page ${pageCount}`;
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

    // Title
    drawHeading(MASTER_AGREEMENT_TITLE, 20);
    y -= 2;

    // Subtitle
    page.drawText(COMPANY_ENTITY, {
      x: margin,
      y,
      size: 12,
      font: bodyBoldFont,
      color: grayColor,
    });
    y -= 24;

    drawRule(0.5);

    // ── Effective Date + Preamble ───────────────────────────────

    const effectiveDateLabel = `Effective Date: ${dateStr}`;
    page.drawText(effectiveDateLabel, {
      x: margin,
      y,
      size: 10,
      font: bodyBoldFont,
      color: darkColor,
    });
    y -= 24;

    for (const para of PREAMBLE_PARAGRAPHS) {
      drawBody(para);
      y -= 6;
    }

    // ── Render all 9 sections ────────────────────────────────────

    for (const section of AGREEMENT_SECTIONS) {
      drawSectionTitle(section.number, section.title);
      for (const para of section.paragraphs) {
        drawBody(para);
        y -= 4;
      }
      y -= 4;
    }

    // ── Electronic Signature Section ─────────────────────────────

    ensureSpace(60);
    y -= 10;
    drawHeading(ELECTRONIC_SIGNATURE_TITLE.toUpperCase(), 12);
    y -= 2;
    for (const para of ELECTRONIC_SIGNATURE_PARAGRAPHS) {
      drawBody(para);
      y -= 4;
    }

    // ── Signature Block ─────────────────────────────────────────

    const sigBlockHeight = 230;
    ensureSpace(sigBlockHeight);
    y -= 14;
    drawRule(0.75, accentColor);
    y -= 2;
    drawHeading("Signatures", 14);
    y -= 6;

    const colWidth = (contentWidth - 40) / 2;
    const leftX = margin;
    const rightX = margin + colWidth + 40;
    const sigTop = y;

    // ── Company column (left) — auto-signed ──
    page.drawText("COMPANY", {
      x: leftX,
      y: sigTop,
      size: 8,
      font: headingFont,
      color: grayColor,
    });

    const sigFont = await pdfDoc.embedFont(StandardFonts.TimesRomanBoldItalic);
    page.drawText("Clipper Media Group", {
      x: leftX,
      y: sigTop - 22,
      size: 16,
      font: sigFont,
      color: accentColor,
    });

    // Signature line
    page.drawLine({
      start: { x: leftX, y: sigTop - 30 },
      end: { x: leftX + colWidth, y: sigTop - 30 },
      thickness: 0.5,
      color: darkColor,
    });
    page.drawText("Signature", {
      x: leftX,
      y: sigTop - 42,
      size: 8,
      font: labelFont,
      color: grayColor,
    });

    // Entity name
    page.drawText(COMPANY_ENTITY, {
      x: leftX,
      y: sigTop - 60,
      size: 10,
      font: bodyFont,
      color: darkColor,
    });
    page.drawLine({
      start: { x: leftX, y: sigTop - 66 },
      end: { x: leftX + colWidth, y: sigTop - 66 },
      thickness: 0.5,
      color: darkColor,
    });
    page.drawText("Entity Name", {
      x: leftX,
      y: sigTop - 78,
      size: 8,
      font: labelFont,
      color: grayColor,
    });

    // Signatory name / title
    page.drawText("Authorized Representative", {
      x: leftX,
      y: sigTop - 96,
      size: 9,
      font: bodyFont,
      color: darkColor,
    });
    page.drawLine({
      start: { x: leftX, y: sigTop - 102 },
      end: { x: leftX + colWidth, y: sigTop - 102 },
      thickness: 0.5,
      color: darkColor,
    });
    page.drawText("Signatory Name / Title", {
      x: leftX,
      y: sigTop - 114,
      size: 8,
      font: labelFont,
      color: grayColor,
    });

    // Date
    page.drawText(dateStr, {
      x: leftX,
      y: sigTop - 132,
      size: 10,
      font: bodyFont,
      color: darkColor,
    });
    page.drawLine({
      start: { x: leftX, y: sigTop - 138 },
      end: { x: leftX + colWidth * 0.65, y: sigTop - 138 },
      thickness: 0.5,
      color: darkColor,
    });
    page.drawText("Date", {
      x: leftX,
      y: sigTop - 150,
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

    // Signature line
    page.drawLine({
      start: { x: rightX, y: sigTop - 30 },
      end: { x: rightX + colWidth, y: sigTop - 30 },
      thickness: 0.5,
      color: darkColor,
    });
    page.drawText("Signature", {
      x: rightX,
      y: sigTop - 42,
      size: 8,
      font: labelFont,
      color: grayColor,
    });

    // Entity name line
    page.drawLine({
      start: { x: rightX, y: sigTop - 66 },
      end: { x: rightX + colWidth, y: sigTop - 66 },
      thickness: 0.5,
      color: darkColor,
    });
    page.drawText("Legal Entity Name", {
      x: rightX,
      y: sigTop - 78,
      size: 8,
      font: labelFont,
      color: grayColor,
    });

    // Signatory name / title line
    page.drawLine({
      start: { x: rightX, y: sigTop - 102 },
      end: { x: rightX + colWidth, y: sigTop - 102 },
      thickness: 0.5,
      color: darkColor,
    });
    page.drawText("Signatory Name / Title", {
      x: rightX,
      y: sigTop - 114,
      size: 8,
      font: labelFont,
      color: grayColor,
    });

    // Date line
    page.drawLine({
      start: { x: rightX, y: sigTop - 138 },
      end: { x: rightX + colWidth * 0.65, y: sigTop - 138 },
      thickness: 0.5,
      color: darkColor,
    });
    page.drawText("Date", {
      x: rightX,
      y: sigTop - 150,
      size: 8,
      font: labelFont,
      color: grayColor,
    });

    // ── Closing Note ─────────────────────────────────────────────
    y = sigTop - 170;
    ensureSpace(30);
    drawBody(CLOSING_NOTE);

    drawFooter();

    const clientSignatureY = sigTop - 30;
    const pdfBytes = await pdfDoc.save();
    return { buffer: Buffer.from(pdfBytes), clientSignatureY };
  }

  // ── Void & Regenerate ────────────────────────────────────────────────────

  async voidAndRegenerateMasterAgreement(teamId: number) {
    // Void all existing non-voided master agreements for this team
    await db
      .update(campaignContracts)
      .set({ status: "voided", updated_at: new Date() })
      .where(
        and(
          eq(campaignContracts.team_id, teamId),
          eq(campaignContracts.is_master, true),
          ne(campaignContracts.status, "voided"),
        ),
      );

    // Reset contract_ready on all accepted campaigns for this team
    await db
      .update(campaigns)
      .set({ contract_ready: false, updated_at: new Date() })
      .where(
        and(
          eq(campaigns.team_id, teamId),
          eq(campaigns.status, "accepted"),
        ),
      );

    // Generate a fresh master agreement with updated text
    return this.getOrGenerateMasterAgreement(teamId);
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private async getSignedOrPendingMaster(teamId: number) {
    const [contract] = await db
      .select()
      .from(campaignContracts)
      .where(
        and(
          eq(campaignContracts.team_id, teamId),
          eq(campaignContracts.is_master, true),
          ne(campaignContracts.status, "voided"),
        ),
      )
      .limit(1);

    return contract ?? null;
  }

  private async formatMasterAgreement(
    contract: typeof campaignContracts.$inferSelect,
  ) {
    const pdfKey =
      contract.status === "signed" && contract.signed_pdf_key
        ? contract.signed_pdf_key
        : contract.unsigned_pdf_key;

    let presigned_pdf_url: string | null = null;
    if (pdfKey) {
      try {
        presigned_pdf_url = await s3Service.getPresignedUrl(pdfKey);
      } catch (err) {
        console.error(
          "[MasterAgreement] Failed to generate presigned URL:",
          err,
        );
      }
    }

    return {
      id: contract.id,
      team_id: contract.team_id,
      status: contract.status,
      signer_name: contract.signer_legal_name,
      signer_legal_entity_name: contract.signer_legal_entity_name,
      signer_title: contract.signer_title,
      signer_email: contract.signer_email,
      signed_at: contract.signed_at?.toISOString() ?? null,
      effective_date: contract.effective_date?.toISOString() ?? null,
      created_at: contract.created_at?.toISOString() ?? null,
      updated_at: contract.updated_at?.toISOString() ?? null,
      presigned_pdf_url,
    };
  }
}

export const campaignContractService = new CampaignContractService();
