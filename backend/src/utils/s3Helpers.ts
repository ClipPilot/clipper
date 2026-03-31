import { s3Service } from "../services/s3.service";

const MAX_REFERENCE_IMAGES = 5;

export async function getReferenceImageUrls(
  imageKeys: string[],
  logPrefix: string = "S3"
): Promise<string[]> {
  const keysToFetch = imageKeys.slice(0, MAX_REFERENCE_IMAGES);

  const results = await Promise.allSettled(
    keysToFetch.map((key) => s3Service.getPresignedUrl(key, 3600))
  );

  return results
    .filter(
      (r): r is PromiseFulfilledResult<string> => r.status === "fulfilled"
    )
    .map((r) => r.value);
}
