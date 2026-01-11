/**
 * Column Semantic Service
 * Enforces column semantic governance across the codebase
 *
 * Key features:
 * - Register column semantic meanings
 * - Validate new column usage against registry
 * - Hard block on semantic overloading
 * - Track column usage across tables
 */

import { getSDLCDatabase, SDLCDatabaseService } from './sdlc-database.service';

// ============================================================================
// Types
// ============================================================================

export interface ColumnSemanticEntry {
  id: string;
  columnName: string;
  semanticType: 'pk' | 'fk' | 'attribute' | 'audit' | 'status' | 'junction';
  referencesTable: string | null;
  referencesColumn: string | null;
  dataType: string;
  definedByBu: string;
  definedInTable: string;
  semanticDescription: string;
  validUsageExamples: string[];
  createdAt: Date;
  createdByAgent: string | null;
}

export interface ColumnValidationResult {
  isValid: boolean;
  action: 'registered' | 'consistent' | 'blocked';
  reason: string;
  existingDefinition?: ColumnSemanticEntry;
  suggestedAlternatives?: string[];
}

export interface ColumnDefinition {
  name: string;
  table: string;
  semanticType: ColumnSemanticEntry['semanticType'];
  referencesTable?: string;
  referencesColumn?: string;
  dataType: string;
  description?: string;
}

// ============================================================================
// Service
// ============================================================================

export class ColumnSemanticService {
  private db: SDLCDatabaseService;

  constructor() {
    this.db = getSDLCDatabase();
  }

  // ==========================================================================
  // Column Registry Operations
  // ==========================================================================

  /**
   * Get column by name
   */
  async getColumn(columnName: string): Promise<ColumnSemanticEntry | null> {
    const query = 'SELECT * FROM column_semantic_registry WHERE column_name = $1';
    const result = await this.db.queryOne<any>(query, [columnName]);
    return result ? this.mapColumnRow(result) : null;
  }

  /**
   * Get all registered columns
   */
  async getAllColumns(): Promise<ColumnSemanticEntry[]> {
    const query = 'SELECT * FROM column_semantic_registry ORDER BY column_name';
    const results = await this.db.query<any>(query);
    return results.map(this.mapColumnRow);
  }

  /**
   * Get columns by semantic type
   */
  async getColumnsByType(semanticType: ColumnSemanticEntry['semanticType']): Promise<ColumnSemanticEntry[]> {
    const query = 'SELECT * FROM column_semantic_registry WHERE semantic_type = $1 ORDER BY column_name';
    const results = await this.db.query<any>(query, [semanticType]);
    return results.map(this.mapColumnRow);
  }

  /**
   * Get columns defined by a BU
   */
  async getColumnsByBu(buCode: string): Promise<ColumnSemanticEntry[]> {
    const query = 'SELECT * FROM column_semantic_registry WHERE defined_by_bu = $1 ORDER BY column_name';
    const results = await this.db.query<any>(query, [buCode]);
    return results.map(this.mapColumnRow);
  }

  /**
   * Register a new column semantic definition
   */
  async registerColumn(
    column: ColumnDefinition,
    requestingBu: string,
    agent?: string
  ): Promise<ColumnSemanticEntry> {
    const query = `
      INSERT INTO column_semantic_registry (
        column_name, semantic_type, references_table, references_column,
        data_type, defined_by_bu, defined_in_table, semantic_description,
        valid_usage_examples, created_by_agent
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (column_name) DO UPDATE SET
        semantic_description = EXCLUDED.semantic_description,
        valid_usage_examples = column_semantic_registry.valid_usage_examples ||
          EXCLUDED.valid_usage_examples
      RETURNING *
    `;

    const description = column.description || this.generateDescription(column);
    const usageExample = `${column.table}.${column.name}`;

    const result = await this.db.queryOne<any>(query, [
      column.name,
      column.semanticType,
      column.referencesTable || null,
      column.referencesColumn || null,
      column.dataType,
      requestingBu,
      column.table,
      description,
      JSON.stringify([usageExample]),
      agent || 'system',
    ]);

    console.log(`[ColumnSemantic] Registered column: ${column.name} (${column.semanticType})`);

    return this.mapColumnRow(result);
  }

  // ==========================================================================
  // Validation (HARD BLOCK on semantic overloading)
  // ==========================================================================

  /**
   * Validate a new column usage against the registry
   * This is the CORE governance function - blocks semantic overloading
   */
  async validateColumn(column: ColumnDefinition, requestingBu: string): Promise<ColumnValidationResult> {
    const existing = await this.getColumn(column.name);

    // Case 1: New column - register it
    if (!existing) {
      await this.registerColumn(column, requestingBu);
      return {
        isValid: true,
        action: 'registered',
        reason: `Column '${column.name}' registered as ${column.semanticType} for the first time`,
      };
    }

    // Case 2: Check semantic type consistency
    if (column.semanticType !== existing.semanticType) {
      return {
        isValid: false,
        action: 'blocked',
        reason:
          `SEMANTIC OVERLOAD BLOCKED: Column '${column.name}' is registered as ` +
          `${existing.semanticType} (${existing.semanticDescription}), ` +
          `but you're trying to use it as ${column.semanticType}`,
        existingDefinition: existing,
        suggestedAlternatives: this.suggestAlternatives(column.name, column.semanticType),
      };
    }

    // Case 3: For FK columns, check reference consistency
    if (column.semanticType === 'fk') {
      if (column.referencesTable !== existing.referencesTable) {
        return {
          isValid: false,
          action: 'blocked',
          reason:
            `REFERENCE MISMATCH BLOCKED: Column '${column.name}' must reference ` +
            `'${existing.referencesTable}', not '${column.referencesTable}'`,
          existingDefinition: existing,
          suggestedAlternatives: [
            `${column.referencesTable}_id`,
            `${column.referencesTable?.replace(/s$/, '')}_id`,
          ],
        };
      }
    }

    // Case 4: Data type check (warning, not block)
    if (column.dataType !== existing.dataType) {
      console.warn(
        `[ColumnSemantic] WARNING: Data type mismatch for '${column.name}': ` +
          `registered as ${existing.dataType}, using ${column.dataType}`
      );
    }

    // Case 5: Consistent usage - add to examples
    const usageExample = `${column.table}.${column.name}`;
    if (!existing.validUsageExamples.includes(usageExample)) {
      await this.addUsageExample(column.name, usageExample);
    }

    return {
      isValid: true,
      action: 'consistent',
      reason: `Column '${column.name}' usage is consistent with registry`,
      existingDefinition: existing,
    };
  }

  /**
   * Validate a SQL migration file
   * Scans for CREATE TABLE and ALTER TABLE statements
   */
  async validateMigration(sql: string, requestingBu: string): Promise<{
    isValid: boolean;
    errors: ColumnValidationResult[];
    warnings: string[];
    columnsChecked: number;
  }> {
    const errors: ColumnValidationResult[] = [];
    const warnings: string[] = [];
    let columnsChecked = 0;

    // Extract column definitions from CREATE TABLE statements
    const createTableRegex = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(\w+)\s*\(([\s\S]*?)\);/gi;
    let match;

    while ((match = createTableRegex.exec(sql)) !== null) {
      const tableName = match[1];
      const columnDefs = match[2];

      // Parse column definitions
      const columns = this.parseColumnDefinitions(tableName, columnDefs);

      for (const col of columns) {
        columnsChecked++;
        const result = await this.validateColumn(col, requestingBu);

        if (!result.isValid) {
          errors.push(result);
        } else if (result.action === 'registered') {
          warnings.push(`New column registered: ${col.table}.${col.name} (${col.semanticType})`);
        }
      }
    }

    // Extract ALTER TABLE ADD COLUMN statements
    const alterTableRegex = /ALTER\s+TABLE\s+(\w+)\s+ADD\s+(?:COLUMN\s+)?(\w+)\s+(\w+)/gi;

    while ((match = alterTableRegex.exec(sql)) !== null) {
      const tableName = match[1];
      const columnName = match[2];
      const dataType = match[3];

      const col = this.inferColumnDefinition(tableName, columnName, dataType);
      columnsChecked++;

      const result = await this.validateColumn(col, requestingBu);
      if (!result.isValid) {
        errors.push(result);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      columnsChecked,
    };
  }

  // ==========================================================================
  // Usage Tracking
  // ==========================================================================

  /**
   * Add a usage example to a column
   */
  async addUsageExample(columnName: string, example: string): Promise<void> {
    const query = `
      UPDATE column_semantic_registry
      SET valid_usage_examples = valid_usage_examples || $2::jsonb
      WHERE column_name = $1
        AND NOT valid_usage_examples ? $3
    `;

    await this.db.query(query, [columnName, JSON.stringify([example]), example]);
  }

  /**
   * Get all tables using a column
   */
  async getColumnUsage(columnName: string): Promise<string[]> {
    const column = await this.getColumn(columnName);
    return column?.validUsageExamples || [];
  }

  // ==========================================================================
  // Analytics
  // ==========================================================================

  /**
   * Get column semantic statistics
   */
  async getSemanticStats(): Promise<{
    totalColumns: number;
    byType: Record<string, number>;
    byBu: Record<string, number>;
    mostUsed: { columnName: string; usageCount: number }[];
  }> {
    const columns = await this.getAllColumns();

    const byType: Record<string, number> = {};
    const byBu: Record<string, number> = {};
    const usageCount: { columnName: string; usageCount: number }[] = [];

    for (const col of columns) {
      byType[col.semanticType] = (byType[col.semanticType] || 0) + 1;
      byBu[col.definedByBu] = (byBu[col.definedByBu] || 0) + 1;
      usageCount.push({
        columnName: col.columnName,
        usageCount: col.validUsageExamples.length,
      });
    }

    usageCount.sort((a, b) => b.usageCount - a.usageCount);

    return {
      totalColumns: columns.length,
      byType,
      byBu,
      mostUsed: usageCount.slice(0, 10),
    };
  }

  // ==========================================================================
  // Private Helpers
  // ==========================================================================

  private mapColumnRow(row: any): ColumnSemanticEntry {
    return {
      id: row.id,
      columnName: row.column_name,
      semanticType: row.semantic_type,
      referencesTable: row.references_table,
      referencesColumn: row.references_column,
      dataType: row.data_type,
      definedByBu: row.defined_by_bu,
      definedInTable: row.defined_in_table,
      semanticDescription: row.semantic_description,
      validUsageExamples: row.valid_usage_examples || [],
      createdAt: row.created_at,
      createdByAgent: row.created_by_agent,
    };
  }

  private generateDescription(column: ColumnDefinition): string {
    switch (column.semanticType) {
      case 'pk':
        return `Primary key for ${column.table}`;
      case 'fk':
        return `Foreign key referencing ${column.referencesTable}.${column.referencesColumn || 'id'}`;
      case 'audit':
        return `Audit timestamp for ${column.name.replace('_', ' ')}`;
      case 'status':
        return `Status flag indicating ${column.name.replace('is_', '').replace('_', ' ')}`;
      default:
        return `${column.name.replace(/_/g, ' ')} attribute`;
    }
  }

  private suggestAlternatives(columnName: string, intendedType: string): string[] {
    const base = columnName.replace(/_id$/, '').replace(/^is_/, '');

    switch (intendedType) {
      case 'fk':
        return [`${base}_ref`, `${base}_uuid`, `ref_${base}`];
      case 'attribute':
        return [`${base}_value`, `${base}_text`, `${base}_data`];
      case 'status':
        return [`is_${base}`, `has_${base}`, `${base}_status`];
      default:
        return [`${base}_custom`, `${base}_alt`];
    }
  }

  private parseColumnDefinitions(tableName: string, columnDefs: string): ColumnDefinition[] {
    const columns: ColumnDefinition[] = [];
    const lines = columnDefs.split(',').map((l) => l.trim());

    for (const line of lines) {
      // Skip constraints
      if (
        /^(PRIMARY|FOREIGN|UNIQUE|CHECK|CONSTRAINT)/i.test(line) ||
        line.startsWith('--')
      ) {
        continue;
      }

      const match = line.match(/^(\w+)\s+(\w+)/);
      if (match) {
        const [, name, dataType] = match;
        const col = this.inferColumnDefinition(tableName, name, dataType);
        columns.push(col);
      }
    }

    return columns;
  }

  private inferColumnDefinition(
    tableName: string,
    columnName: string,
    dataType: string
  ): ColumnDefinition {
    // Infer semantic type from naming conventions
    let semanticType: ColumnDefinition['semanticType'] = 'attribute';
    let referencesTable: string | undefined;

    if (columnName === 'id') {
      semanticType = 'pk';
    } else if (columnName.endsWith('_id')) {
      semanticType = 'fk';
      referencesTable = columnName.replace(/_id$/, '') + 's'; // customers_id → customers
    } else if (columnName.startsWith('is_') || columnName.startsWith('has_')) {
      semanticType = 'status';
    } else if (['created_at', 'updated_at', 'deleted_at', 'created_by', 'updated_by'].includes(columnName)) {
      semanticType = 'audit';
    }

    return {
      name: columnName,
      table: tableName,
      semanticType,
      referencesTable,
      referencesColumn: referencesTable ? 'id' : undefined,
      dataType: dataType.toUpperCase(),
    };
  }
}
