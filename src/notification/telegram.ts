import type { NotificationAdapter } from '../domain/contracts.js';
import type { AlertRecord } from '../domain/models.js';
import { log } from '../logging/logger.js';
export class TelegramNotificationAdapter implements NotificationAdapter {
  constructor(
    private readonly token = process.env.TELEGRAM_BOT_TOKEN,
    private readonly chatId = process.env.TELEGRAM_CHAT_ID,
  ) {}
  async notify(alert: AlertRecord): Promise<void> {
    const payload = {
      environment: alert.environment,
      url: alert.url,
      rule: alert.ruleId,
      severity: alert.severity,
      time: alert.occurredAt,
      expected: alert.expected,
      actual: alert.actual,
      evidenceReference: alert.evidenceReference,
    };
    if (!this.token || !this.chatId) {
      log('telegram.dry_run', { ...payload });
      return;
    }
    log('telegram.not_sent_pending_recipient_confirmation', { ...payload });
  }
}
