const AWS = require('aws-sdk');
const s3 = new AWS.S3();
const dynamodb = new AWS.DynamoDB();
const sharp = require('sharp');

exports.handler = async (event) => {
  try {
    if (!event.Records || event.Records.length === 0) {
      throw new Error("Event does not contain S3 records");
    }

    const bucket = event.Records[0].s3.bucket.name;
    const key = decodeURIComponent(event.Records[0].s3.object.key.replace(/\+/g, ' '));

    // Download the image from S3
    const response = await s3.getObject({ Bucket: bucket, Key: key }).promise();
    const image = response.Body;

    // Resize the image using sharp
    const resizedImage = await sharp(image).resize(128, 128).jpeg().toBuffer();

    const resizedKey = `resized/${key}`;
    await s3.putObject({
      Bucket: bucket,
      Key: resizedKey,
      Body: resizedImage,
      ContentType: 'image/jpeg'
    }).promise();

    // Store metadata in DynamoDB
    await dynamodb.putItem({
      TableName: 'ImageMetadata',
      Item: {
        'ImageID': { S: key },
        'UploadTime': { S: new Date().toISOString() },
        'Bucket': { S: bucket },
        'ResizedImageKey': { S: resizedKey }
      }
    }).promise();

    return {
      statusCode: 200,
      body: 'Image processed and uploaded successfully'
    };
  } catch (error) {
    console.error(error);
    return {
      statusCode: 500,
      body: `Error processing image: ${error.message}`
    };
  }
};
