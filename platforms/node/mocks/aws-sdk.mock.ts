/**
 * Reusable AWS SDK v3 mock helpers for Node service tests.
 *
 * Import the factory you need and pass it to jest.mock at the top of a test
 * file. Each returns a controllable `send` jest.Mock you assert against.
 *
 *   const sendMock = jest.fn();
 *   jest.mock('@aws-sdk/client-s3', () => makeS3ClientMock(sendMock));
 *   // ...later: sendMock.mockResolvedValue({ ... })
 *
 * Adjust command lists to the commands your code actually constructs.
 */

/** Mock for `@aws-sdk/client-s3`. `send` is the single controllable seam. */
export const makeS3ClientMock = (send: jest.Mock) => ({
  S3Client: jest.fn().mockImplementation(() => ({ send })),
  PutObjectCommand: jest.fn((input) => ({ input })),
  GetObjectCommand: jest.fn((input) => ({ input })),
  CopyObjectCommand: jest.fn((input) => ({ input })),
  DeleteObjectCommand: jest.fn((input) => ({ input })),
  HeadObjectCommand: jest.fn((input) => ({ input })),
});

/** Mock for `@aws-sdk/client-sqs`. */
export const makeSqsClientMock = (send: jest.Mock) => ({
  SQSClient: jest.fn().mockImplementation(() => ({ send })),
  SendMessageCommand: jest.fn((input) => ({ input })),
  ReceiveMessageCommand: jest.fn((input) => ({ input })),
  DeleteMessageCommand: jest.fn((input) => ({ input })),
});

/** Mock for `@aws-sdk/lib-storage` multipart Upload. `done` is controllable. */
export const makeLibStorageMock = (done: jest.Mock) => ({
  Upload: jest.fn().mockImplementation(() => ({ done })),
});
