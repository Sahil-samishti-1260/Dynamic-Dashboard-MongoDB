import fetch from 'node-fetch';

const testData = {
  database: "salesDB",
  filters: [{
    collection: "invoices",
    field: "amount",
    operator: "gt",
    value: 100
  }],
  useCache: true
};

console.log('Testing query with caching...');
console.log('Request data:', JSON.stringify(testData));

try {
  const response = await fetch('http://localhost:3000/query', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(testData)
  });

  const result = await response.json();
  console.log('Response:', result);
} catch (error) {
  console.error('Error:', error);
}