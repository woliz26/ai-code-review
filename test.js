const fetch = require('node-fetch');
(async () => {
  try {
    const response = await fetch('http://localhost:3002/review', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: "var x = 1; async function getData() { const result = await fetch('api/data'); console.log(result); // TODO: handle errors return result; }",
        language: 'javascript',
        filename: 'test.js'
      })
    });
    const data = await response.json();
    console.log('Review Response:', data);
  } catch (error) {
    console.error('Error posting review:', error);
  }
})();