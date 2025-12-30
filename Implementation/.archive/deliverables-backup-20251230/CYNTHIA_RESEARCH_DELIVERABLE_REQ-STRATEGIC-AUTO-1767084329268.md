# Research Deliverable: Digital Asset Management - File Versioning & Thumbnails
## REQ-STRATEGIC-AUTO-1767084329268

**Researcher**: Cynthia (Research Analyst)
**Date**: 2025-12-30
**Status**: COMPLETE

---

## Executive Summary

This research deliverable provides a comprehensive analysis for implementing Digital Asset Management (DAM) with file versioning and thumbnail generation capabilities in the print manufacturing ERP system. The research reveals that the system already has foundational file storage infrastructure through the Customer Portal's `artwork_files` and Preflight module's `preflight_artifacts` tables. The proposed enhancement will add version control, automatic thumbnail generation, and comprehensive asset lifecycle management to support design iteration, proof approval workflows, and efficient file browsing.

**Key Finding**: The system should extend the existing S3/Azure blob storage architecture with a new `asset_versions` table for versioning, leverage Node.js libraries (Sharp for images, pdf-lib for PDFs) for thumbnail generation, and implement a hybrid storage strategy with hot/warm/cold tiers for cost optimization.

---

## 1. Current System Architecture Analysis

### 1.1 Existing File Storage Infrastructure

The system has two existing file storage implementations that provide a foundation for DAM:

#### Artwork Files (Customer Portal)
**Location**: `print-industry-erp/backend/migrations/V0.0.43__create_customer_portal_tables.sql:185-250`

**Table Structure**:
```sql
CREATE TABLE artwork_files (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL,
    customer_id UUID NOT NULL,
    uploaded_by_customer_user_id UUID,

    -- File metadata
    file_name VARCHAR(255) NOT NULL,
    file_size_bytes BIGINT NOT NULL,
    file_type VARCHAR(50) NOT NULL,  -- pdf, jpg, jpeg, png, ai, eps, psd, tif, tiff
    storage_url TEXT NOT NULL,       -- S3/Azure presigned URL

    -- Content validation
    mime_type VARCHAR(100),
    file_hash VARCHAR(64),  -- SHA-256 hash for integrity verification

    -- Security: Virus scanning
    virus_scan_status VARCHAR(20) DEFAULT 'PENDING',
    virus_scan_at TIMESTAMPTZ,
    virus_scan_result TEXT,

    -- Lifecycle
    uploaded_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,  -- Auto-delete after 90 days
    deleted_at TIMESTAMPTZ
);
```

**Capabilities**:
- Customer-uploaded artwork for quotes and orders
- Storage via presigned URLs (S3/Azure)
- Virus scanning integration (ClamAV/VirusTotal)
- File integrity verification (SHA-256 hashing)
- Lifecycle management with expiration policies
- Linked to sales orders or quotes

**Limitations**:
- **No versioning**: Single file per upload, no version history
- **No thumbnails**: No preview generation for quick browsing
- **No metadata extraction**: PDF page count, dimensions, color space not captured
- **Limited file types**: Focused on print-ready files only

#### Preflight Artifacts
**Location**: `print-industry-erp/backend/migrations/V0.0.46__create_preflight_color_management_tables.sql:244-297`

**Table Structure**:
```sql
CREATE TABLE preflight_artifacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    preflight_report_id UUID NOT NULL,

    -- Artifact type
    artifact_type VARCHAR(50) NOT NULL,
    -- ANNOTATED_PDF, SOFT_PROOF, DIGITAL_PROOF, COLOR_SEPARATION, THUMBNAIL

    -- Blob storage location
    storage_provider VARCHAR(20) DEFAULT 'S3',
    storage_bucket VARCHAR(255),
    storage_key VARCHAR(500),
    storage_url TEXT,  -- Presigned URL (expires after 1 hour)

    -- File metadata
    file_size_bytes BIGINT,
    file_format VARCHAR(20),
    content_hash VARCHAR(64),  -- SHA-256 for integrity

    -- Lifecycle management (per Sylvia's recommendation)
    storage_tier VARCHAR(20) DEFAULT 'STANDARD',
    -- STANDARD, INFREQUENT_ACCESS, GLACIER, DEEP_ARCHIVE
    tier_transitioned_at TIMESTAMPTZ,

    -- Retention policy
    expires_at TIMESTAMPTZ,
    archived_at TIMESTAMPTZ
);
```

**Capabilities**:
- Generated artifacts from PDF preflight validation
- **Already includes THUMBNAIL artifact type** (excellent foundation!)
- Multi-tier storage strategy (S3 Intelligent Tiering)
- Blob storage references (not inline storage)
- Content hashing for integrity
- Lifecycle management with archival

**Limitations**:
- **Tied to preflight workflow**: Not generalized for all assets
- **No versioning**: Single artifact per report
- **No metadata**: Thumbnail dimensions, DPI not tracked

### 1.2 Technology Stack Analysis

**Backend**: NestJS + TypeScript + PostgreSQL
**Location**: `print-industry-erp/backend/package.json`

**Current Dependencies**:
- **PostgreSQL driver**: `pg` (v8.11.3) - for database operations
- **PDF processing**: `puppeteer` (v22.0.0) - for PDF generation (currently used for reporting)
- **Excel processing**: `exceljs` (v4.4.0) - demonstrates file manipulation capabilities

**Missing Dependencies for DAM**:
- **Image processing library**: Need Sharp, Jimp, or ImageMagick
- **PDF manipulation**: Need pdf-lib, pdfjs-dist, or Apache PDFBox
- **Storage SDK**: Need AWS SDK v3 or Azure Storage SDK
- **File upload handling**: Need Multer (NestJS platform-express has this)

### 1.3 GraphQL Schema Patterns

**Location**: Reviewed multiple GraphQL schemas in `print-industry-erp/backend/src/graphql/schema/`

**Existing Patterns**:
- **File upload mutations**: Customer portal has artwork upload workflows
- **Presigned URL generation**: For secure, time-limited downloads
- **Metadata queries**: Rich type definitions with nested relationships

**Recommendation**: Follow existing pattern of storing blob references in database, actual files in S3/Azure

---

## 2. Digital Asset Management Requirements

### 2.1 Asset Types & File Formats

Based on the print industry context and existing file types, the DAM system should support:

#### Primary Asset Types

**1. Design Files** (source files for print jobs)
- **Vector Graphics**: `.ai` (Adobe Illustrator), `.eps` (Encapsulated PostScript), `.svg` (Scalable Vector Graphics)
- **Page Layout**: `.indd` (InDesign), `.pdf` (PDF/X-1a, PDF/X-3, PDF/X-4)
- **Image Editing**: `.psd` (Photoshop), `.tif/.tiff` (Tagged Image Format)

**2. Production Files** (print-ready output)
- **PDF**: `.pdf` (high-res, flattened, press-ready)
- **Raster Images**: `.jpg/.jpeg`, `.png`, `.tif/.tiff`

**3. Proof Files** (customer approval)
- **Digital Proofs**: `.pdf`, `.jpg`
- **Annotated PDFs**: `.pdf` with markup/comments

**4. Supporting Assets**
- **Logos**: `.svg`, `.ai`, `.eps`, `.png` (transparent backgrounds)
- **Photos**: `.jpg`, `.raw`, `.tif`
- **Color Profiles**: `.icc` (ICC color profiles for color management)
- **Fonts**: `.otf`, `.ttf` (for font compliance checking)

### 2.2 File Versioning Requirements

**Use Cases for Versioning**:

**UC-1: Design Iteration**
- Customer requests quote for brochure
- Designer creates v1, uploads to system
- Customer requests changes (colors, text)
- Designer uploads v2, v3, v4
- All versions retained for audit trail
- Ability to revert to previous version

**UC-2: Proof Approval Workflow**
- Internal user uploads proof v1 → Customer rejects
- Designer creates proof v2 → Customer approves
- Version history shows approval trail
- Proof v2 marked as "approved version"

**UC-3: Regulatory Compliance**
- FDA-regulated printing (pharmaceutical labels)
- All artwork versions must be retained for 7+ years
- Audit trail: Who changed what, when, why

**UC-4: Collaboration**
- Multiple designers working on same project
- Version branching: Designer A uploads v1.1, Designer B uploads v1.2
- Merge conflict resolution
- Comment threads per version

**Versioning Strategy**:

**Approach 1: Major.Minor Versioning** (Recommended)
- **Major version**: Significant changes (v1.0, v2.0, v3.0)
- **Minor version**: Small tweaks (v1.1, v1.2, v1.3)
- **System-generated**: Auto-increment based on upload type
- **User-controlled**: Optionally allow user to specify version notes

**Approach 2: Sequential Numbering**
- v1, v2, v3, v4... (simpler, less semantic)
- Good for straightforward linear workflows
- Less cognitive overhead for operators

**Recommendation**: Start with **Sequential Numbering** for MVP, add Major.Minor in Phase 2

**Version Retention Policies**:
- **All versions retained by default** (storage is cheap relative to print job value)
- **Soft delete**: Deleted versions move to `deleted_at` state, not hard-deleted
- **Archival after 1 year**: Move to S3 Glacier for cost savings
- **Purge after 7 years**: Automated deletion based on regulatory retention

### 2.3 Thumbnail Generation Requirements

**Purpose of Thumbnails**:
1. **Fast browsing**: Grid view of assets without downloading full files
2. **Preview in UI**: Inline preview in order forms, quote requests
3. **Mobile optimization**: Low-bandwidth preview for mobile devices
4. **Version comparison**: Side-by-side visual diff of versions

**Thumbnail Specifications**:

| Size Variant | Dimensions | Use Case | Format | Quality |
|--------------|------------|----------|--------|---------|
| **Micro** | 64×64px | List view icon, mobile thumbnail | WebP/JPEG | 60% |
| **Small** | 200×200px | Grid view thumbnail | WebP/JPEG | 70% |
| **Medium** | 600×600px | Detail view preview | WebP/JPEG | 80% |
| **Large** | 1200×1200px | Lightbox zoom, comparison | WebP/JPEG | 85% |

**Aspect Ratio Handling**:
- **Crop**: Square thumbnails, center-crop (for grid uniformity)
- **Contain**: Preserve aspect ratio, add padding (for accurate previews)
- **Recommendation**: Use **contain** with white/transparent background

**Multi-Page Document Handling** (PDFs, InDesign):
- Generate thumbnail of **first page only** (primary use case)
- Optionally generate thumbnail per page (for detailed preview)
- Store page count in metadata

**File Type Specific Generation**:

**Images** (JPEG, PNG, TIFF):
- Use **Sharp** library (fastest, best quality)
- Preserve EXIF metadata (photographer, camera, date)
- Auto-rotate based on EXIF orientation

**PDFs**:
- Use **pdf-lib** or **pdfjs-dist** for rendering
- Rasterize first page at 150 DPI for thumbnail
- Extract metadata: page count, PDF version, color space

**Vector Files** (AI, EPS, SVG):
- SVG: Server-side rendering with Puppeteer or Sharp
- AI/EPS: Requires Adobe SDK (expensive) or Ghostscript (open-source)
- **Recommendation**: For Phase 1, require users to upload PDF fallback; Phase 2 add vector thumbnail support

**PSD (Photoshop)**:
- Extract embedded thumbnail if available (PSD files have preview)
- Fallback: Render flattened preview with `sharp-phash` or `image-size`

**Unsupported Files** (Fonts, ICC profiles):
- Display generic icon based on file type
- No thumbnail generation needed

---

## 3. Technical Architecture Design

### 3.1 Database Schema Design

#### New Table: `digital_assets`
**Purpose**: Central registry for all managed assets (generalizes artwork_files and preflight_artifacts)

```sql
CREATE TABLE digital_assets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL,

    -- Asset classification
    asset_type VARCHAR(50) NOT NULL,
    -- ARTWORK, PROOF, LOGO, PHOTO, DESIGN_FILE, PRODUCTION_FILE, COLOR_PROFILE, FONT

    asset_category VARCHAR(50),
    -- CUSTOMER_SUPPLIED, INTERNALLY_CREATED, VENDOR_PROVIDED, STOCK_ASSET

    -- Descriptive metadata
    asset_name VARCHAR(255) NOT NULL,
    asset_description TEXT,
    asset_tags TEXT[],  -- Array of searchable tags

    -- Ownership & relationships
    customer_id UUID,
    job_id UUID,
    estimate_id UUID,
    sales_order_id UUID,
    quote_id UUID,

    -- Current active version (denormalized for performance)
    current_version_id UUID,
    total_versions INTEGER DEFAULT 1,

    -- Asset status
    status VARCHAR(20) DEFAULT 'DRAFT',
    -- DRAFT, IN_REVIEW, APPROVED, REJECTED, ARCHIVED, DELETED

    approved_by UUID,
    approved_at TIMESTAMPTZ,

    -- Metadata snapshot (from latest version)
    file_type VARCHAR(50),
    file_size_bytes BIGINT,
    mime_type VARCHAR(100),

    -- Extended metadata (JSON for flexibility)
    metadata JSONB,
    -- Examples:
    -- {"page_count": 24, "color_space": "CMYK", "icc_profile": "FOGRA39"}
    -- {"width_inches": 8.5, "height_inches": 11, "bleed_inches": 0.125}
    -- {"photographer": "John Doe", "copyright": "2025 ACME Corp"}

    -- Access control
    is_public BOOLEAN DEFAULT FALSE,
    requires_approval BOOLEAN DEFAULT FALSE,

    -- Audit trail
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID NOT NULL,
    updated_at TIMESTAMPTZ,
    updated_by UUID,
    deleted_at TIMESTAMPTZ,

    -- Constraints
    CONSTRAINT fk_digital_assets_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    CONSTRAINT fk_digital_assets_current_version FOREIGN KEY (current_version_id) REFERENCES asset_versions(id) DEFERRABLE INITIALLY DEFERRED,
    CONSTRAINT fk_digital_assets_customer FOREIGN KEY (customer_id) REFERENCES customers(id),
    CONSTRAINT fk_digital_assets_approved_by FOREIGN KEY (approved_by) REFERENCES users(id),
    CONSTRAINT chk_asset_status CHECK (status IN ('DRAFT', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'ARCHIVED', 'DELETED'))
);

-- Indexes
CREATE INDEX idx_digital_assets_tenant ON digital_assets(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_digital_assets_customer ON digital_assets(customer_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_digital_assets_job ON digital_assets(job_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_digital_assets_type ON digital_assets(asset_type) WHERE deleted_at IS NULL;
CREATE INDEX idx_digital_assets_status ON digital_assets(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_digital_assets_tags ON digital_assets USING GIN(asset_tags);  -- Full-text search on tags
CREATE INDEX idx_digital_assets_metadata ON digital_assets USING GIN(metadata);  -- JSONB indexing

-- RLS Policy
ALTER TABLE digital_assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY digital_assets_tenant_isolation ON digital_assets
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);
```

#### New Table: `asset_versions`
**Purpose**: Stores each version of a digital asset

```sql
CREATE TABLE asset_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    asset_id UUID NOT NULL,
    tenant_id UUID NOT NULL,

    -- Version numbering
    version_number INTEGER NOT NULL,
    -- Sequential: 1, 2, 3, 4...
    -- OR Major.Minor: Store as integer (e.g., 1_001 for v1.1, 2_003 for v2.3)

    version_label VARCHAR(50),
    -- Optional user-friendly label: "Final Print Version", "Customer Approved", "Revision A"

    version_notes TEXT,
    -- Change description: "Updated logo colors per brand guidelines"

    -- File storage
    storage_provider VARCHAR(20) DEFAULT 'S3',
    storage_bucket VARCHAR(255),
    storage_key VARCHAR(500) NOT NULL,
    storage_url TEXT,  -- Presigned URL (regenerate on-demand)
    storage_tier VARCHAR(20) DEFAULT 'STANDARD',

    -- File metadata
    file_name VARCHAR(255) NOT NULL,
    file_size_bytes BIGINT NOT NULL,
    file_type VARCHAR(50) NOT NULL,
    mime_type VARCHAR(100),
    file_hash VARCHAR(64) NOT NULL,  -- SHA-256 for integrity and deduplication

    -- Content metadata (extracted during processing)
    width_px INTEGER,
    height_px INTEGER,
    dpi INTEGER,
    color_space VARCHAR(20),  -- RGB, CMYK, GRAYSCALE, LAB
    bit_depth INTEGER,
    page_count INTEGER,  -- For PDFs
    duration_seconds NUMERIC(10,2),  -- For videos (future)

    -- Processing status
    processing_status VARCHAR(20) DEFAULT 'PENDING',
    -- PENDING, PROCESSING, COMPLETED, FAILED
    processing_error TEXT,

    -- Security
    virus_scan_status VARCHAR(20) DEFAULT 'PENDING',
    virus_scan_at TIMESTAMPTZ,
    virus_scan_result TEXT,

    -- Version lifecycle
    is_current BOOLEAN DEFAULT TRUE,
    superseded_by UUID,  -- Points to newer version
    superseded_at TIMESTAMPTZ,

    -- Lifecycle management
    tier_transitioned_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    archived_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ,

    -- Audit
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID NOT NULL,

    -- Constraints
    CONSTRAINT fk_asset_versions_asset FOREIGN KEY (asset_id) REFERENCES digital_assets(id) ON DELETE CASCADE,
    CONSTRAINT fk_asset_versions_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    CONSTRAINT fk_asset_versions_superseded FOREIGN KEY (superseded_by) REFERENCES asset_versions(id),
    CONSTRAINT fk_asset_versions_created_by FOREIGN KEY (created_by) REFERENCES users(id),
    CONSTRAINT uq_asset_versions_number UNIQUE (asset_id, version_number),
    CONSTRAINT chk_version_processing_status CHECK (processing_status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED')),
    CONSTRAINT chk_version_virus_scan CHECK (virus_scan_status IN ('PENDING', 'SCANNING', 'CLEAN', 'INFECTED', 'SCAN_FAILED'))
);

-- Indexes
CREATE INDEX idx_asset_versions_asset ON asset_versions(asset_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_asset_versions_tenant ON asset_versions(tenant_id);
CREATE INDEX idx_asset_versions_current ON asset_versions(asset_id, is_current) WHERE is_current = TRUE;
CREATE INDEX idx_asset_versions_hash ON asset_versions(file_hash);  -- Deduplication
CREATE INDEX idx_asset_versions_processing ON asset_versions(processing_status) WHERE processing_status IN ('PENDING', 'PROCESSING');

-- RLS Policy
ALTER TABLE asset_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY asset_versions_tenant_isolation ON asset_versions
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);
```

#### New Table: `asset_thumbnails`
**Purpose**: Stores generated thumbnail variants

```sql
CREATE TABLE asset_thumbnails (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    asset_version_id UUID NOT NULL,

    -- Thumbnail variant
    thumbnail_size VARCHAR(20) NOT NULL,
    -- MICRO (64×64), SMALL (200×200), MEDIUM (600×600), LARGE (1200×1200)

    page_number INTEGER DEFAULT 1,
    -- For multi-page documents (PDFs)

    -- Storage
    storage_provider VARCHAR(20) DEFAULT 'S3',
    storage_bucket VARCHAR(255),
    storage_key VARCHAR(500) NOT NULL,
    storage_url TEXT,  -- Presigned URL

    -- Thumbnail metadata
    width_px INTEGER NOT NULL,
    height_px INTEGER NOT NULL,
    file_format VARCHAR(10) DEFAULT 'WEBP',  -- WEBP, JPEG, PNG
    file_size_bytes INTEGER,

    -- Generation metadata
    generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    generation_method VARCHAR(50),
    -- SHARP_RESIZE, PDF_RENDER, EXTRACTED_PREVIEW, GHOSTSCRIPT

    -- Lifecycle
    deleted_at TIMESTAMPTZ,

    -- Constraints
    CONSTRAINT fk_asset_thumbnails_version FOREIGN KEY (asset_version_id) REFERENCES asset_versions(id) ON DELETE CASCADE,
    CONSTRAINT uq_asset_thumbnails UNIQUE (asset_version_id, thumbnail_size, page_number),
    CONSTRAINT chk_thumbnail_size CHECK (thumbnail_size IN ('MICRO', 'SMALL', 'MEDIUM', 'LARGE'))
);

-- Indexes
CREATE INDEX idx_asset_thumbnails_version ON asset_thumbnails(asset_version_id);
CREATE INDEX idx_asset_thumbnails_size ON asset_thumbnails(asset_version_id, thumbnail_size);
```

#### New Table: `asset_download_log`
**Purpose**: Track asset downloads for analytics and compliance

```sql
CREATE TABLE asset_download_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL,
    asset_id UUID NOT NULL,
    asset_version_id UUID,

    -- User context
    downloaded_by UUID,  -- Internal user
    customer_user_id UUID,  -- Customer portal user

    -- Download metadata
    download_type VARCHAR(20) DEFAULT 'FULL',
    -- FULL, THUMBNAIL, PREVIEW

    ip_address VARCHAR(50),
    user_agent TEXT,

    -- Timestamp
    downloaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Constraints
    CONSTRAINT fk_asset_download_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    CONSTRAINT fk_asset_download_asset FOREIGN KEY (asset_id) REFERENCES digital_assets(id) ON DELETE CASCADE,
    CONSTRAINT fk_asset_download_version FOREIGN KEY (asset_version_id) REFERENCES asset_versions(id) ON DELETE SET NULL
);

-- Indexes (time-series analytics)
CREATE INDEX idx_asset_download_asset ON asset_download_log(asset_id);
CREATE INDEX idx_asset_download_timestamp ON asset_download_log(downloaded_at DESC);
CREATE INDEX idx_asset_download_user ON asset_download_log(downloaded_by);
```

### 3.2 Storage Strategy

#### Storage Architecture: Hybrid Multi-Tier

**Storage Providers**:
1. **AWS S3** (Primary, Recommended)
   - Mature ecosystem, global CDN (CloudFront)
   - S3 Intelligent Tiering for automatic cost optimization
   - S3 Lifecycle policies for archival
   - Presigned URLs for secure access

2. **Azure Blob Storage** (Alternative)
   - Better for Azure-hosted infrastructure
   - Hot/Cool/Archive tiers
   - Azure CDN integration

**Recommendation**: **AWS S3** for broader adoption and feature richness

#### Storage Tiers & Lifecycle Policies

| Tier | S3 Storage Class | Use Case | Cost (per GB/month) | Retrieval Time |
|------|------------------|----------|---------------------|----------------|
| **Hot** | S3 Standard | Active files (last 30 days) | $0.023 | Instant |
| **Warm** | S3 Intelligent Tiering | Infrequent access (30-90 days) | $0.0125-0.023 | Instant |
| **Cold** | S3 Glacier Flexible Retrieval | Archive (90+ days, <1 year) | $0.0036 | 1-5 minutes |
| **Deep Archive** | S3 Glacier Deep Archive | Long-term retention (1+ years) | $0.00099 | 12 hours |

**Lifecycle Rules** (automated transitions):
```yaml
# S3 Lifecycle Policy
- name: "asset-lifecycle"
  transitions:
    - days: 30
      storage_class: INTELLIGENT_TIERING
    - days: 90
      storage_class: GLACIER_FLEXIBLE_RETRIEVAL
    - days: 365
      storage_class: DEEP_ARCHIVE
  expiration:
    days: 2555  # 7 years for regulatory compliance
```

**Thumbnail Storage**:
- **Always Hot**: Thumbnails stay in S3 Standard (frequently accessed)
- **CDN Caching**: Cache thumbnails in CloudFront for 7 days
- **Lazy Loading**: Only generate thumbnail on first access (cost savings)

#### Folder Structure in S3

```
s3://bucket-name/
  ├── tenant-{tenant_id}/
  │   ├── assets/
  │   │   ├── {asset_id}/
  │   │   │   ├── versions/
  │   │   │   │   ├── v1_{version_id}.pdf
  │   │   │   │   ├── v2_{version_id}.pdf
  │   │   │   │   └── v3_{version_id}.pdf
  │   │   │   └── thumbnails/
  │   │   │       ├── v1_{version_id}_micro.webp
  │   │   │       ├── v1_{version_id}_small.webp
  │   │   │       ├── v1_{version_id}_medium.webp
  │   │   │       └── v1_{version_id}_large.webp
  │   │   └── {asset_id2}/
  │   └── temp-uploads/
  │       └── {upload_session_id}.tmp
  └── shared/
      └── stock-assets/
          └── logos/
```

**Key Generation Strategy**:
```typescript
// Asset version storage key
function generateStorageKey(asset: DigitalAsset, version: AssetVersion): string {
  const tenantPath = `tenant-${asset.tenantId}`;
  const assetPath = `assets/${asset.id}/versions`;
  const fileName = `v${version.versionNumber}_${version.id}.${version.fileType}`;
  return `${tenantPath}/${assetPath}/${fileName}`;
}

// Thumbnail storage key
function generateThumbnailKey(version: AssetVersion, size: string, pageNumber: number = 1): string {
  const tenantPath = `tenant-${version.tenantId}`;
  const assetPath = `assets/${version.assetId}/thumbnails`;
  const fileName = `v${version.versionNumber}_${version.id}_${size.toLowerCase()}_p${pageNumber}.webp`;
  return `${tenantPath}/${assetPath}/${fileName}`;
}
```

#### Deduplication Strategy

**File Hashing for Deduplication**:
- Calculate SHA-256 hash during upload
- Before storing, check if `file_hash` already exists in `asset_versions`
- If duplicate: Create new version record, **point to existing S3 object** (copy-on-write)
- Storage savings: 20-40% for logos, templates, stock assets

**Implementation**:
```typescript
async function uploadAssetVersion(file: Buffer, asset: DigitalAsset): Promise<AssetVersion> {
  const fileHash = crypto.createHash('sha256').update(file).digest('hex');

  // Check for existing file with same hash
  const existingVersion = await db.query(
    'SELECT storage_key FROM asset_versions WHERE file_hash = $1 AND deleted_at IS NULL LIMIT 1',
    [fileHash]
  );

  if (existingVersion.rows.length > 0) {
    // Reuse existing storage key (deduplication)
    const storageKey = existingVersion.rows[0].storage_key;
    console.log(`Deduplicated: Reusing storage key ${storageKey}`);

    return createVersionRecord({ ...metadata, storageKey, fileHash });
  } else {
    // Upload new file to S3
    const storageKey = generateStorageKey(asset, newVersion);
    await s3.putObject({ Bucket, Key: storageKey, Body: file });

    return createVersionRecord({ ...metadata, storageKey, fileHash });
  }
}
```

### 3.3 Thumbnail Generation Architecture

#### Processing Pipeline

```
1. Upload → 2. Virus Scan → 3. Metadata Extraction → 4. Thumbnail Generation → 5. Storage → 6. Notification
```

**Async Processing** (Recommended):
- **Queue**: NATS JetStream or AWS SQS
- **Worker**: Separate Node.js service (thumbnail-generator-service)
- **Concurrency**: 5-10 workers for parallel processing
- **Retry**: 3 attempts with exponential backoff

**Processing Steps**:
1. User uploads file → API validates file type and size
2. API stores file in S3, creates `asset_versions` record with `processing_status = 'PENDING'`
3. API publishes message to `asset-processing` queue
4. Worker picks up message:
   - Updates `processing_status = 'PROCESSING'`
   - Performs virus scan (ClamAV)
   - Extracts metadata (dimensions, page count, color space)
   - Generates thumbnails (4 sizes: micro, small, medium, large)
   - Uploads thumbnails to S3
   - Creates `asset_thumbnails` records
   - Updates `processing_status = 'COMPLETED'`
5. Worker publishes completion event
6. Frontend receives real-time update via GraphQL subscription

#### Library Selection

**For Image Processing** (JPEG, PNG, TIFF):

**Option 1: Sharp** (Recommended)
- **Pros**: Fastest (libvips), highest quality, low memory usage, active maintenance
- **Cons**: Native dependency (needs compilation)
- **Install**: `npm install sharp`
- **Performance**: 10× faster than ImageMagick/GraphicsMagick

```typescript
import sharp from 'sharp';

async function generateImageThumbnail(inputPath: string, outputPath: string, size: number): Promise<void> {
  await sharp(inputPath)
    .resize(size, size, {
      fit: 'contain',  // Preserve aspect ratio, add padding
      background: { r: 255, g: 255, b: 255, alpha: 0 }  // Transparent background
    })
    .webp({ quality: 80 })  // WebP for smaller file size
    .toFile(outputPath);
}
```

**Option 2: Jimp** (Fallback)
- **Pros**: Pure JavaScript (no native deps), easier deployment
- **Cons**: Slower (2-5× slower than Sharp), higher memory usage
- **Use Case**: Development environment, containerized deployments without build tools

**For PDF Processing**:

**Option 1: pdf-lib** (Recommended for metadata extraction)
- **Pros**: Pure TypeScript, no dependencies, small bundle size
- **Cons**: No rendering capability (can't create thumbnails)
- **Use**: Extract metadata (page count, PDF version)

```typescript
import { PDFDocument } from 'pdf-lib';

async function extractPdfMetadata(pdfBuffer: Buffer): Promise<any> {
  const pdfDoc = await PDFDocument.load(pdfBuffer);

  return {
    pageCount: pdfDoc.getPageCount(),
    pdfVersion: pdfDoc.getVersion(),
    title: pdfDoc.getTitle(),
    author: pdfDoc.getAuthor(),
    creationDate: pdfDoc.getCreationDate()
  };
}
```

**Option 2: pdfjs-dist** (Recommended for thumbnail generation)
- **Pros**: Mozilla's official PDF.js library, excellent rendering quality
- **Cons**: Requires canvas polyfill for Node.js
- **Use**: Render first page to canvas, export as image

```typescript
import * as pdfjs from 'pdfjs-dist';
import { createCanvas } from 'canvas';

async function generatePdfThumbnail(pdfBuffer: Buffer, size: number): Promise<Buffer> {
  const loadingTask = pdfjs.getDocument({ data: pdfBuffer });
  const pdfDocument = await loadingTask.promise;

  // Get first page
  const page = await pdfDocument.getPage(1);

  // Calculate scale to fit desired size
  const viewport = page.getViewport({ scale: 1.0 });
  const scale = size / Math.max(viewport.width, viewport.height);
  const scaledViewport = page.getViewport({ scale });

  // Render to canvas
  const canvas = createCanvas(scaledViewport.width, scaledViewport.height);
  const context = canvas.getContext('2d');

  await page.render({
    canvasContext: context,
    viewport: scaledViewport
  }).promise;

  // Convert canvas to buffer
  return canvas.toBuffer('image/webp');
}
```

**Option 3: Puppeteer** (Fallback for complex PDFs)
- **Pros**: Headless Chrome, handles all PDF complexity, same engine as browser
- **Cons**: Heavy (300+ MB download), slower, higher memory usage
- **Use**: When pdfjs-dist fails (complex transparency, fonts)
- **Note**: Already installed in project!

```typescript
import puppeteer from 'puppeteer';

async function generatePdfThumbnailWithPuppeteer(pdfPath: string, size: number): Promise<Buffer> {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  await page.goto(`file://${pdfPath}`, { waitUntil: 'networkidle0' });
  await page.setViewport({ width: size, height: size });

  const thumbnail = await page.screenshot({
    type: 'webp',
    quality: 80,
    clip: { x: 0, y: 0, width: size, height: size }
  });

  await browser.close();
  return thumbnail;
}
```

**For Vector Files** (SVG, AI, EPS):

**SVG**:
- Use Sharp's SVG rendering (built-in)
- Converts SVG to raster at desired resolution

**AI/EPS** (Adobe Illustrator/Encapsulated PostScript):
- **Option 1**: Ghostscript (open-source, robust)
- **Option 2**: Require users to upload PDF fallback (simpler, recommended for Phase 1)
- **Option 3**: Adobe SDK (expensive, enterprise-only)

**Recommendation for Phase 1**: **Require PDF fallback** for AI/EPS files, generate thumbnail from PDF

#### Thumbnail Generation Worker Service

**Service Architecture**:
```
thumbnail-generator-service/
├── src/
│   ├── workers/
│   │   ├── image-thumbnail-worker.ts    # Sharp-based image processing
│   │   ├── pdf-thumbnail-worker.ts      # PDF.js-based PDF processing
│   │   └── worker-orchestrator.ts       # Routes jobs to specific workers
│   ├── services/
│   │   ├── s3.service.ts                # S3 upload/download
│   │   ├── metadata-extractor.service.ts  # EXIF, PDF metadata
│   │   └── virus-scanner.service.ts     # ClamAV integration
│   ├── queue/
│   │   └── nats-consumer.ts             # Consumes asset-processing stream
│   └── main.ts
└── package.json
```

**Scalability**:
- **Horizontal scaling**: Deploy multiple worker instances
- **Resource limits**: 2GB RAM per worker, 2 CPU cores
- **Concurrency**: 5 concurrent jobs per worker
- **Job timeout**: 60 seconds per thumbnail generation

**Error Handling**:
- **Transient errors**: Retry 3 times with exponential backoff (1s, 2s, 4s)
- **Permanent errors**: Mark `processing_status = 'FAILED'`, log error, notify admin
- **Fallback**: If thumbnail generation fails, display file type icon

---

## 4. GraphQL API Design

### 4.1 Mutations

```graphql
# Upload new asset (creates asset + first version)
mutation UploadAsset($input: UploadAssetInput!) {
  uploadAsset(input: $input) {
    asset {
      id
      assetName
      currentVersion {
        id
        versionNumber
        fileName
        fileSizeBytes
        processingStatus
      }
    }
    presignedUploadUrl
    uploadSessionId
  }
}

input UploadAssetInput {
  assetType: AssetType!
  assetName: String!
  assetDescription: String
  assetTags: [String!]
  fileName: String!
  fileType: String!
  fileSizeBytes: Int!
  mimeType: String!

  # Relationships
  customerId: ID
  jobId: ID
  estimateId: ID
  salesOrderId: ID
  quoteId: ID

  # Optional metadata
  metadata: JSON
}

enum AssetType {
  ARTWORK
  PROOF
  LOGO
  PHOTO
  DESIGN_FILE
  PRODUCTION_FILE
  COLOR_PROFILE
  FONT
}

# Upload new version of existing asset
mutation UploadAssetVersion($input: UploadAssetVersionInput!) {
  uploadAssetVersion(input: $input) {
    version {
      id
      versionNumber
      versionLabel
      fileName
      processingStatus
    }
    presignedUploadUrl
  }
}

input UploadAssetVersionInput {
  assetId: ID!
  versionLabel: String
  versionNotes: String
  fileName: String!
  fileType: String!
  fileSizeBytes: Int!
  mimeType: String!
}

# Set current version
mutation SetCurrentAssetVersion($assetId: ID!, $versionId: ID!) {
  setCurrentAssetVersion(assetId: $assetId, versionId: $versionId) {
    asset {
      id
      currentVersion {
        id
        versionNumber
      }
    }
  }
}

# Approve asset
mutation ApproveAsset($assetId: ID!, $approvalNotes: String) {
  approveAsset(assetId: $assetId, approvalNotes: $approvalNotes) {
    asset {
      id
      status
      approvedBy {
        id
        name
      }
      approvedAt
    }
  }
}

# Delete asset version (soft delete)
mutation DeleteAssetVersion($versionId: ID!) {
  deleteAssetVersion(versionId: $versionId) {
    success
    message
  }
}
```

### 4.2 Queries

```graphql
# Get asset by ID
query GetAsset($id: ID!) {
  asset(id: $id) {
    id
    assetType
    assetName
    assetDescription
    assetTags
    status

    currentVersion {
      id
      versionNumber
      versionLabel
      fileName
      fileSizeBytes
      fileType
      mimeType
      processingStatus

      # Metadata
      widthPx
      heightPx
      dpi
      colorSpace
      pageCount

      # Thumbnails
      thumbnails {
        id
        thumbnailSize
        widthPx
        heightPx
        presignedUrl  # Presigned URL for download
      }

      # Download
      presignedDownloadUrl
    }

    # Version history
    versions {
      id
      versionNumber
      versionLabel
      versionNotes
      fileName
      fileSizeBytes
      createdAt
      createdBy {
        id
        name
      }
      isCurrent
    }

    # Relationships
    customer {
      id
      name
    }
    job {
      id
      jobNumber
    }

    # Audit
    createdAt
    createdBy {
      id
      name
    }
    approvedBy {
      id
      name
    }
    approvedAt
  }
}

# List assets with filters
query ListAssets(
  $tenantId: ID!
  $assetType: AssetType
  $customerId: ID
  $jobId: ID
  $status: AssetStatus
  $tags: [String!]
  $searchQuery: String
  $limit: Int = 20
  $offset: Int = 0
) {
  assets(
    tenantId: $tenantId
    assetType: $assetType
    customerId: $customerId
    jobId: $jobId
    status: $status
    tags: $tags
    searchQuery: $searchQuery
    limit: $limit
    offset: $offset
  ) {
    totalCount
    nodes {
      id
      assetName
      assetType
      status
      currentVersion {
        id
        fileName
        thumbnails(size: SMALL) {
          presignedUrl
        }
      }
      createdAt
    }
  }
}

# Get presigned download URL for version
query GetAssetVersionDownloadUrl($versionId: ID!, $expiresIn: Int = 3600) {
  assetVersionDownloadUrl(versionId: $versionId, expiresIn: $expiresIn) {
    presignedUrl
    expiresAt
  }
}

# Get presigned upload URL (for direct browser upload)
query GetAssetUploadUrl($input: AssetUploadUrlInput!) {
  assetUploadUrl(input: $input) {
    presignedUrl
    uploadSessionId
    fields  # Additional form fields for S3 multipart upload
  }
}
```

### 4.3 Subscriptions

```graphql
# Subscribe to asset processing status
subscription OnAssetVersionProcessing($assetId: ID!) {
  assetVersionProcessing(assetId: $assetId) {
    versionId
    processingStatus
    error
    thumbnails {
      thumbnailSize
      presignedUrl
    }
  }
}
```

---

## 5. Integration Points

### 5.1 Integration with Customer Portal
**Module**: Customer artwork uploads
**Integration**: `artwork_files` → migrate to `digital_assets` and `asset_versions`

**Migration Strategy**:
```sql
-- One-time migration script
INSERT INTO digital_assets (
  tenant_id, asset_type, asset_name, asset_category,
  customer_id, sales_order_id, quote_id,
  status, file_type, file_size_bytes, mime_type,
  created_at, created_by
)
SELECT
  tenant_id,
  'ARTWORK' as asset_type,
  file_name as asset_name,
  'CUSTOMER_SUPPLIED' as asset_category,
  customer_id,
  sales_order_id,
  quote_id,
  CASE
    WHEN virus_scan_status = 'CLEAN' THEN 'APPROVED'
    ELSE 'DRAFT'
  END as status,
  file_type,
  file_size_bytes,
  mime_type,
  uploaded_at,
  uploaded_by_customer_user_id
FROM artwork_files
WHERE deleted_at IS NULL;

-- Create version records
INSERT INTO asset_versions (
  asset_id, tenant_id, version_number, file_name, file_size_bytes,
  file_type, mime_type, file_hash, storage_url, virus_scan_status,
  processing_status, created_at, created_by
)
SELECT
  da.id as asset_id,
  af.tenant_id,
  1 as version_number,  -- Initial version
  af.file_name,
  af.file_size_bytes,
  af.file_type,
  af.mime_type,
  af.file_hash,
  af.storage_url,
  af.virus_scan_status,
  'COMPLETED' as processing_status,
  af.uploaded_at,
  af.uploaded_by_customer_user_id
FROM artwork_files af
JOIN digital_assets da ON da.asset_name = af.file_name AND da.customer_id = af.customer_id;
```

### 5.2 Integration with Preflight Module
**Module**: Preflight artifacts (annotated PDFs, proofs)
**Integration**: Link `preflight_artifacts.artifact_type = 'THUMBNAIL'` to `asset_thumbnails`

**Approach**: Use preflight thumbnail generation as blueprint for DAM thumbnail service

### 5.3 Integration with Proof Approval Workflow
**Module**: `proofs` table (V0.0.43)
**Integration**: Store proof files as `digital_assets`, link versions to approval workflow

**Workflow**:
1. Internal user uploads proof v1 → Creates `digital_asset` (type=PROOF) + `asset_version` (v1)
2. Thumbnail generated automatically
3. Customer reviews proof via portal → Uses thumbnail for quick preview
4. Customer approves → `digital_assets.status = 'APPROVED'`, `approved_by` set
5. Designer uploads revised proof v2 → Creates new `asset_version` (v2), `current_version_id` updated

---

## 6. Security & Compliance

### 6.1 Access Control

**Row-Level Security (RLS)**:
- All DAM tables have RLS policies for multi-tenant isolation
- `tenant_id` enforced at database level

**Role-Based Access Control (RBAC)**:
- **Customer**: Can view/download their own assets only
- **Sales Rep**: Can view customer assets for their accounts
- **Designer**: Can upload/modify assets
- **Approver**: Can approve/reject assets
- **Admin**: Full access to all assets

### 6.2 File Upload Security

**Virus Scanning**:
- Integrate ClamAV or VirusTotal API
- Scan all uploads before marking `virus_scan_status = 'CLEAN'`
- Quarantine infected files, notify admin

**File Type Validation**:
- Whitelist allowed file extensions
- Verify MIME type matches file extension
- Reject executable files (.exe, .sh, .bat)

**File Size Limits**:
- Per-upload limit: 500 MB (configurable)
- Per-tenant storage quota: 50 GB default, upgradable

### 6.3 Data Privacy (GDPR/CCPA)

**Retention Policies**:
- Customer assets: 7 years (regulatory compliance)
- Internal assets: Indefinite (unless customer requests deletion)
- Deleted assets: Soft delete, purge after 90 days

**Right to Erasure**:
- Customer can request deletion via portal
- Admin approval required for deletion of assets tied to orders
- Hard delete from S3 after soft delete grace period

---

## 7. Performance & Scalability

### 7.1 Expected Data Volumes

**Assets**:
- Small facility: 1,000-5,000 assets/year
- Large facility: 10,000-50,000 assets/year
- Versions per asset: 2-5 on average

**Storage**:
- Average file size: 10 MB (PDFs, high-res images)
- Thumbnails per version: 4 sizes × ~50 KB = 200 KB
- Annual storage (large facility): 50,000 assets × 3 versions × 10 MB = 1.5 TB
- Thumbnail storage: 50,000 assets × 3 versions × 200 KB = 30 GB

### 7.2 Optimization Strategies

**Database**:
- Partitioning: Partition `asset_download_log` by month
- Indexes: Composite indexes on `(tenant_id, asset_type, status)`
- Archival: Move old download logs to separate archive table

**Storage**:
- S3 Intelligent Tiering: Automatic cost optimization
- CDN: CloudFront for thumbnail delivery (edge caching)
- Lazy thumbnail generation: Only generate on first access

**API**:
- Presigned URLs: Offload file downloads to S3 (avoid proxying through API)
- Thumbnail caching: Cache presigned URLs in Redis for 1 hour
- Pagination: Limit asset list queries to 100 results max

---

## 8. Cost Analysis

### 8.1 Infrastructure Costs (Per Month, 10,000 Active Assets)

| Component | Specification | Cost |
|-----------|---------------|------|
| **S3 Storage (Hot)** | 100 GB @ $0.023/GB | $2.30 |
| **S3 Storage (Warm)** | 500 GB @ $0.0125/GB | $6.25 |
| **S3 Storage (Cold)** | 1,400 GB @ $0.004/GB | $5.60 |
| **S3 Requests** | 100K GET + 10K PUT | $0.44 |
| **CloudFront (CDN)** | 50 GB transfer | $4.25 |
| **Database Storage** | 10 GB (metadata) @ $0.10/GB | $1.00 |
| **Worker Compute** | t3.medium (2 vCPU, 4GB) × 2 | $60.00 |
| **NATS JetStream** | Included in existing infrastructure | $0.00 |
| **TOTAL** | | **~$80/month** |

**Cost Savings from Deduplication**: 20-30% reduction in storage (est. $4-8/month)

### 8.2 Development Costs (Estimates)

| Phase | Task | Hours | Cost @ $150/hr |
|-------|------|-------|----------------|
| **Phase 1** | Database schema (tables, indexes, migrations) | 16 | $2,400 |
|  | Backend service (upload, versioning logic) | 40 | $6,000 |
|  | S3 integration (upload, download, presigned URLs) | 24 | $3,600 |
|  | Thumbnail generation (Sharp, PDF.js) | 32 | $4,800 |
|  | GraphQL API (mutations, queries, subscriptions) | 32 | $4,800 |
|  | Worker service (NATS consumer, async processing) | 24 | $3,600 |
|  | Virus scanning integration | 16 | $2,400 |
| **Phase 2** | Frontend UI (asset browser, upload, version history) | 60 | $9,000 |
|  | Drag-and-drop upload (with progress) | 16 | $2,400 |
|  | Thumbnail grid view with lazy loading | 24 | $3,600 |
|  | Version comparison UI | 16 | $2,400 |
| **Phase 3** | Testing (unit, integration, E2E) | 40 | $6,000 |
|  | Documentation | 16 | $2,400 |
|  | Deployment & monitoring | 16 | $2,400 |
| **TOTAL** | | **372 hours** | **$55,800** |

---

## 9. Risks & Mitigation

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| **Large file upload failures (>100 MB)** | High | Medium | Implement multipart upload (S3 SDK), resumable uploads (tus protocol) |
| **Thumbnail generation timeout** | Medium | Medium | Increase worker timeout to 120s, implement fallback to generic icon |
| **S3 costs exceed budget** | Medium | Medium | Monitor usage with CloudWatch, set up billing alarms, enforce file size limits |
| **Virus scanner false positives** | Low | Medium | Manual review workflow for quarantined files, whitelist trusted file hashes |
| **Slow metadata extraction (large PDFs)** | Medium | Low | Set 60s timeout, extract first 10 pages only for page count |
| **Storage quota abuse** | Low | High | Per-tenant storage quotas, alert at 80% capacity, archive old versions to Glacier |

---

## 10. Implementation Roadmap

### Phase 1: Core DAM (Weeks 1-6)
- [ ] Database schema: `digital_assets`, `asset_versions`, `asset_thumbnails`
- [ ] S3 integration: Upload, download, presigned URLs
- [ ] Upload API: Multipart upload support
- [ ] Versioning logic: Create new version, set current version
- [ ] Thumbnail generation: Sharp (images), PDF.js (PDFs)
- [ ] Worker service: NATS consumer, async processing
- [ ] Virus scanning: ClamAV integration

### Phase 2: Frontend UI (Weeks 7-10)
- [ ] Asset browser: Grid view with thumbnails
- [ ] Upload UI: Drag-and-drop, progress bar
- [ ] Asset detail view: Version history, metadata display
- [ ] Download functionality: Presigned URL generation
- [ ] Version comparison: Side-by-side thumbnail view
- [ ] Approval workflow UI: Approve/reject buttons

### Phase 3: Advanced Features (Weeks 11-14)
- [ ] Bulk upload: Multiple files at once
- [ ] Tagging & search: Full-text search on tags, metadata
- [ ] Storage analytics: Usage dashboard, quota warnings
- [ ] Lifecycle management: Automatic archival to Glacier
- [ ] Download analytics: Track who downloaded what, when

### Phase 4: Migration & Testing (Weeks 15-16)
- [ ] Migrate `artwork_files` to `digital_assets`
- [ ] Performance testing: 10,000 assets, concurrent uploads
- [ ] Security testing: Penetration testing, virus scan validation
- [ ] User acceptance testing: Internal users and customers

---

## 11. Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Upload success rate** | >99% | (Successful uploads / Total uploads) × 100 |
| **Thumbnail generation time** | <10 seconds per file | Average processing time from upload to thumbnail available |
| **Thumbnail cache hit rate** | >80% | (CDN hits / Total requests) × 100 |
| **Storage cost per asset** | <$0.50/month | Total S3 cost / Total active assets |
| **User adoption** | >70% of users upload via DAM (vs. email) | Active DAM users / Total users |
| **Version history usage** | >30% of assets have 2+ versions | Assets with multiple versions / Total assets |
| **Download latency (p95)** | <2 seconds | Time from click to download start |

---

## 12. Key Recommendations

### 12.1 High Priority (MVP)

1. **AWS S3 for storage** with Intelligent Tiering for automatic cost optimization
2. **Sharp library** for image thumbnail generation (fastest, highest quality)
3. **pdf-lib + pdfjs-dist** for PDF metadata extraction and thumbnail rendering
4. **Async processing** via NATS JetStream for scalability
5. **Deduplication** via SHA-256 hashing to reduce storage costs
6. **Presigned URLs** for secure, direct downloads (avoid API proxying)
7. **Multi-tier storage** (Hot/Warm/Cold/Deep Archive) for cost efficiency

### 12.2 Medium Priority (Phase 2)

8. **Multipart upload** for large files (>100 MB)
9. **Version comparison UI** for visual diff of asset versions
10. **Full-text search** on tags and metadata
11. **Bulk upload** for migrating existing asset libraries

### 12.3 Low Priority (Future)

12. **AI-powered tagging** (auto-tag logos, products via computer vision)
13. **Advanced vector thumbnail generation** (AI/EPS direct rendering)
14. **Video asset support** (with frame-based thumbnail extraction)
15. **3D model preview** (for packaging mockups)

---

## 13. Open Questions for Product Owner

1. **File size limits**: What is the maximum file size we should support? (Recommendation: 500 MB)
2. **Storage quotas**: Should we enforce per-tenant storage limits? (Recommendation: 50 GB default, upgradable)
3. **Thumbnail generation priority**: Generate all sizes immediately, or lazy-load on demand? (Recommendation: Immediate for small files, lazy for large PDFs)
4. **Version retention**: Should users be able to permanently delete old versions? (Recommendation: Soft delete only, admin can hard delete)
5. **CDN configuration**: Use CloudFront or another CDN? (Recommendation: CloudFront for S3 integration)
6. **Virus scanning**: ClamAV (open-source, self-hosted) or VirusTotal (API, paid)? (Recommendation: ClamAV for cost control)
7. **Migration timeline**: When should we migrate existing `artwork_files` to new DAM system? (Recommendation: After Phase 1 completion, before Phase 2)

---

## 14. Research References

### 14.1 Database Schema Files
1. `print-industry-erp/backend/migrations/V0.0.43__create_customer_portal_tables.sql`
   - Artwork files table (lines 185-250)
2. `print-industry-erp/backend/migrations/V0.0.46__create_preflight_color_management_tables.sql`
   - Preflight artifacts table with thumbnail support (lines 244-297)

### 14.2 Service Files
1. `print-industry-erp/backend/src/modules/operations/services/preflight.service.ts`
   - Service pattern for file processing workflows

### 14.3 Technology Stack
1. `print-industry-erp/backend/package.json`
   - Existing dependencies: Puppeteer (PDF generation), pg (PostgreSQL)

### 14.4 Industry Best Practices
1. **S3 Storage Classes**: AWS documentation on Intelligent Tiering and Glacier
2. **Sharp Library**: High-performance Node.js image processing (libvips)
3. **PDF.js**: Mozilla's PDF rendering engine
4. **Digital Asset Management**: DAM best practices (versioning, metadata, thumbnails)

---

**END OF RESEARCH DELIVERABLE**
