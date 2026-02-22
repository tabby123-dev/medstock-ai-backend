import { Injectable, Logger } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(private readonly mailerService: MailerService) {}

  async sendManagerApprovalEmail(
    to: string,
    firstName: string,
    temporaryPassword: string,
  ): Promise<void> {
    await this.sendMail({
      to,
      subject: 'Your Pharmacy Manager Account Has Been Approved',
      html: `
        <h2>Welcome, ${firstName}!</h2>
        <p>Your pharmacy manager account has been approved. You can now log in using the credentials below.</p>
        <p><strong>Email:</strong> ${to}</p>
        <p><strong>Temporary Password:</strong> <code style="background:#f4f4f4;padding:4px 8px;border-radius:4px;">${temporaryPassword}</code></p>
        <p style="color:#e53e3e;"><strong>Important:</strong> Please change your password immediately after your first login.</p>
        <br/>
        <p>If you have any questions, please contact support.</p>
      `,
    });
  }

  async sendManagerRejectionEmail(
    to: string,
    firstName: string,
    reason: string,
  ): Promise<void> {
    await this.sendMail({
      to,
      subject: 'Your Pharmacy Manager Request Has Been Reviewed',
      html: `
        <h2>Hello, ${firstName}</h2>
        <p>We have reviewed your pharmacy manager registration request and unfortunately it has not been approved at this time.</p>
        <p><strong>Reason:</strong> ${reason}</p>
        <br/>
        <p>If you believe this is a mistake or would like to reapply, please contact our support team.</p>
      `,
    });
  }

  // Shared private sender — all methods funnel through here
  private async sendMail({
    to,
    subject,
    html,
  }: {
    to: string;
    subject: string;
    html: string;
  }): Promise<void> {
    try {
      await this.mailerService.sendMail({ to, subject, html });
      this.logger.log(`Email sent to ${to} — "${subject}"`);
    } catch (error) {
      this.logger.error(`Failed to send email to ${to} — "${subject}"`, error);
      throw error;
    }
  }
}
