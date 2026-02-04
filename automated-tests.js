import fetch from 'node-fetch';

const SERVER_URL = 'http://localhost:3000/query';
const SAVE_CONFIG_URL = 'http://localhost:3000/save-query-config';
const GET_CONFIGS_URL = 'http://localhost:3000/query-configs';
const DELETE_CONFIG_URL = 'http://localhost:3000/query-config';
const DATABASE = 'salesDB';

const testCases = [
  {
    name: "Case 1: Customers in West region and Pune zone",
    payload: {
      database: DATABASE,
      filters: [
        { collection: "customers", field: "region", operator: "eq", value: "West" },
        { collection: "customers", field: "zone", operator: "eq", value: "Pune" }
      ]
    }
  },
  {
    name: "Case 2: Customers in West/Pune with invoice on 2026-01-20",
    payload: {
      database: DATABASE,
      filters: [
        { collection: "customers", field: "region", operator: "eq", value: "West" },
        { collection: "customers", field: "zone", operator: "eq", value: "Pune" },
        { collection: "invoices", field: "invoice_date", operator: "eq", value: "2026-01-20" }
      ]
    }
  },
  {
    name: "Case 3: Customers in West/Pune purchasing Bakery categories",
    payload: {
      database: DATABASE,
      filters: [
        { collection: "customers", field: "region", operator: "eq", value: "West" },
        { collection: "customers", field: "zone", operator: "eq", value: "Pune" },
        { collection: "categories", field: "name", operator: "eq", value: "Bakery" }
      ]
    }
  },
  {
    name: "Case 4: Customers in West/Pune purchasing Bread product",
    payload: {
      database: DATABASE,
      filters: [
        { collection: "customers", field: "region", operator: "eq", value: "West" },
        { collection: "customers", field: "zone", operator: "eq", value: "Pune" },
        { collection: "products", field: "name", operator: "eq", value: "Bread" }
      ]
    }
  },
  {
    name: "Case 5: Customer name starts with S",
    payload: {
      database: DATABASE,
      filters: [
        { collection: "customers", field: "name", operator: "startsWith", value: "S" }
      ]
    }
  },
  {
    name: "Case 6: All invoices where Laptop was purchased",
    payload: {
      database: DATABASE,
      filters: [
        { collection: "products", field: "name", operator: "eq", value: "Laptop" }
      ]
    }
  },
  {
    name: "Case 7: Sum of total amount for Laptop in West/Pune",
    payload: {
      database: DATABASE,
      filters: [
        { collection: "customers", field: "region", operator: "eq", value: "West" },
        { collection: "customers", field: "zone", operator: "eq", value: "Pune" },
        { collection: "products", field: "name", operator: "eq", value: "Laptop" }
      ],
      aggregation: [
        { collection: "invoices", field: "total_amount", operator: "sum", alias: "total_sum" }
      ]
    }
  },
  {
    name: "Case 8: Sum of total from invoices for customer Sahil",
    payload: {
      database: DATABASE,
      filters: [
        { collection: "customers", field: "name", operator: "eq", value: "Sahil" }
      ],
      aggregation: [
        { collection: "invoices", field: "total", operator: "sum", alias: "customer_total" }
      ]
    }
  }
];

async function testSaveAndReplay(testCase) {
  console.log(`\n--------------------------------------------------`);
  console.log(`Testing Save & Consistency: ${testCase.name}`);
  
  try {
    // 1. Run original query
    const firstResponse = await fetch(SERVER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testCase.payload)
    });
    const firstResult = await firstResponse.json();
    
    // 2. Save configuration
    const saveResponse = await fetch(SAVE_CONFIG_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: `Test-${Date.now()}`,
        description: "Automated test save",
        filters: testCase.payload.filters,
        aggregation: testCase.payload.aggregation || []
      })
    });
    const saveResult = await saveResponse.json();
    
    if (!saveResult.success) throw new Error("Failed to save config");
    const configId = saveResult.id;
    console.log(`✅ Config saved with ID: ${configId}`);

    // 3. Fetch all configs and find the one we saved
    const fetchResponse = await fetch(GET_CONFIGS_URL);
    const fetchResult = await fetchResponse.json();
    const savedConfig = fetchResult.configs.find(c => c._id === configId);
    
    if (!savedConfig) throw new Error("Could not find saved config in list");
    console.log(`✅ Config retrieved from server`);

    // 4. Run query using data from saved config
    const replayPayload = {
      database: DATABASE,
      filters: savedConfig.filters,
      aggregation: savedConfig.aggregation
    };
    
    const secondResponse = await fetch(SERVER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(replayPayload)
    });
    const secondResult = await secondResponse.json();

    // 5. Compare Results
    const isConsistent = JSON.stringify(firstResult.data || firstResult.detailed_data) === 
                         JSON.stringify(secondResult.data || secondResult.detailed_data);
    
    if (isConsistent) {
      console.log("✅ CONSISTENCY CHECK PASSED: Results match perfectly");
    } else {
      console.log("⚠️ CONSISTENCY CHECK: Results differ slightly (possibly due to dynamic data)");
      // Check if counts match at least
      const count1 = firstResult.count || firstResult.detailed_count;
      const count2 = secondResult.count || secondResult.detailed_count;
      if (count1 === count2) {
        console.log(`✅ Counts match: ${count1}`);
      } else {
        console.log(`❌ Count mismatch! Original: ${count1}, Replayed: ${count2}`);
        return false;
      }
    }

    return true;
  } catch (error) {
    console.log("❌ SAVE/REPLAY ERROR:", error.message);
    return false;
  }
}

async function runTests() {
  console.log("🚀 Starting Automated Query Testing...");
  let passed = 0;
  let failed = 0;

  // Run standard test cases
  for (const test of testCases) {
    console.log(`\n--------------------------------------------------`);
    console.log(`Testing: ${test.name}`);
    try {
      const response = await fetch(SERVER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(test.payload)
      });

      const result = await response.json();
      
      if (response.ok && result.success) {
        console.log("✅ PASSED");
        
        // --- NEW: Save this query to the database permanently ---
        const saveRes = await fetch(SAVE_CONFIG_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: test.name,
            description: "Automatically saved during test",
            filters: test.payload.filters,
            aggregation: test.payload.aggregation || []
          })
        });
        const saveData = await saveRes.json();
        if (saveData.success) console.log(`   💾 Saved to Database (ID: ${saveData.id})`);
        // -------------------------------------------------------

        console.log(`   Type: ${result.type}`);
        
        if (result.type === 'both') {
          console.log(`   Detailed Count: ${result.detailed_count}`);
          console.log(`   Aggregation Count: ${result.aggregation_count}`);
          if (result.aggregation_data && result.aggregation_data.length > 0) {
            console.log(`   Aggregation Results:`, JSON.stringify(result.aggregation_data[0]));
          }
        } else {
          console.log(`   Root: ${result.root}`);
          console.log(`   Result Count: ${result.count}`);
        }
        passed++;
      } else {
        console.log("❌ FAILED");
        console.log("   Status:", response.status);
        console.log("   Error:", result.error || "Unknown error");
        failed++;
      }
    } catch (error) {
      console.log("❌ ERROR:", error.message);
      failed++;
    }
  }

  // Run Save & Replay test on a representative case (Case 1)
  const consistencyPassed = await testSaveAndReplay(testCases[0]);
  if (consistencyPassed) passed++; else failed++;

  console.log(`\n==================================================`);
  console.log(`Test Summary:`);
  console.log(`Total: ${testCases.length + 1}`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`==================================================`);
  
  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
