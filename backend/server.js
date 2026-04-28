const fastify = require('fastify')({ logger: true });
const fs = require('fs');
const fetch = require('node-fetch');
require('dotenv').config({ path: 'C:/startup/.env' });

const PORT = 3002;

fastify.register(require('@fastify/cors'), { origin: '*' });
fastify.register(require('@fastify/multipart'));

// Load HuggingFace API key
const hfApiKey = fs.readFileSync('C:/startup/.env', 'utf8').match(/HUGGING_FACE_API_KEY=(.+)/)[1].trim();

// Make sure reviews folder exists
const reviewsDir = 'C:/startup/projects/ai-code-review/reviews';
if (!fs.existsSync(reviewsDir)) fs.mkdirSync(reviewsDir, { recursive: true });

async function featureExtraction(input) {
  try {
    const response = await fetch('https://api-inference.huggingface.co/pipeline/feature-extraction/sentence-transformers/all-MiniLM-L6-v2', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${hfApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ inputs: input })
    });
    if (!response.ok) return null;
    return await response.json();
  } catch (e) {
    return null;
  }
}

function getSentiment(score) {
  if (score > 70) return 'positive';
  if (score > 40) return 'neutral';
  return 'negative';
}

function analyzeCodePatterns(code, language) {
  const issues = [];
  const suggestions = [];
  let score = 100;
  // Count occurrences not just presence
  const varCount = (code.match(/var /g) || []).length;
  const consoleCount = (code.match(/console\.log/g) || []).length;
  const todoCount = (code.match(/TODO|FIXME/g) || []).length;
  const awaitCount = (code.match(/await /g) || []).length;
  const tryCount = (code.match(/try\s*{/g) || []).length;

  if (consoleCount > 0) {
    issues.push(`${consoleCount} console.log statement(s) found - remove before production`);
    score -= consoleCount * 5;
  }
  if (varCount > 0) {
    issues.push(`${varCount} var declaration(s) found - use const or let instead`);
    score -= varCount * 8;
  }
  if (awaitCount > tryCount * 2 && awaitCount > 0) {
    issues.push(`${awaitCount} async operation(s) without proper try/catch error handling`);
    score -= awaitCount * 10;
  }
  if (todoCount > 0) {
    issues.push(`${todoCount} unresolved TODO/FIXME comment(s) found`);
    score -= todoCount * 5;
  }
  if (code.includes('hardcoded') || /[\"'][a-zA-Z0-9]{20,}[\"']/.test(code)) {
    issues.push('Possible hardcoded secret or API key detected');
    score -= 20;
  }
  if (code.length > 300 && (code.match(/\/\//g) || []).length < 2) {
    issues.push('Insufficient code comments for code length');
    score -= 10;
  }
  if (!code.includes('try') && code.includes('fetch(')) {
    issues.push('fetch() calls without error handling');
    score -= 15;
  }

  if (language === 'javascript' || language === 'nodejs') {
    suggestions.push('Use ESLint for consistent code style');
    suggestions.push('Consider adding JSDoc comments for functions');
    if (code.includes('require(')) {
      suggestions.push('Consider migrating to ES modules (import/export)');
    }
    if (varCount > 0) {
      suggestions.push('Replace all var with const for constants and let for variables');
    }
    if (consoleCount > 2) {
      suggestions.push('Consider using a logging library like winston or pino');
    }
  }
  if (language === 'vue') {
    suggestions.push('Ensure all components have proper prop validation');
    suggestions.push('Use Composition API for better code organization');
  }

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

    // Analyze code patterns
    const { issues, suggestions, score } = analyzeCodePatterns(code, language.toLowerCase());

    // Get sentiment based on score
    const sentiment = getSentiment(score);

    // Try HuggingFace feature extraction (optional, won't break if fails)
    await featureExtraction(code);

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
    const filePath = `${reviewsDir}/${timestamp}-${filename}.json`;
    fs.writeFileSync(filePath, JSON.stringify(review, null, 2));

    reply.send(review);
  } catch (error) {
    request.log.error(error);
    reply.status(500).send({ error: error.message });
  }
});

fastify.get('/reviews', async (request, reply) => {
  try {
    const files = fs.readdirSync(reviewsDir).filter(f => f.endsWith('.json'));
    const reviews = files.map(file => {
      const content = fs.readFileSync(`${reviewsDir}/${file}`, 'utf8');
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
    const file = fs.readdirSync(reviewsDir).find(f => f.startsWith(id));
    if (!file) {
      return reply.status(404).send({ error: 'Review not found' });
    }
    const content = fs.readFileSync(`${reviewsDir}/${file}`, 'utf8');
    reply.send(JSON.parse(content));
  } catch (error) {
    request.log.error(error);
    reply.status(500).send({ error: error.message });
  }
});

const start = async () => {
  try {
    await fastify.listen({ port: PORT, host: '0.0.0.0' });
    console.log(`Server listening on port ${PORT}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();