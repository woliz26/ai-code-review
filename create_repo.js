const https = require('https');
const fs = require('fs');

const token = fs.readFileSync('C:/startup/.env','utf8').match(/GITHUB_TOKEN=(.+)/)[1].trim();

const data = JSON.stringify({name:'ai-code-review',description:'AI Code Review Tool',private:false});

const options = {
  hostname: 'api.github.com',
  path: '/user/repos',
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ' + token,
    'User-Agent': 'clawdbot',
    'Content-Type': 'application/json'
  }
};

const req = https.request(options, res => {
  let d = '';
  res.on('data', c => d += c);
  res.on('end', () => {
    const r = JSON.parse(d);
    console.log('Repo URL:', r.html_url);
    console.log('Clone URL:', r.clone_url);
  });
});

req.on('error', error => {
  console.error(error);
});

req.write(data);
req.end();
