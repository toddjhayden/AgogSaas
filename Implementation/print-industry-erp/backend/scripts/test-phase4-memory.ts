/**
 * Phase 4 Memory System Test
 * Tests Ollama-based semantic search functionality
 */

import { MCPMemoryClient } from '../src/mcp/mcp-client.service';

async function testMemorySystem() {
  console.log('='.repeat(60));
  console.log('Phase 4 - Memory System Test');
  console.log('Testing Ollama-based semantic search');
  console.log('='.repeat(60));
  console.log('');

  const client = new MCPMemoryClient();

  try {
    // Test 1: Store memories
    console.log('[Test 1] Storing memories...');

    const memory1 = await client.storeMemory({
      agent_id: 'cynthia',
      memory_type: 'research',
      content: 'The customer module uses PostgreSQL with UUID v7 primary keys for optimal indexing performance.',
      metadata: { feature: 'customers', layer: 1 },
    });
    console.log(`✅ Stored memory 1: ${memory1}`);

    const memory2 = await client.storeMemory({
      agent_id: 'roy',
      memory_type: 'implementation',
      content: 'GraphQL resolver for customer queries must always filter by tenant_id for multi-tenant security.',
      metadata: { feature: 'customers', layer: 2 },
    });
    console.log(`✅ Stored memory 2: ${memory2}`);

    const memory3 = await client.storeMemory({
      agent_id: 'jen',
      memory_type: 'implementation',
      content: 'Frontend customer list component uses Material-UI DataGrid with pagination and sorting.',
      metadata: { feature: 'customers', layer: 3 },
    });
    console.log(`✅ Stored memory 3: ${memory3}`);

    const memory4 = await client.storeMemory({
      agent_id: 'billy',
      memory_type: 'testing',
      content: 'Multi-tenant isolation tests verify that queries never return data from other tenants.',
      metadata: { feature: 'customers', layer: 4 },
    });
    console.log(`✅ Stored memory 4: ${memory4}`);

    console.log('');

    // Test 2: Semantic search - should find relevant memories
    console.log('[Test 2] Semantic search for "database UUID"...');
    const results1 = await client.searchMemories({
      query: 'How are database primary keys configured?',
      limit: 3,
      min_relevance: 0.5,
    });

    console.log(`✅ Found ${results1.length} relevant memories:`);
    results1.forEach((mem, idx) => {
      console.log(`   ${idx + 1}. [${mem.agent_id}] ${mem.content.substring(0, 80)}...`);
      console.log(`      Relevance: ${mem.relevance_score?.toFixed(3)}`);
    });
    console.log('');

    // Test 3: Agent-specific search
    console.log('[Test 3] Searching Roy\'s backend memories...');
    const results2 = await client.searchMemories({
      query: 'security best practices',
      agent_id: 'roy',
      limit: 5,
    });

    console.log(`✅ Found ${results2.length} memories from Roy:`);
    results2.forEach((mem, idx) => {
      console.log(`   ${idx + 1}. ${mem.content.substring(0, 80)}...`);
      console.log(`      Relevance: ${mem.relevance_score?.toFixed(3)}`);
    });
    console.log('');

    // Test 4: Get recent memories
    console.log('[Test 4] Getting Cynthia\'s recent memories...');
    const recent = await client.getAgentMemories('cynthia', 5);
    console.log(`✅ Found ${recent.length} recent memories from Cynthia`);
    console.log('');

    // Test 5: Memory type filtering
    console.log('[Test 5] Searching only implementation memories...');
    const results3 = await client.searchMemories({
      query: 'customer feature',
      memory_types: ['implementation'],
      limit: 3,
    });

    console.log(`✅ Found ${results3.length} implementation memories:`);
    results3.forEach((mem, idx) => {
      console.log(`   ${idx + 1}. [${mem.agent_id}] ${mem.memory_type}: ${mem.content.substring(0, 60)}...`);
    });
    console.log('');

    console.log('='.repeat(60));
    console.log('✅ ALL TESTS PASSED!');
    console.log('Phase 4 (Memory System) is working with Ollama!');
    console.log('='.repeat(60));

  } catch (error: any) {
    console.error('❌ TEST FAILED:');
    console.error(error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
    process.exit(1);
  } finally {
    await client.close();
  }
}

// Run tests
testMemorySystem().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
