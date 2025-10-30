
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createS3Client, getBucketConfig } from "./aws-config";

const s3Client = createS3Client();
const { bucketName, folderPrefix } = getBucketConfig();

export async function uploadFile(buffer: Buffer, fileName: string): Promise<string> {
  const key = `${folderPrefix}uploads/${Date.now()}-${fileName}`;
  
  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: key,
    Body: buffer,
    ContentType: fileName.endsWith('.po') ? 'text/plain' : 'application/octet-stream',
  });

  await s3Client.send(command);
  return key;
}

export async function downloadFile(key: string): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: bucketName,
    Key: key,
  });

  const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
  return signedUrl;
}

export async function deleteFile(key: string): Promise<void> {
  const command = new DeleteObjectCommand({
    Bucket: bucketName,
    Key: key,
  });

  await s3Client.send(command);
}

export async function renameFile(oldKey: string, newKey: string): Promise<string> {
  // S3 doesn't have rename, so we copy and delete
  const getCommand = new GetObjectCommand({
    Bucket: bucketName,
    Key: oldKey,
  });

  const { Body } = await s3Client.send(getCommand);
  const bodyBytes = await Body?.transformToByteArray();

  if (!bodyBytes) {
    throw new Error('Failed to read file content');
  }

  const putCommand = new PutObjectCommand({
    Bucket: bucketName,
    Key: newKey,
    Body: Buffer.from(bodyBytes),
  });

  await s3Client.send(putCommand);
  await deleteFile(oldKey);
  
  return newKey;
}
