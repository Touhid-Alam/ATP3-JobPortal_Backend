import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import Mail from 'nodemailer/lib/mailer';

@Injectable()
export class MailerService {
    private readonly logger = new Logger(MailerService.name);
    private transporter: Mail;

    constructor(private configService: ConfigService) {
        const service = this.configService.get<string>('EMAIL_SERVICE');
        const user = this.configService.get<string>('EMAIL_USER');
        const pass = this.configService.get<string>('EMAIL_PASS');

        if (!service || !user || !pass) {
            this.logger.error('Email service configuration (EMAIL_SERVICE, EMAIL_USER, EMAIL_PASS) is incomplete. Email sending will fail.');
            this.transporter = nodemailer.createTransport({}); // Initialize with empty config
            return;
        }

        // <<< REMOVED explicit type ': nodemailer.TransportOptions' here >>>
        const transportOptions = {
            service: service, // This is valid for Nodemailer runtime
            auth: {
                user: user,
                pass: pass,
            },
        };

        // Create reusable transporter object - using 'as any' to bypass strict compile-time checks for the 'service' property
        this.transporter = nodemailer.createTransport(transportOptions as any);

        // Verify connection configuration on startup
        this.transporter.verify((error, success) => {
            if (error) {
                this.logger.error(`Nodemailer transporter verification failed for service "${service}" and user "${user}":`, error);
            } else {
                this.logger.log(`Nodemailer transporter configured successfully for user "${user}" and ready for messages.`);
            }
        });
    }

    /**
     * Sends an email.
     * @param mailOptions Options for Nodemailer sendMail (to, subject, text, html, etc.)
     * @throws InternalServerErrorException if sending fails
     */
    async sendMail(mailOptions: Mail.Options): Promise<void> {
        const configuredUser = this.configService.get<string>('EMAIL_USER');
        // Check if transporter might be improperly configured due to missing env vars on startup
        if (!this.transporter || Object.keys(this.transporter.options).length === 0 || !configuredUser) {
             this.logger.error('Attempted to send email, but MailerService is not properly configured (check environment variables and restart).');
             throw new InternalServerErrorException('Email service is not configured.');
        }

        const fromAddress = `"Job Portal" <${configuredUser}>`;
        const optionsToSend = {
            ...mailOptions,
            from: mailOptions.from || fromAddress,
        };

        if (!optionsToSend.to) {
             this.logger.error('Attempted to send email with no recipient (`to` address missing).');
             throw new InternalServerErrorException('Email recipient address is required.');
        }

        try {
            this.logger.log(`Attempting to send email: Subject "${optionsToSend.subject}" to: ${optionsToSend.to}`);
            const info = await this.transporter.sendMail(optionsToSend);
            this.logger.log(`Email sent successfully to ${optionsToSend.to}. Message ID: ${info.messageId}`);
        } catch (error) {
            this.logger.error(`Failed to send email to ${optionsToSend.to}. Subject: "${optionsToSend.subject}". Error: ${error.message}`, error.stack);
            throw new InternalServerErrorException(`Failed to send email: ${error.message}`);
        }
    }
}