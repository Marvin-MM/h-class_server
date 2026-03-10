import type { AdminRepository } from './repository.js';
import type { PaymentsRepository } from '../payments/repository.js';
import type { NotificationsService } from '../notifications/service.js';
import type { Queue } from 'bullmq';
import type { ApplicationResponse, AppConfigResponse } from './types.js';
import type { ApplicationActionDto, UpdateConfigDto, AuditLogQueryDto, FinancialSummaryQueryDto } from './dto.js';
import { NotFoundError, ConflictError, ValidationError } from '../../shared/errors/index.js';
import { eventBus, AppEvents } from '../../shared/utils/event-bus.js';
import { logger } from '../../shared/utils/logger.js';

export class AdminService {
  constructor(
    private readonly adminRepository: AdminRepository,
    private readonly paymentsRepository: PaymentsRepository,
    private readonly notificationsService: NotificationsService,
    private readonly emailQueue: Queue,
  ) {}

  async getApplications(status?: string, page = 1, pageSize = 20) {
    const result = await this.adminRepository.findApplications(status, page, pageSize);
    return {
      data: result.data.map((a): ApplicationResponse => ({
        id: a.id, userId: a.userId, status: a.status,
        denialReason: a.denialReason, createdAt: a.createdAt,
        user: a.user,
      })),
      meta: { page, pageSize, total: result.total },
    };
  }

  async approveApplication(applicationId: string): Promise<void> {
    const app = await this.adminRepository.findApplicationById(applicationId);
    if (!app) throw new NotFoundError('Application', applicationId);
    if (app.status !== 'PENDING') throw new ConflictError('Only PENDING applications can be approved');

    await this.adminRepository.approveApplication(applicationId, app.userId);

    // Notify the user
    await this.notificationsService.notify(app.userId, 'Tutor Application Approved', 'Congratulations! Your tutor application has been approved.');
    await this.emailQueue.add('tutor-approved', { to: app.user.email, subject: 'Tutor Application Approved', template: 'tutor-approved', data: { firstName: app.user.firstName } });

    eventBus.emit(AppEvents.TUTOR_APPLICATION_APPROVED, { applicationId, userId: app.userId, email: app.user.email, firstName: app.user.firstName });
    logger.info('Tutor application approved', { applicationId, userId: app.userId });
  }

  async denyApplication(applicationId: string, dto: ApplicationActionDto): Promise<void> {
    const app = await this.adminRepository.findApplicationById(applicationId);
    if (!app) throw new NotFoundError('Application', applicationId);
    if (app.status !== 'PENDING') throw new ConflictError('Only PENDING applications can be denied');
    if (!dto.reason) throw new ValidationError('Denial reason is required');

    await this.adminRepository.denyApplication(applicationId, dto.reason);

    await this.notificationsService.notify(app.userId, 'Tutor Application Denied', `Your application was denied: ${dto.reason}`);
    await this.emailQueue.add('tutor-denied', { to: app.user.email, subject: 'Tutor Application Update', template: 'tutor-denied', data: { firstName: app.user.firstName, reason: dto.reason } });

    eventBus.emit(AppEvents.TUTOR_APPLICATION_DENIED, { applicationId, userId: app.userId, email: app.user.email, firstName: app.user.firstName, reason: dto.reason });
    logger.info('Tutor application denied', { applicationId, userId: app.userId });
  }

  async getConfig(): Promise<AppConfigResponse[]> {
    const configs = await this.adminRepository.getConfig();
    return configs.map((c) => ({ key: c.key, value: c.value, updatedAt: c.updatedAt }));
  }

  async updateConfig(dto: UpdateConfigDto): Promise<AppConfigResponse> {
    const config = await this.adminRepository.updateConfig(dto.key, dto.value);
    logger.info('Platform config updated', { key: dto.key });
    return { key: config.key, value: config.value, updatedAt: config.updatedAt };
  }

  async getAuditLogs(dto: AuditLogQueryDto) {
    return this.adminRepository.queryAuditLogs({
      page: dto.page, pageSize: dto.pageSize,
      actorId: dto.actorId, resourceType: dto.resourceType,
      action: dto.action, startDate: dto.startDate, endDate: dto.endDate,
    });
  }

  async getFinancialSummary(dto: FinancialSummaryQueryDto) {
    const summary = await this.paymentsRepository.getFinancialSummary(dto.startDate, dto.endDate);
    return {
      totalGrossRevenue: summary.totalGrossRevenue.toFixed(2),
      totalPlatformFees: summary.totalPlatformFees.toFixed(2),
      totalTutorPayouts: summary.totalTutorPayouts.toFixed(2),
    };
  }
}
