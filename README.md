# AI Code Review Tool

This project is an AI-powered code review tool built with Node.js (Fastify), Vue.js, and HuggingFace API. It analyzes code quality, detects issues, and provides suggestions.

## Features
- Backend with Fastify server and HuggingFace API integration
- Frontend built with Vue.js 3 single HTML file
- JSON-based review storage

## Setup
1. Ensure you have Node.js installed.
2. Install backend dependencies:
   ```
   cd backend
   npm install fastify @fastify/cors @fastify/multipart dotenv node-fetch
   ```
3. Start the backend server:
   ```
   node server.js
   ```
4. Open `frontend/index.html` in your browser.

## Usage
- Paste your code, select language, and filename.
- Click "Review Code" to get analysis.
- View recent reviews at the bottom.
