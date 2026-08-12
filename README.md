# BuildWise AI — Gemini Backend

This backend exists only to securely call the Gemini API for BuildWise AI.
Your existing frontend and localStorage data can remain unchanged.

## 1. Install

```bash
npm install
```

## 2. Add your Gemini key

Copy `.env.example` to `.env` and set:

```env
GEMINI_API_KEY=your_key_here
```

Do **not** commit `.env` to GitHub.

## 3. Run locally

```bash
npm start
```

The server runs on:

```text
http://localhost:3000
```

Health check:

```text
GET http://localhost:3000/health
```

## 4. Risk endpoint

```text
POST /api/analyze-risk
Content-Type: application/json
```

Example request:

```json
{
  "project": {
    "name": "Green Valley Apartments",
    "location": "Bengaluru",
    "status": "In Progress",
    "budget": 5000000,
    "spent": 4550000,
    "progress": 68,
    "deadline": "2026-12-20",
    "workers": 31
  },
  "risks": {
    "schedule": 81,
    "budget": 68,
    "materials": 76,
    "labour": 42,
    "overall": 73
  },
  "issues": [
    "7 overdue tasks",
    "Cement below minimum stock",
    "Labour shortage of 9 workers"
  ]
}
```

The response is structured JSON designed to be rendered directly in the BuildWise UI.

## 5. Connect BuildWise

From your frontend, call:

```js
const response = await fetch("http://localhost:3000/api/analyze-risk", {
  method: "POST",
  headers: {
    "Content-Type": "application/json"
  },
  body: JSON.stringify(payload)
});

const data = await response.json();
console.log(data.analysis);
```

For production, replace the URL with your Render backend URL.

## Deployment on Render

Create a new Web Service from this folder/repository.

- Build Command: `npm install`
- Start Command: `npm start`
- Environment variable: `GEMINI_API_KEY`
- Optional: `GEMINI_MODEL`
- Optional: `FRONTEND_ORIGIN`

Do not put the Gemini API key in the frontend.

## Current responsibility

This server does NOT store:
- projects
- workers
- materials
- expenses
- users

The frontend can continue using localStorage. The server receives the data needed for an analysis and returns Gemini's analysis.
