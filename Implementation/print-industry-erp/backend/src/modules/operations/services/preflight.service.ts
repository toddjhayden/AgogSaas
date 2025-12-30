import { Injectable, Inject } from '@nestjs/common';
import { Pool } from 'pg';

/**
 * Preflight Service
 *
 * REQ: REQ-STRATEGIC-AUTO-1767066329942 - PDF Preflight & Color Management
 *
 * Provides PDF validation and preflight checking capabilities.
 * Phase 1 implementation focuses on:
 * - Basic PDF metadata extraction
 * - Validation against preflight profiles
 * - Issue tracking and reporting
 *
 * Future phases will add:
 * - Advanced color management (ICC profiles, Delta E)
 * - Detailed image/font analysis
 * - Automated proof generation
 */

export interface PreflightProfile {
  id: string;
  tenantId: string;
  profileName: string;
  profileType: string;
  version: number;
  rules: any;
  isDefault: boolean;
  isActive: boolean;
}

export interface PreflightReport {
  id: string;
  tenantId: string;
  jobId?: string;
  estimateId?: string;
  artworkFileId: string;
  fileName: string;
  fileSizeBytes?: number;
  fileHash?: string;
  preflightProfileId: string;
  profileVersion: number;
  status: string;
  totalErrors: number;
  totalWarnings: number;
  totalInfo: number;
  pdfVersion?: string;
  pageCount?: number;
  colorSpace?: string;
  processingTimeMs?: number;
  processedAt?: Date;
}

export interface PreflightIssue {
  id: string;
  preflightReportId: string;
  issueType: 'ERROR' | 'WARNING' | 'INFO';
  errorCode: string;
  severity: 'CRITICAL' | 'MAJOR' | 'MINOR';
  pageNumber?: number;
  elementType?: string;
  message: string;
  suggestedFix?: string;
  elementName?: string;
  elementMetadata?: any;
}

export interface ValidatePdfInput {
  artworkFileId: string;
  jobId?: string;
  estimateId?: string;
  profileId: string;
  fileName: string;
  tenantId: string;
  userId: string;
}

@Injectable()
export class PreflightService {
  constructor(
    @Inject('DATABASE_POOL') private readonly db: Pool,
  ) {}

  /**
   * Get preflight profile by ID
   */
  async getProfile(id: string): Promise<PreflightProfile | null> {
    const result = await this.db.query(
      `SELECT * FROM preflight_profiles
       WHERE id = $1 AND deleted_at IS NULL`,
      [id]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapProfileRow(result.rows[0]);
  }

  /**
   * List preflight profiles for tenant
   */
  async listProfiles(
    tenantId: string,
    filters?: {
      profileType?: string;
      isActive?: boolean;
    }
  ): Promise<PreflightProfile[]> {
    let query = `
      SELECT * FROM preflight_profiles
      WHERE tenant_id = $1 AND deleted_at IS NULL
    `;
    const params: any[] = [tenantId];
    let paramIndex = 2;

    if (filters?.profileType) {
      query += ` AND profile_type = $${paramIndex++}`;
      params.push(filters.profileType);
    }

    if (filters?.isActive !== undefined) {
      query += ` AND is_active = $${paramIndex++}`;
      params.push(filters.isActive);
    }

    query += ` ORDER BY is_default DESC, profile_name`;

    const result = await this.db.query(query, params);
    return result.rows.map(this.mapProfileRow);
  }

  /**
   * Create new preflight profile
   */
  async createProfile(input: {
    tenantId: string;
    profileName: string;
    profileType: string;
    rules: any;
    isDefault?: boolean;
    description?: string;
    userId: string;
  }): Promise<PreflightProfile> {
    const result = await this.db.query(
      `INSERT INTO preflight_profiles (
        tenant_id, profile_name, profile_type, rules,
        is_default, description, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *`,
      [
        input.tenantId,
        input.profileName,
        input.profileType,
        JSON.stringify(input.rules),
        input.isDefault || false,
        input.description,
        input.userId
      ]
    );

    return this.mapProfileRow(result.rows[0]);
  }

  /**
   * Update preflight profile (creates new version)
   */
  async updateProfile(
    id: string,
    input: {
      profileName?: string;
      rules?: any;
      isDefault?: boolean;
      isActive?: boolean;
      description?: string;
      versionNotes?: string;
      userId: string;
    }
  ): Promise<PreflightProfile> {
    const currentProfile = await this.getProfile(id);
    if (!currentProfile) {
      throw new Error(`Preflight profile ${id} not found`);
    }

    // Create new version
    const newVersion = currentProfile.version + 1;

    const result = await this.db.query(
      `INSERT INTO preflight_profiles (
        tenant_id, profile_name, profile_type, rules,
        version, version_notes, superseded_by,
        is_default, is_active, description, created_by
      )
      SELECT
        tenant_id,
        COALESCE($1, profile_name),
        profile_type,
        COALESCE($2, rules),
        $3,
        $4,
        NULL,
        COALESCE($5, is_default),
        COALESCE($6, is_active),
        COALESCE($7, description),
        $8
      FROM preflight_profiles
      WHERE id = $9
      RETURNING *`,
      [
        input.profileName,
        input.rules ? JSON.stringify(input.rules) : null,
        newVersion,
        input.versionNotes,
        input.isDefault,
        input.isActive,
        input.description,
        input.userId,
        id
      ]
    );

    const newProfile = this.mapProfileRow(result.rows[0]);

    // Mark old version as superseded
    await this.db.query(
      `UPDATE preflight_profiles
       SET superseded_by = $1, effective_until = NOW()
       WHERE id = $2`,
      [newProfile.id, id]
    );

    return newProfile;
  }

  /**
   * Validate PDF file against preflight profile
   *
   * Phase 1: Creates report structure, queues for async processing
   * Future: Will integrate with pdf-lib, sharp for actual validation
   */
  async validatePdf(input: ValidatePdfInput): Promise<PreflightReport> {
    const startTime = Date.now();

    // Get profile
    const profile = await this.getProfile(input.profileId);
    if (!profile) {
      throw new Error(`Preflight profile ${input.profileId} not found`);
    }

    // Create report (QUEUED status for async processing)
    const reportResult = await this.db.query(
      `INSERT INTO preflight_reports (
        tenant_id, job_id, estimate_id, artwork_file_id,
        file_name, preflight_profile_id, profile_version,
        status, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *`,
      [
        input.tenantId,
        input.jobId,
        input.estimateId,
        input.artworkFileId,
        input.fileName,
        profile.id,
        profile.version,
        'QUEUED',  // Will be processed by worker
        input.userId
      ]
    );

    const report = this.mapReportRow(reportResult.rows[0]);

    // Create audit log entry
    await this.createAuditLog({
      reportId: report.id,
      action: 'CREATED',
      performedBy: input.userId,
      notes: 'Preflight validation queued'
    });

    // TODO Phase 2: Publish to NATS queue for async processing
    // await this.nats.publish('preflight.validate', {
    //   reportId: report.id,
    //   artworkFileId: input.artworkFileId,
    //   profileId: profile.id
    // });

    return report;
  }

  /**
   * Get preflight report by ID
   */
  async getReport(id: string): Promise<PreflightReport | null> {
    const result = await this.db.query(
      `SELECT * FROM preflight_reports
       WHERE id = $1 AND deleted_at IS NULL`,
      [id]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapReportRow(result.rows[0]);
  }

  /**
   * List preflight reports
   */
  async listReports(
    tenantId: string,
    filters?: {
      jobId?: string;
      status?: string;
      limit?: number;
      offset?: number;
    }
  ): Promise<PreflightReport[]> {
    let query = `
      SELECT * FROM preflight_reports
      WHERE tenant_id = $1 AND deleted_at IS NULL
    `;
    const params: any[] = [tenantId];
    let paramIndex = 2;

    if (filters?.jobId) {
      query += ` AND job_id = $${paramIndex++}`;
      params.push(filters.jobId);
    }

    if (filters?.status) {
      query += ` AND status = $${paramIndex++}`;
      params.push(filters.status);
    }

    query += ` ORDER BY created_at DESC`;

    if (filters?.limit) {
      query += ` LIMIT $${paramIndex++}`;
      params.push(filters.limit);
    }

    if (filters?.offset) {
      query += ` OFFSET $${paramIndex++}`;
      params.push(filters.offset);
    }

    const result = await this.db.query(query, params);
    return result.rows.map(this.mapReportRow);
  }

  /**
   * Get preflight issues for a report
   */
  async getReportIssues(reportId: string): Promise<PreflightIssue[]> {
    const result = await this.db.query(
      `SELECT * FROM preflight_issues
       WHERE preflight_report_id = $1
       ORDER BY issue_type DESC, severity DESC, page_number`,
      [reportId]
    );

    return result.rows.map(this.mapIssueRow);
  }

  /**
   * Approve preflight report
   */
  async approveReport(
    id: string,
    userId: string,
    notes?: string
  ): Promise<PreflightReport> {
    const result = await this.db.query(
      `UPDATE preflight_reports
       SET approved_by = $1,
           approved_at = NOW(),
           approval_notes = $2,
           updated_at = NOW(),
           updated_by = $1
       WHERE id = $3 AND deleted_at IS NULL
       RETURNING *`,
      [userId, notes, id]
    );

    if (result.rows.length === 0) {
      throw new Error(`Preflight report ${id} not found`);
    }

    // Create audit log
    await this.createAuditLog({
      reportId: id,
      action: 'APPROVED',
      performedBy: userId,
      notes: notes || 'Report approved'
    });

    return this.mapReportRow(result.rows[0]);
  }

  /**
   * Reject preflight report
   */
  async rejectReport(
    id: string,
    userId: string,
    reason: string
  ): Promise<PreflightReport> {
    const result = await this.db.query(
      `UPDATE preflight_reports
       SET rejected_by = $1,
           rejected_at = NOW(),
           rejection_reason = $2,
           updated_at = NOW(),
           updated_by = $1
       WHERE id = $3 AND deleted_at IS NULL
       RETURNING *`,
      [userId, reason, id]
    );

    if (result.rows.length === 0) {
      throw new Error(`Preflight report ${id} not found`);
    }

    // Create audit log
    await this.createAuditLog({
      reportId: id,
      action: 'REJECTED',
      performedBy: userId,
      notes: reason
    });

    return this.mapReportRow(result.rows[0]);
  }

  /**
   * Get preflight statistics for tenant
   */
  async getStatistics(tenantId: string): Promise<any> {
    const result = await this.db.query(
      `SELECT * FROM vw_preflight_pass_rates WHERE tenant_id = $1`,
      [tenantId]
    );

    if (result.rows.length === 0) {
      return {
        tenantId,
        totalReports: 0,
        passed: 0,
        passedWithWarnings: 0,
        failed: 0,
        passRatePercent: 0,
        avgProcessingTimeMs: 0
      };
    }

    const row = result.rows[0];
    return {
      tenantId: row.tenant_id,
      totalReports: parseInt(row.total_reports),
      passed: parseInt(row.passed),
      passedWithWarnings: parseInt(row.passed_with_warnings),
      failed: parseInt(row.failed),
      passRatePercent: parseFloat(row.pass_rate_percent),
      avgProcessingTimeMs: parseFloat(row.avg_processing_time_ms)
    };
  }

  /**
   * Get most common preflight errors
   */
  async getErrorFrequency(tenantId: string, limit: number = 10): Promise<any[]> {
    const result = await this.db.query(
      `SELECT
        pi.error_code,
        pi.severity,
        COUNT(*) as error_count,
        MAX(pi.created_at) as last_occurrence,
        array_agg(DISTINCT pi.message) as example_messages
       FROM preflight_issues pi
       JOIN preflight_reports pr ON pi.preflight_report_id = pr.id
       WHERE pr.tenant_id = $1
         AND pi.issue_type = 'ERROR'
         AND pi.created_at > NOW() - INTERVAL '30 days'
         AND pr.deleted_at IS NULL
       GROUP BY pi.error_code, pi.severity
       ORDER BY error_count DESC
       LIMIT $2`,
      [tenantId, limit]
    );

    return result.rows.map(row => ({
      errorCode: row.error_code,
      severity: row.severity,
      errorCount: parseInt(row.error_count),
      lastOccurrence: row.last_occurrence,
      exampleMessages: row.example_messages
    }));
  }

  /**
   * Create audit log entry
   */
  private async createAuditLog(input: {
    reportId: string;
    action: string;
    performedBy: string;
    notes?: string;
    metadata?: any;
  }): Promise<void> {
    await this.db.query(
      `INSERT INTO preflight_audit_log (
        preflight_report_id, action, performed_by, notes, metadata
      ) VALUES ($1, $2, $3, $4, $5)`,
      [
        input.reportId,
        input.action,
        input.performedBy,
        input.notes,
        input.metadata ? JSON.stringify(input.metadata) : null
      ]
    );
  }

  /**
   * Map database row to PreflightProfile
   */
  private mapProfileRow(row: any): PreflightProfile {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      profileName: row.profile_name,
      profileType: row.profile_type,
      version: row.version,
      rules: row.rules,
      isDefault: row.is_default,
      isActive: row.is_active
    };
  }

  /**
   * Map database row to PreflightReport
   */
  private mapReportRow(row: any): PreflightReport {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      jobId: row.job_id,
      estimateId: row.estimate_id,
      artworkFileId: row.artwork_file_id,
      fileName: row.file_name,
      fileSizeBytes: row.file_size_bytes,
      fileHash: row.file_hash,
      preflightProfileId: row.preflight_profile_id,
      profileVersion: row.profile_version,
      status: row.status,
      totalErrors: row.total_errors || 0,
      totalWarnings: row.total_warnings || 0,
      totalInfo: row.total_info || 0,
      pdfVersion: row.pdf_version,
      pageCount: row.page_count,
      colorSpace: row.color_space,
      processingTimeMs: row.processing_time_ms,
      processedAt: row.processed_at
    };
  }

  /**
   * Map database row to PreflightIssue
   */
  private mapIssueRow(row: any): PreflightIssue {
    return {
      id: row.id,
      preflightReportId: row.preflight_report_id,
      issueType: row.issue_type,
      errorCode: row.error_code,
      severity: row.severity,
      pageNumber: row.page_number,
      elementType: row.element_type,
      message: row.message,
      suggestedFix: row.suggested_fix,
      elementName: row.element_name,
      elementMetadata: row.element_metadata
    };
  }
}
