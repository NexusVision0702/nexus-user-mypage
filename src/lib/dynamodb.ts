import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

console.log("=== AWS CONFIG DEBUG ===");
console.log("Region:", process.env.MY_AWS_REGION || process.env.AWS_REGION || "ap-northeast-1");
console.log("AccessKey ID exists:", !!process.env.MY_AWS_ACCESS_KEY_ID);
console.log("Secret Key exists:", !!process.env.MY_AWS_SECRET_ACCESS_KEY);
console.log("========================");

const client = new DynamoDBClient({
  region: process.env.MY_AWS_REGION || process.env.AWS_REGION || "ap-northeast-1",
  credentials: {
    accessKeyId: process.env.MY_AWS_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.MY_AWS_SECRET_ACCESS_KEY || "",
  },
});

export const docClient = DynamoDBDocumentClient.from(client);

// ★ AWS側のテーブル名に完全一致させます
export const USERS_TABLE = "NexusVisionUsers";