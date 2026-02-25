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
import { s3Service } from "../s3.service";
import { emailNotiService } from "../emailNoti.service";

class CampaignContractService {
  async generateContract(campaignId: number) {
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

    // Build contract terms
    const terms = {
      cpmRate: campaign.quoted_cpm,
      budget: campaign.budget,
      videoMinimum: campaign.video_minimum,
      teamName: team.name,
      campaignName: campaign.name,
      date: new Date().toISOString(),
    };

    // Generate PDF
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const page = pdfDoc.addPage([612, 792]); // Letter size
    const { height } = page.getSize();
    const margin = 60;
    let y = height - margin;

    const drawText = (text: string, size: number, isBold = false) => {
      page.drawText(text, {
        x: margin,
        y,
        size,
        font: isBold ? boldFont : font,
        color: rgb(0.1, 0.1, 0.1),
      });
      y -= size + 8;
    };

    const drawWrapped = (text: string, size: number) => {
      const maxWidth = 612 - margin * 2;
      const words = text.split(" ");
      let line = "";
      for (const word of words) {
        const testLine = line ? `${line} ${word}` : word;
        const width = font.widthOfTextAtSize(testLine, size);
        if (width > maxWidth && line) {
          page.drawText(line, {
            x: margin,
            y,
            size,
            font,
            color: rgb(0.1, 0.1, 0.1),
          });
          y -= size + 6;
          line = word;
        } else {
          line = testLine;
        }
      }
      if (line) {
        page.drawText(line, {
          x: margin,
          y,
          size,
          font,
          color: rgb(0.1, 0.1, 0.1),
        });
        y -= size + 8;
      }
    };

    // Header
    drawText("CAMPAIGN SERVICE AGREEMENT", 18, true);
    y -= 10;
    drawText(`Campaign: ${campaign.name}`, 12, true);
    drawText(`Date: ${new Date().toLocaleDateString()}`, 11);
    y -= 10;

    // Parties
    drawText("1. PARTIES", 13, true);
    drawWrapped(
      `This Agreement is entered into between Cuttr Inc. ("Provider") and ${team.name} ("Client") for the campaign "${campaign.name}".`,
      11,
    );
    y -= 8;

    // Terms
    drawText("2. CAMPAIGN TERMS", 13, true);
    drawText(`   CPM Rate: $${campaign.quoted_cpm || "TBD"}`, 11);
    drawText(`   Campaign Budget: $${campaign.budget || "TBD"}`, 11);
    drawText(`   Minimum Videos Required: ${campaign.video_minimum || "TBD"}`, 11);

    if (campaign.quoted_cpm && campaign.budget) {
      const cpm = parseFloat(campaign.quoted_cpm);
      const budget = parseFloat(campaign.budget);
      if (cpm > 0) {
        const guaranteedViews = Math.floor((budget / cpm) * 1000);
        drawText(
          `   Guaranteed Views: ${guaranteedViews.toLocaleString()}`,
          11,
        );
      }
    }
    y -= 8;

    // Obligations
    drawText("3. PROVIDER OBLIGATIONS", 13, true);
    drawWrapped(
      "Provider agrees to distribute Client's video content across its network of social media accounts to achieve the guaranteed view count specified above.",
      11,
    );
    y -= 8;

    drawText("4. CLIENT OBLIGATIONS", 13, true);
    drawWrapped(
      "Client agrees to provide the minimum number of videos as specified above, deposit the agreed campaign budget, and ensure all content complies with platform guidelines.",
      11,
    );
    y -= 8;

    drawText("5. PAYMENT TERMS", 13, true);
    drawWrapped(
      "Campaign budget must be deposited in full before the campaign can start. Funds will be drawn from the campaign wallet as posts are distributed.",
      11,
    );
    y -= 8;

    // Signature block
    y -= 20;
    drawText("SIGNATURES", 13, true);
    y -= 10;
    drawText("Client Signature: ____________________________", 11);
    y -= 5;
    drawText("Name: ____________________________", 11);
    y -= 5;
    drawText("Date: ____________________________", 11);

    const pdfBytes = await pdfDoc.save();
    const pdfBuffer = Buffer.from(pdfBytes);

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

    let pdfUrl: string | null = null;
    if (pdfKey) {
      try {
        pdfUrl = await s3Service.getPresignedUrl(pdfKey);
      } catch {}
    }

    return { ...contract, pdfUrl };
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

    // Stamp signature onto the unsigned PDF
    let signedPdfKey: string | null = null;
    if (contract.unsigned_pdf_key) {
      try {
        const pdfBuffer = await s3Service.getImageAsBuffer(
          contract.unsigned_pdf_key,
        );
        const pdfDoc = await PDFDocument.load(pdfBuffer);
        const pages = pdfDoc.getPages();
        const lastPage = pages[pages.length - 1];

        // Embed signature image
        const sigImage = await pdfDoc.embedPng(signatureBuffer);
        const sigDims = sigImage.scale(0.3);
        lastPage.drawImage(sigImage, {
          x: 200,
          y: 100,
          width: Math.min(sigDims.width, 200),
          height: Math.min(sigDims.height, 80),
        });

        // Add name and date text
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        lastPage.drawText(legalName, {
          x: 200,
          y: 85,
          size: 10,
          font,
          color: rgb(0.1, 0.1, 0.1),
        });
        lastPage.drawText(new Date().toLocaleDateString(), {
          x: 200,
          y: 72,
          size: 10,
          font,
          color: rgb(0.1, 0.1, 0.1),
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
        // Continue without stamped PDF — the signature image is still saved
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
