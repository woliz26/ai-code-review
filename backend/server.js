const fastify = require('fastify')({ logger: true });
const cors = require('@fastify/cors');
const multipart = require('@fastify/multipart');
const fs = require('fs');
const fetch = require('node-fetch');
require('dotenv').config({ path: 'C:/startup/.env' });

const PORT = 3002;

fastify.register(cors);
fastify.register(multipart);

// Load HuggingFace API key
const hfApiKey = fs.readFileSync('C:/startup/.env', 'utf8').match(/HUGGING_FACE_API_KEY=(.+)/)[1].trim();

async function featureExtraction(input) {
  const response = await fetch('https://api-inference.huggingface.co/feature-extraction/sentence-transformers/all-MiniLM-L6-v2', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${hfApiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify([input])
  });
  if (!response.ok) {
    throw new Error(`HuggingFace feature extraction API error: ${response.statusText}`);
  }
  const data = await response.json();
  return data;
}

async function textClassification(input) {
  const response = await fetch('https://api-inference.huggingface.co/models/distilbert-base-uncased-finetuned-sst-2-english', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${hfApiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(input)
  });
  if (!response.ok) {
    throw new Error(`HuggingFace text classification API error: ${response.statusText}`);
  }
  const data = await response.json();
  return data;
}

function analyzeCodePatterns(code, language) {
  const issues = [];
  const suggestions = [];

  // Check for common issues
  if (code.includes('console.log')) {
    issues.push('Console.log statements found - remove before production');
  }
  if (code.includes('var ')) {
    issues.push('Using var - use const or let instead');
  }
  if (!code.includes('try') && code.includes('await')) {
    issues.push('Async code without try/catch error handling');
  }
  if (code.includes('TODO') || code.includes('FIXME')) {
    issues.push('Unresolved TODO/FIXME comments found');
  }
  if (code.length > 500 && !code.includes('//')) {
    issues.push('No comments found in long code block');
  }

  // Suggestions
  if (language === 'javascript' || language === 'nodejs') {
    suggestions.push('Use ESLint for consistent code style');
    suggestions.push('Consider adding JSDoc comments for functions');
    if (code.includes('require(')) {
      suggestions.push('Consider migrating to ES modules (import/export)');
    }
  }
  if (language === 'vue') {
    suggestions.push('Ensure all components have proper prop validation');
    suggestions.push('Use Composition API for better code organization');
  }

  // Calculate score
  let score = 100;
  score -= issues.length * 10;
  if (score < 0) score = 0;
  return { issues, suggestions, score };
}

fastify.get('/health', async (request, reply) => {
  return { status: 'ok', service: 'AI Code Review Tool' };
});

fastify.post('/review', async (request, reply) => {
  try {
    const { code, language, filename } = request.body;
    if (!code || !language || !filename) {
      return reply.status(400).send({ error: 'Missing code, language, or filename' });
    }

    // Sentiment analysis
    const sentimentRes = await textClassification(code);
    let sentiment = 'neutral';
    if (sentimentRes && Array.isArray(sentimentRes) && sentimentRes.length > 0) {
      const labels = sentimentRes[0];
      if (labels && Array.isArray(labels)) {
        sentiment = labels[0].label.toLowerCase();
      }
    }

    // Feature extraction (not explicitly used for scoring here, but called as per requirements)
    await featureExtraction(code);

    // Analyze code patterns
    const { issues, suggestions, score } = analyzeCodePatterns(code, language.toLowerCase());

    const timestamp = Date.now();
    const reviewedAt = new Date().toISOString();

    const review = {
      id: timestamp,
      filename,
      language,
      score,
      sentiment,
      issues,
      suggestions,
      reviewedAt
    };

    // Save review to file
    const path = `C:/startup/projects/ai-code-review/reviews/${timestamp}-${filename}.json`;
    fs.writeFileSync(path, JSON.stringify(review, null, 2));

    reply.send(review);
  } catch (error) {
    request.log.error(error);
    reply.status(500).send({ error: error.message });
  }
});

fastify.get('/reviews', async (request, reply) => {
  try {
    const dir = 'C:/startup/projects/ai-code-review/reviews';
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
    const reviews = files.map(file => {
      const content = fs.readFileSync(`${dir}/${file}`, 'utf8');
      return JSON.parse(content);
    });
    reply.send(reviews);
  } catch (error) {
    request.log.error(error);
    reply.status(500).send({ error: error.message });
  }
});

fastify.get('/reviews/:id', async (request, reply) => {
  try {
    const id = request.params.id;
    const dir = 'C:/startup/projects/ai-code-review/reviews';
    const file = fs.readdirSync(dir).find(f => f.startsWith(id));
    if (!file) {
      return reply.status(404).send({ error: 'Review not found' });
    }
    const content = fs.readFileSync(`${dir}/${file}`, 'utf8');
    const review = JSON.parse(content);
    reply.send(review);
  } catch (error) {
    request.log.error(error);
    reply.status(500).send({ error: error.message });
  }
});

const start = async () => {
  try {
    await fastify.listen(PORT, '0.0.0.0');
    console.log(`Server listening on port ${PORT}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
