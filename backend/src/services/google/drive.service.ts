import { google, drive_v3 } from "googleapis";
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
}

export const googleDriveService = GoogleDriveService.getInstance();
