/**
 * Unit tests for audit output parsing
 * Tests the parseAuditResult function with various output formats
 */

describe('Audit Output Parsing', () => {
  // Mock parseAuditResult function (extracted from senior-auditor.daemon.ts)
  function parseAuditResult(
    output: string,
    auditType: 'startup' | 'daily' | 'manual',
    durationMinutes: number
  ): any {
    let jsonText = '';

    // First, try to extract from ```json ... ``` markdown blocks
    const codeBlockMatch = output.match(/```json\s*([\s\S]*?)\s*```/);
    if (codeBlockMatch) {
      jsonText = codeBlockMatch[1];
    } else {
      // Fallback: look for raw JSON with "agent":"sam" field (non-greedy matching)
      const jsonMatch = output.match(/\{[\s\S]*?"agent"\s*:\s*"sam"[\s\S]*?\}/);
      if (jsonMatch) {
        jsonText = jsonMatch[0];
      }
    }

    if (jsonText) {
      try {
        return JSON.parse(jsonText);
      } catch (error) {
        // Parsing failed
      }
    }

    // Return a default result if parsing failed
    return {
      agent: 'sam',
      audit_type: auditType,
      timestamp: new Date().toISOString(),
      duration_minutes: durationMinutes,
      overall_status: 'WARNING',
      deployment_blocked: false,
      block_reasons: [],
      recommendations: ['Audit output could not be parsed - manual review required'],
    };
  }

  test('should parse JSON from markdown code block', () => {
    const output = `
Some audit output here...

\`\`\`json
{
  "agent": "sam",
  "audit_type": "startup",
  "timestamp": "2025-01-15T14:30:00Z",
  "duration_minutes": 45,
  "overall_status": "PASS",
  "deployment_blocked": false,
  "block_reasons": [],
  "recommendations": ["All systems healthy"]
}
\`\`\`

More text after...
`;

    const result = parseAuditResult(output, 'startup', 45);
    expect(result.agent).toBe('sam');
    expect(result.overall_status).toBe('PASS');
    expect(result.recommendations).toContain('All systems healthy');
  });

  test('should parse raw JSON without markdown wrapper', () => {
    const output = `
Some text...
{"agent": "sam", "audit_type": "daily", "timestamp": "2025-01-15T14:30:00Z", "duration_minutes": 30, "overall_status": "WARNING", "deployment_blocked": false, "block_reasons": [], "recommendations": ["Minor issues found"]}
More text...
`;

    const result = parseAuditResult(output, 'daily', 30);
    expect(result.agent).toBe('sam');
    expect(result.overall_status).toBe('WARNING');
    expect(result.recommendations).toContain('Minor issues found');
  });

  test('should handle multi-line formatted JSON without code block', () => {
    const output = `
Audit complete!
{
  "agent": "sam",
  "audit_type": "manual",
  "timestamp": "2025-01-15T14:30:00Z",
  "duration_minutes": 60,
  "overall_status": "FAIL",
  "deployment_blocked": true,
  "block_reasons": ["Critical security vulnerability"],
  "recommendations": ["Update package X"]
}
End of output.
`;

    const result = parseAuditResult(output, 'manual', 60);
    expect(result.agent).toBe('sam');
    expect(result.overall_status).toBe('FAIL');
    expect(result.deployment_blocked).toBe(true);
  });

  test('should return WARNING when no valid JSON found', () => {
    const output = `
This is just plain text output with no JSON at all.
The audit ran but didn't output the expected format.
`;

    const result = parseAuditResult(output, 'startup', 10);
    expect(result.overall_status).toBe('WARNING');
    expect(result.recommendations).toContain('Audit output could not be parsed - manual review required');
  });

  test('should return WARNING when JSON is malformed', () => {
    const output = `
\`\`\`json
{
  "agent": "sam",
  "audit_type": "startup"
  // Missing closing brace and malformed JSON
\`\`\`
`;

    const result = parseAuditResult(output, 'startup', 15);
    expect(result.overall_status).toBe('WARNING');
    expect(result.recommendations).toContain('Audit output could not be parsed - manual review required');
  });

  test('should use non-greedy matching to avoid capturing extra text', () => {
    const output = `
First object: {"agent": "sam", "audit_type": "daily", "timestamp": "2025-01-15T14:30:00Z", "duration_minutes": 20, "overall_status": "PASS", "deployment_blocked": false, "block_reasons": [], "recommendations": ["Good"]}
Second object: {"some": "other", "json": "data"}
`;

    const result = parseAuditResult(output, 'daily', 20);
    expect(result.agent).toBe('sam');
    expect(result.overall_status).toBe('PASS');
    // Should NOT have captured the second object
    expect(result.some).toBeUndefined();
  });

  test('should handle JSON with nested objects', () => {
    const output = `
\`\`\`json
{
  "agent": "sam",
  "audit_type": "startup",
  "timestamp": "2025-01-15T14:30:00Z",
  "duration_minutes": 40,
  "overall_status": "PASS",
  "deployment_blocked": false,
  "block_reasons": [],
  "recommendations": ["All good"],
  "details": {
    "security_checks": 10,
    "passed": 10
  }
}
\`\`\`
`;

    const result = parseAuditResult(output, 'startup', 40);
    expect(result.agent).toBe('sam');
    expect(result.overall_status).toBe('PASS');
    expect(result.details).toBeDefined();
    expect(result.details.security_checks).toBe(10);
  });
});
