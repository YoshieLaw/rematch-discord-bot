// src/service/imageProcessingService.ts
import crypto from 'crypto';

export class ImageProcessingService {
  /**
   * Downloads an image file from a Discord attachment URL into a temporary 
   * memory buffer and generates a unique, deterministic SHA-256 hex hash.
   */
  async generateImageHash(url: string): Promise<string> {
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`🛑 Failed to fetch image payload from Discord CDN: ${response.statusText}`);
    }
    
    // Read the incoming binary data stream into an array buffer
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    // Hash the byte buffer and return the unique identifier string
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }
}