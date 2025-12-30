/**
 * Journal Entry DTOs
 * REQ-STRATEGIC-AUTO-1767066329940
 */

export interface CreateJournalEntryLineDto {
  accountId: string;
  debitAmount?: number;
  creditAmount?: number;
  description?: string;
  departmentId?: string;
  projectId?: string;
  jobId?: string;
}

export interface CreateJournalEntryDto {
  tenantId: string;
  facilityId?: string;
  periodYear: number;
  periodMonth: number;
  entryDate: Date;
  entryType: 'MANUAL' | 'SYSTEM' | 'RECURRING' | 'REVERSING' | 'CLOSING';
  description: string;
  lines: CreateJournalEntryLineDto[];
  referenceNumber?: string;
  reversalDate?: Date; // For reversing entries
  requiresApproval?: boolean;
}

export interface ReverseJournalEntryDto {
  journalEntryId: string;
  reversalDate: Date;
  description?: string;
}

export interface JournalEntry {
  id: string;
  tenantId: string;
  facilityId?: string;
  entryNumber: string;
  periodYear: number;
  periodMonth: number;
  entryDate: Date;
  entryType: string;
  status: string;
  description: string;
  totalDebit: number;
  totalCredit: number;
  referenceNumber?: string;
  reversalDate?: Date;
  reversedByEntryId?: string;
  reversalOfEntryId?: string;
  createdAt: Date;
  createdBy: string;
  postedAt?: Date;
  postedBy?: string;
}

export interface JournalEntryLine {
  id: string;
  journalEntryId: string;
  accountId: string;
  debitAmount: number;
  creditAmount: number;
  description?: string;
  departmentId?: string;
  projectId?: string;
  jobId?: string;
}
