/**
 * Walrus Storage Service
 * Handles file uploads to Walrus decentralized storage
 */

import { config } from '../config';
import fetch from 'node-fetch';

export interface WalrusUploadResult {
  blobId: string;
  objectId?: string;
  size: number;
}

export interface WalrusUploadOptions {
  epochs?: number;
  encoding?: string;
}

export class WalrusService {
  private readonly aggregatorUrl: string;
  private readonly publisherUrl: string;
  private readonly defaultEpochs: number = 1;

  constructor() {
    this.aggregatorUrl = process.env.WALRUS_AGGREGATOR_URL || 'https://aggregator.walrus-testnet.walrus.space';
    this.publisherUrl = process.env.WALRUS_PUBLISHER_URL || 'https://publisher.walrus-testnet.walrus.space';
    this.defaultEpochs = parseInt(process.env.WALRUS_DEFAULT_EPOCHS || '1', 10);
  }

  /**
   * Upload file to Walrus
   * @param data File content (Buffer or string)
   * @param options Upload options
   * @returns Walrus Blob ID and Object ID
   */
  async uploadBlob(data: Buffer | string, options: WalrusUploadOptions = {}): Promise<WalrusUploadResult> {
    const epochs = options.epochs || this.defaultEpochs;
    const buffer = typeof data === 'string' ? Buffer.from(data, 'utf-8') : data;
    const uploadUrl = `${this.publisherUrl}/v1/blobs?epochs=${epochs}`;

    try {
      const response = await fetch(uploadUrl, {
        method: 'PUT',
        body: buffer,
        headers: {
          'Content-Type': 'application/octet-stream',
          'Content-Length': buffer.length.toString(),
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to upload to Walrus: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const result = await response.json() as any;

      let blobId: string;
      let objectId: string | undefined;

      if (result.newlyCreated) {
        blobId = result.newlyCreated.blobObject.blobId;
        objectId = result.newlyCreated.blobObject.id;
      } else if (result.alreadyCertified) {
        blobId = result.alreadyCertified.blobId;
      } else {
        throw new Error('Unexpected response format from Walrus');
      }

      return {
        blobId,
        objectId,
        size: buffer.length,
      };
    } catch (error: any) {
      throw new Error(`Failed to upload to Walrus: ${error.message}`);
    }
  }

  /**
   * Download file from Walrus
   * @param blobId Blob ID
   * @returns File content (Buffer)
   */
  async downloadBlob(blobId: string): Promise<Buffer> {
    const downloadUrl = `${this.aggregatorUrl}/v1/blobs/${blobId}`;

    try {
      const response = await fetch(downloadUrl, {
        method: 'GET',
      });

      if (!response.ok) {
        throw new Error(`Failed to download from Walrus: ${response.status} ${response.statusText}`);
      }

      const buffer = await response.arrayBuffer();
      return Buffer.from(buffer);
    } catch (error: any) {
      throw new Error(`Failed to download from Walrus: ${error.message}`);
    }
  }

  /**
   * Get Blob URL for access (using aggregator)
   * @param blobId Blob ID
   * @returns Access URL
   */
  getBlobUrl(blobId: string): string {
    return `${this.aggregatorUrl}/v1/blobs/${blobId}`;
  }

  /**
   * Upload JSON configuration to Walrus
   * @param config Configuration object
   * @param options Upload options
   * @returns Walrus Blob ID
   */
  async uploadConfig(config: any, options: WalrusUploadOptions = {}): Promise<WalrusUploadResult> {
    const jsonString = JSON.stringify(config, null, 2);
    return this.uploadBlob(jsonString, options);
  }

  /**
   * Upload text file to Walrus
   * @param text Text content
   * @param options Upload options
   * @returns Walrus Blob ID
   */
  async uploadText(text: string, options: WalrusUploadOptions = {}): Promise<WalrusUploadResult> {
    return this.uploadBlob(text, options);
  }

  /**
   * Validate Blob ID format
   * @param blobId Blob ID
   * @returns Whether it's a valid Blob ID
   */
  isValidBlobId(blobId: string): boolean {
    return /^[0-9a-fA-F]+$/.test(blobId) && blobId.length >= 32;
  }
}
