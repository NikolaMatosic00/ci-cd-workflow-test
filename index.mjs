import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import fs from "fs";

// Initialize S3 Client.
// Magic happens here: No credentials provided! 
// It automatically detects and uses the IAM Role attached to this EC2 instance.
const s3Client = new S3Client({ region: "eu-central-1" });

const uploadFileToS3 = async () => {
  try {
    // We will read the test.txt file you created earlier (it's in the directory above)
    const fileContent = fs.readFileSync("../test.txt");

    const params = {
      Bucket: "nikola-shop-uploads-554433",
      Key: "slika-iz-koda.txt", 
      Body: fileContent,
    };

    const command = new PutObjectCommand(params);
    await s3Client.send(command);

    console.log("Success! File uploaded directly from Node.js.");
  } catch (error) {
    console.error("Upload failed:", error);
  }
};

uploadFileToS3();
