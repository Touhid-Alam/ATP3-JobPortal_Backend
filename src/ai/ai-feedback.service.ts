import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class AiFeedbackService {
    private readonly logger = new Logger(AiFeedbackService.name);
    private readonly hfApiToken: string;
    private readonly hfModelId: string;
    private readonly hfApiBaseUrl = 'https://api-inference.huggingface.co/models/';

    constructor(private configService: ConfigService) {
        const token = this.configService.get<string>('HF_API_TOKEN');
        const model = this.configService.get<string>('HF_MODEL_ID');
        if (!token) { throw new Error('Hugging Face API Token is not configured.'); }
        if (!model) { throw new Error('Hugging Face Model ID is not configured.'); }
        this.hfApiToken = token;
        this.hfModelId = model;
        this.logger.log(`AI Service configured using Hugging Face model: ${this.hfModelId}`);
    }

    async getResumeFeedback(resumeText: string): Promise<string> {
        if (!this.hfApiToken || !this.hfModelId) {
             throw new InternalServerErrorException('AI Service (Hugging Face) is not configured.');
        }

        const maxInputChars = 8000;
        let inputText = resumeText;
        if (resumeText.length > maxInputChars) {
            this.logger.warn(`Resume text length (${resumeText.length}) exceeds limit (${maxInputChars}). Truncating.`);
            inputText = resumeText.substring(0, maxInputChars) + "\n\n[... RESUME TRUNCATED DUE TO LENGTH ...]";
        }

        this.logger.log(`Requesting HF feedback. Model: ${this.hfModelId}. Input text length: ${inputText.length}`);

        // Adjust prompt if needed for the specific model (e.g., Flan-T5 doesn't need [INST])
        const prompt = `Analyze the following resume text and provide constructive feedback in sections (Clarity, Impact, Formatting, Keywords, Mistakes). Suggest improvements. Resume Text: --- ${inputText} --- Feedback:`;

        const apiUrl = `${this.hfApiBaseUrl}${this.hfModelId}`;

        try {
            const response = await axios.post(
                apiUrl,
                {
                    inputs: prompt,
                    parameters: {
                        max_new_tokens: 250, // Keep the corrected limit
                        temperature: 0.7,
                        top_p: 0.9,
                        // <<< REMOVE return_full_text parameter >>>
                        // return_full_text: false,
                        // repetition_penalty: 1.1, // Keep if desired and supported
                    }
                },
                {
                    headers: { 'Authorization': `Bearer ${this.hfApiToken}`, 'Content-Type': 'application/json' },
                    timeout: 90000,
                }
            );

            // Extract Feedback - structure might vary slightly by model type
            // For Flan-T5, it's usually still in generated_text
            const feedback = response.data?.[0]?.generated_text?.trim();

            if (!feedback) {
                this.logger.error('Hugging Face API response did not contain generated_text.', JSON.stringify(response.data));
                throw new Error('Received empty or invalid feedback structure from AI.');
            }

            this.logger.log(`Successfully received HF feedback (length: ${feedback.length})`);
            return feedback;

        } catch (error) {
            // Keep existing error handling
            const errorMsg = error.response?.data?.error || error.message;
            const errorStatus = error.response?.status;
            this.logger.error(`Error calling Hugging Face API (Status: ${errorStatus}): ${errorMsg}`, error.stack);
            // Add specific check for parameter errors if useful
            if (errorStatus === 400 && typeof errorMsg === 'string' && errorMsg.includes('not used by the model')) {
                 this.logger.error(`Parameter error reported by HF API: ${errorMsg}`);
                 throw new InternalServerErrorException(`AI model parameter error: ${errorMsg}. Check supported parameters for ${this.hfModelId}.`);
            }
            if (errorStatus === 401) { throw new InternalServerErrorException('Hugging Face authentication failed. Check HF_API_TOKEN.'); }
            if (errorStatus === 429) { throw new InternalServerErrorException('Hugging Face rate limit exceeded. Try again later.'); }
            if (error.code === 'ECONNABORTED' || errorStatus === 504) { throw new InternalServerErrorException('Hugging Face API request timed out.'); }
            if (errorStatus === 503) { throw new InternalServerErrorException('The AI model is currently loading on Hugging Face servers, please try again in a minute.'); }
            throw new InternalServerErrorException(`Failed to get feedback from Hugging Face: ${errorMsg}`);
        }
    }
}