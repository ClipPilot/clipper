import { google, drive_v3 } from "googleapis";
import fs from "fs";
import { config } from "../../config/env";

class GoogleDriveService {
  private static instance: GoogleDriveService;
  private driveClient: drive_v3.Drive | null = null;

  private constructor() {}

  static getInstance(): GoogleDriveService {
    if (!GoogleDriveService.instance) {
      GoogleDriveService.instance = new GoogleDriveService();
    }
    return GoogleDriveService.instance;
  }

  private getDrive(): drive_v3.Drive {
    if (this.driveClient) return this.driveClient;

    const { serviceAccountEmail, serviceAccountPrivateKey, driveParentFolderId } = config.google;

    if (!serviceAccountEmail || !serviceAccountPrivateKey || !driveParentFolderId) {
      throw new Error("Google Drive credentials not configured");
    }

    const auth = new google.auth.JWT({
      email: serviceAccountEmail,
      key: serviceAccountPrivateKey.replace(/\\n/g, "\n"),
      scopes: ["https://www.googleapis.com/auth/drive"],
      subject: config.google.delegateEmail || undefined,
    });

    this.driveClient = google.drive({ version: "v3", auth });
    return this.driveClient;
  }

  async createTeamFolder(teamName: string, teamId: number): Promise<string> {
    const drive = this.getDrive();

    const folderMetadata = {
      name: `${teamName} (Team ${teamId})`,
      mimeType: "application/vnd.google-apps.folder",
      parents: [config.google.driveParentFolderId],
    };

    const response = await drive.files.create({
      requestBody: folderMetadata,
      fields: "id",
    });

    const folderId = response.data.id;
    if (!folderId) {
      throw new Error("Failed to create Google Drive folder - no ID returned");
    }

    return folderId;
  }

  getFolderLink(folderId: string): string {
    return `https://drive.google.com/drive/folders/${folderId}`;
  }

  async ensurePlatformFolder(parentFolderId: string, platformName: string): Promise<string> {
    const existing = await this.listChildFolders(parentFolderId);
    const existingId = existing.get(platformName);
    if (existingId) return existingId;

    const drive = this.getDrive();
    const response = await drive.files.create({
      requestBody: {
        name: platformName,
        mimeType: "application/vnd.google-apps.folder",
        parents: [parentFolderId],
      },
      supportsAllDrives: true,
      fields: "id",
    });

    const folderId = response.data.id;
    if (!folderId) {
      throw new Error(`Failed to create platform folder "${platformName}" - no ID returned`);
    }
    return folderId;
  }

  async uploadFile(folderId: string, fileName: string, filePath: string, mimeType: string): Promise<string> {
    const drive = this.getDrive();
    const response = await drive.files.create({
      requestBody: {
        name: fileName,
        parents: [folderId],
      },
      media: {
        mimeType,
        body: fs.createReadStream(filePath),
      },
      supportsAllDrives: true,
      fields: "id",
    });

    const fileId = response.data.id;
    if (!fileId) {
      throw new Error(`Failed to upload file "${fileName}" - no ID returned`);
    }
    return fileId;
  }

  async deleteFile(fileId: string): Promise<void> {
    const drive = this.getDrive();
    await drive.files.delete({
      fileId,
      supportsAllDrives: true,
    });
  }

  private async listChildFolders(parentFolderId: string): Promise<Map<string, string>> {
    const drive = this.getDrive();
    const result = new Map<string, string>();

    const response = await drive.files.list({
      q: `'${parentFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
      fields: "files(id, name)",
    });

    for (const file of response.data.files || []) {
      if (file.id && file.name) {
        result.set(file.name, file.id);
      }
    }

    return result;
  }
}

export const googleDriveService = GoogleDriveService.getInstance();
