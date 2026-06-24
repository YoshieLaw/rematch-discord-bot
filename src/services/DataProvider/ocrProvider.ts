import axios from 'axios';
import FormData from 'form-data';

/**
 * Interface establishing the API contract.
 * If you change OCR vendors tomorrow, the new class will just implement this interface.
 */
export interface IOcrDataProvider {
  extractTextFromUrl(imageUrl: string): Promise<string>;
}

export class OcrDataProvider implements IOcrDataProvider {
  private apiKey: string;
  private apiUrl = 'https://api.ocr.space/parse/image';

  constructor() {
    const key = process.env.OCR_SPACE_KEY;
    if (!key) {
      throw new Error('System Configuration Fault: Missing OCR_API_KEY in environment.');
    }
    this.apiKey = key;
  }

  /**
   * Dispatches network payload to OCR.space and captures raw engine string matrices
   */
  public async extractTextFromUrl(imageUrl: string): Promise<string> {
    try {
      const formData = new FormData();
      formData.append('apikey', this.apiKey);
      formData.append('url', imageUrl);
      formData.append('isOverlayRequired', 'false');
      // Using Engine 3 as verified in debugging diagnostics
      formData.append('OcrEngine', '3'); 

      const response = await axios.post(this.apiUrl, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (response.data?.ParsedResults?.[0]) {
        return response.data.ParsedResults[0].ParsedText || '';
      }

      throw new Error('OCR API responded with an empty payload or unexpected structure.');
    } catch (error: any) {
      console.error(`[OcrSpaceDataProvider Error]: Failed telemetry pull - ${error.message}`);
      throw new Error('External OCR dependency extraction failure.');
    }
  }
}