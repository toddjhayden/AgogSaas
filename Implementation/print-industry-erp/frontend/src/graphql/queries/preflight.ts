import { gql } from '@apollo/client';

// =====================================================
// PREFLIGHT PROFILE QUERIES
// =====================================================

export const GET_PREFLIGHT_PROFILE = gql`
  query GetPreflightProfile($id: ID!) {
    preflightProfile(id: $id) {
      id
      tenantId
      profileName
      profileType
      description
      validationRules
      isActive
      isDefault
      supersededBy
      version
      createdAt
      createdBy
      updatedAt
      updatedBy
    }
  }
`;

export const GET_PREFLIGHT_PROFILES = gql`
  query GetPreflightProfiles(
    $tenantId: ID!
    $profileType: PreflightProfileType
    $isActive: Boolean
  ) {
    preflightProfiles(
      tenantId: $tenantId
      profileType: $profileType
      isActive: $isActive
    ) {
      id
      tenantId
      profileName
      profileType
      description
      validationRules
      isActive
      isDefault
      version
      createdAt
      updatedAt
    }
  }
`;

// =====================================================
// PREFLIGHT REPORT QUERIES
// =====================================================

export const GET_PREFLIGHT_REPORT = gql`
  query GetPreflightReport($id: ID!) {
    preflightReport(id: $id) {
      id
      tenantId
      profileId
      jobId
      estimateId
      status
      totalErrors
      totalWarnings
      totalInfo
      pdfMetadata {
        filename
        fileSizeBytes
        pageCount
        pdfVersion
        dimensions {
          widthPt
          heightPt
          widthInches
          heightInches
          widthMm
          heightMm
        }
        createdDate
        modifiedDate
        producer
        author
        title
        subject
        keywords
      }
      colorAnalysis {
        colorSpaces
        hasSpotColors
        spotColorNames
        cmykCoverage {
          cyan
          magenta
          yellow
          black
          total
        }
        rgbPixelCount
        cmykPixelCount
        grayPixelCount
      }
      imageAnalysis {
        totalImages
        minResolutionDpi
        maxResolutionDpi
        avgResolutionDpi
        lowResImageCount
        imageFormats
        totalImageSizeMb
      }
      fontAnalysis {
        totalFonts
        embeddedFonts
        subsetFonts
        missingFonts
        fontList
      }
      approvedBy
      approvedAt
      rejectedBy
      rejectedAt
      rejectionReason
      approverNotes
      validatedAt
      processingTimeMs
      createdAt
      updatedAt
    }
  }
`;

export const GET_PREFLIGHT_REPORTS = gql`
  query GetPreflightReports(
    $tenantId: ID
    $jobId: ID
    $status: PreflightStatus
    $limit: Int
    $offset: Int
  ) {
    preflightReports(
      tenantId: $tenantId
      jobId: $jobId
      status: $status
      limit: $limit
      offset: $offset
    ) {
      id
      tenantId
      profileId
      jobId
      estimateId
      status
      totalErrors
      totalWarnings
      totalInfo
      pdfMetadata {
        filename
        fileSizeBytes
        pageCount
        pdfVersion
      }
      approvedBy
      approvedAt
      rejectedBy
      rejectedAt
      validatedAt
      processingTimeMs
      createdAt
      updatedAt
    }
  }
`;

// =====================================================
// PREFLIGHT ISSUE QUERIES
// =====================================================

export const GET_PREFLIGHT_ISSUES = gql`
  query GetPreflightIssues($reportId: ID!) {
    preflightIssues(reportId: $reportId) {
      id
      reportId
      issueType
      severity
      errorCode
      errorMessage
      pageNumber
      elementType
      elementDetails
      suggestedFix
      createdAt
    }
  }
`;

// =====================================================
// PREFLIGHT STATISTICS QUERIES
// =====================================================

export const GET_PREFLIGHT_STATISTICS = gql`
  query GetPreflightStatistics($tenantId: ID!) {
    preflightStatistics(tenantId: $tenantId) {
      totalReports
      passRate
      passWithWarningsRate
      failRate
      errorRate
      avgProcessingTimeMs
      totalErrors
      totalWarnings
      reportsLast30Days
      reportsLast7Days
    }
  }
`;

export const GET_PREFLIGHT_ERROR_FREQUENCY = gql`
  query GetPreflightErrorFrequency($tenantId: ID!, $limit: Int) {
    preflightErrorFrequency(tenantId: $tenantId, limit: $limit) {
      errorCode
      errorMessage
      count
      severity
    }
  }
`;

// =====================================================
// COLOR PROOF QUERIES
// =====================================================

export const GET_COLOR_PROOF = gql`
  query GetColorProof($id: ID!) {
    colorProof(id: $id) {
      id
      tenantId
      reportId
      jobId
      proofType
      iccProfileName
      renderingIntent
      proofS3Key
      status
      deltaE
      targetColorSpace
      simulationColorSpace
      blackPointCompensation
      paperWhiteSimulation
      approvedBy
      approvedAt
      rejectedBy
      rejectedAt
      notes
      createdAt
      updatedAt
    }
  }
`;

export const GET_COLOR_PROOFS = gql`
  query GetColorProofs($jobId: ID!) {
    colorProofs(jobId: $jobId) {
      id
      reportId
      jobId
      proofType
      iccProfileName
      renderingIntent
      status
      deltaE
      approvedBy
      approvedAt
      createdAt
      updatedAt
    }
  }
`;

// =====================================================
// PREFLIGHT MUTATIONS
// =====================================================

export const CREATE_PREFLIGHT_PROFILE = gql`
  mutation CreatePreflightProfile($input: CreatePreflightProfileInput!) {
    createPreflightProfile(input: $input) {
      id
      profileName
      profileType
      description
      validationRules
      isActive
      isDefault
      version
      createdAt
    }
  }
`;

export const UPDATE_PREFLIGHT_PROFILE = gql`
  mutation UpdatePreflightProfile($id: ID!, $input: UpdatePreflightProfileInput!) {
    updatePreflightProfile(id: $id, input: $input) {
      id
      profileName
      profileType
      description
      validationRules
      isActive
      isDefault
      version
      supersededBy
      updatedAt
    }
  }
`;

export const VALIDATE_PDF = gql`
  mutation ValidatePdf($input: ValidatePdfInput!) {
    validatePdf(input: $input) {
      id
      tenantId
      profileId
      jobId
      estimateId
      status
      totalErrors
      totalWarnings
      totalInfo
      createdAt
    }
  }
`;

export const APPROVE_PREFLIGHT_REPORT = gql`
  mutation ApprovePreflightReport($id: ID!, $notes: String) {
    approvePreflightReport(id: $id, notes: $notes) {
      id
      status
      approvedBy
      approvedAt
      approverNotes
      updatedAt
    }
  }
`;

export const REJECT_PREFLIGHT_REPORT = gql`
  mutation RejectPreflightReport($id: ID!, $reason: String!) {
    rejectPreflightReport(id: $id, reason: $reason) {
      id
      status
      rejectedBy
      rejectedAt
      rejectionReason
      updatedAt
    }
  }
`;

// =====================================================
// COLOR PROOF MUTATIONS
// =====================================================

export const GENERATE_COLOR_PROOF = gql`
  mutation GenerateColorProof($input: GenerateColorProofInput!) {
    generateColorProof(input: $input) {
      id
      reportId
      jobId
      proofType
      iccProfileName
      renderingIntent
      status
      createdAt
    }
  }
`;

export const APPROVE_COLOR_PROOF = gql`
  mutation ApproveColorProof($id: ID!) {
    approveColorProof(id: $id) {
      id
      status
      approvedBy
      approvedAt
      updatedAt
    }
  }
`;

export const REJECT_COLOR_PROOF = gql`
  mutation RejectColorProof($id: ID!, $notes: String!) {
    rejectColorProof(id: $id, notes: $notes) {
      id
      status
      rejectedBy
      rejectedAt
      notes
      updatedAt
    }
  }
`;
