import "dotenv/config";
import express from "express";
import cors from "cors";
import { GoogleGenAI } from "@google/genai";

const app = express();
const PORT = process.env.PORT || 3000;

if (!process.env.GEMINI_API_KEY) {
  console.error("Missing GEMINI_API_KEY environment variable.");
  process.exit(1);
}

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

app.use(cors({
  origin: process.env.FRONTEND_ORIGIN
    ? process.env.FRONTEND_ORIGIN.split(",").map((x) => x.trim())
    : true,
  methods: ["GET", "POST"],
}));

app.use(express.json({ limit: "256kb" }));

app.get("/", (_req, res) => {
  res.json({
    service: "BuildWise AI Gemini Backend",
    status: "online",
  });
});

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

function cleanNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function cleanString(value, fallback = "") {
  return typeof value === "string" ? value.slice(0, 1000) : fallback;
}

function normalizePayload(body = {}) {
  const project = body.project || {};
  const risks = body.risks || {};

  return {
    project: {
      name: cleanString(project.name, "Unnamed project"),
      location: cleanString(project.location),
      status: cleanString(project.status),
      budget: cleanNumber(project.budget),
      spent: cleanNumber(project.spent),
      progress: Math.max(0, Math.min(100, cleanNumber(project.progress))),
      deadline: cleanString(project.deadline),
      workers: cleanNumber(project.workers),
    },

    risks: {
      schedule: Math.max(0, Math.min(100, cleanNumber(risks.schedule))),
      budget: Math.max(0, Math.min(100, cleanNumber(risks.budget))),
      materials: Math.max(0, Math.min(100, cleanNumber(risks.materials))),
      labour: Math.max(0, Math.min(100, cleanNumber(risks.labour))),
      overall: Math.max(0, Math.min(100, cleanNumber(risks.overall))),
    },

    issues: Array.isArray(body.issues)
      ? body.issues
          .filter((x) => typeof x === "string")
          .slice(0, 20)
          .map((x) => x.slice(0, 500))
      : [],

    projects: Array.isArray(body.projects) ? body.projects.slice(0, 50) : [],
    workers: Array.isArray(body.workers) ? body.workers.slice(0, 100) : [],
    materials: Array.isArray(body.materials) ? body.materials.slice(0, 100) : [],
    expenses: Array.isArray(body.expenses) ? body.expenses.slice(0, 200) : [],
    safety: Array.isArray(body.safety) ? body.safety.slice(0, 100) : [],
  };
}

const riskSchema = {
  type: "object",
  properties: {
    severity: {
      type: "string",
      enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"],
    },
    headline: {
      type: "string",
    },
    summary: {
      type: "string",
    },
    topRisks: {
      type: "array",
      items: {
        type: "object",
        properties: {
          category: {
            type: "string",
            enum: ["SCHEDULE", "BUDGET", "MATERIALS", "LABOUR", "SAFETY", "OTHER"],
          },
          title: {
            type: "string",
          },
          explanation: {
            type: "string",
          },
          impact: {
            type: "string",
          },
        },
        required: ["category", "title", "explanation", "impact"],
      },
    },
    recommendations: {
      type: "array",
      items: {
        type: "object",
        properties: {
          priority: {
            type: "string",
            enum: ["URGENT", "HIGH", "MEDIUM", "LOW"],
          },
          action: {
            type: "string",
          },
          reason: {
            type: "string",
          },
        },
        required: ["priority", "action", "reason"],
      },
    },
    dataGaps: {
      type: "array",
      items: {
        type: "string",
      },
    },
  },
  required: [
    "severity",
    "headline",
    "summary",
    "topRisks",
    "recommendations",
    "dataGaps",
  ],
};

app.post("/api/analyze-risk", async (req, res) => {
  try {
    const data = normalizePayload(req.body);

    const prompt = `
You are BuildWise AI, a construction project risk analyst.

Analyze ONLY the project information supplied below. Do not invent facts,
costs, dates, regulations, delays, or causes that are not supported by the data.

The frontend already calculates quantitative risk scores. Treat those scores
as the primary numerical risk signal. Your job is to explain the risks,
prioritize them, identify likely project impacts, and recommend practical
actions.

Project data:
${JSON.stringify(data, null, 2)}

Rules:
- Be concise and practical.
- Prioritize the 3 most important risks when possible.
- Recommendations must be realistic for a construction project.
- If information is missing, put it in dataGaps instead of guessing.
- Do not claim that a risk is certain; describe it as a risk or possibility.
- Return ONLY the requested JSON structure.
`;

    const response = await ai.models.generateContent({
      model: process.env.GEMINI_MODEL || "gemini-3.6-flash",
      contents: prompt,
      config: {
        systemInstruction:
          "You are a careful construction risk analyst for BuildWise AI. " +
          "Use only supplied data and produce actionable, evidence-based analysis.",
        responseMimeType: "application/json",
        responseSchema: riskSchema,
        temperature: 0.2,
        maxOutputTokens: 1400,
      },
    });

    let result;
    try {
      result = JSON.parse(response.text);
    } catch {
      return res.status(502).json({
        error: "Gemini returned an invalid structured response.",
      });
    }

    res.json({
      ok: true,
      model: process.env.GEMINI_MODEL || "gemini-3.6-flash",
      analysis: result,
    });
  } catch (error) {
    console.error("Risk analysis error:", error);

    const status = error?.status && Number.isInteger(error.status)
      ? error.status
      : 500;

    res.status(status).json({
      error: "Unable to analyze project risk.",
      message:
        process.env.NODE_ENV === "development"
          ? error.message
          : "Check the backend logs for details.",
    });
  }
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error." });
});

app.listen(PORT, () => {
  console.log(`BuildWise Gemini backend running on port ${PORT}`);
});
