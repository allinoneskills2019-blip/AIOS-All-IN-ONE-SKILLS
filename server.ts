import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import { getDistanceToZoneKm, getTechnicianDistanceFromOrigin } from './src/lib/geo';
import { MUMBAI_INITIAL_CLUSTERS } from './src/lib/constants';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const isProduction = process.env.NODE_ENV === 'production';

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      timeout: 15000,
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function withAiTimeout<T>(promise: Promise<T>, ms = 15000): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('Gemini API request timed out')), ms)),
  ]);
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'all-in-one-skill',
      geminiConfigured: Boolean(getGeminiClient()),
      mumbaiClustersCount: MUMBAI_INITIAL_CLUSTERS.length,
    });
  });

  // AI Management Team Advisory Endpoint
  app.post('/api/ai/consult', async (req, res) => {
    try {
      const { agentRole, zone, prompt, metricsSummary } = req.body ?? {};
      if (!agentRole || !prompt) {
        res.status(400).json({ error: 'agentRole and prompt are required.' });
        return;
      }

      const ai = getGeminiClient();
      if (!ai) {
        res.status(503).json({ error: 'GEMINI_API_KEY is not configured in server secrets.' });
        return;
      }

      const systemInstruction = `You are "${agentRole}" inside All in One Skill, an AI-powered service, product, contractor, and skilled workforce marketplace starting in Mumbai, Maharashtra.
Mumbai launch clusters: Colaba, Mahim, Bandra, Khar, Santacruz, Andheri, Jogeshwari, Borivali.
Operational rules:
- Follow administrator permissions strictly.
- Financial transactions, refunds, pricing changes, fee overrides, and compliance/KYC approvals MUST require authorized human Administrator approval (set requiresHumanApproval: true).
- Never assign a job automatically to a technician marked Busy or Unavailable.
- Keep recommendations concise, actionable, and grounded in the provided marketplace metrics.`;

      const userContent = `Role: ${agentRole}
Zone Focus: ${zone || 'All Mumbai Clusters'}
Live Marketplace Metrics: ${JSON.stringify(metricsSummary || {})}
Admin / Operational Request: ${String(prompt).slice(0, 1200)}`;

      const response = await withAiTimeout(
        ai.models.generateContent({
          model: 'gemini-3.1-flash-lite',
          contents: userContent,
          config: {
            systemInstruction,
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING, description: 'Short headline for the executive brief.' },
                summary: { type: Type.STRING, description: 'Clear operational analysis based on live marketplace metrics.' },
                recommendedAction: { type: Type.STRING, description: 'Specific next step for the marketplace.' },
                requiresHumanApproval: { type: Type.BOOLEAN, description: 'True if involving money, refunds, pricing, verification, or policy changes.' },
              },
              required: ['title', 'summary', 'recommendedAction', 'requiresHumanApproval'],
            },
          },
        }),
        15000
      );

      const parsed = JSON.parse((response.text ?? '{}').trim());
      res.json(parsed);
    } catch (error) {
      console.error('AI consult error:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to consult AI management team.',
      });
    }
  });

  // AI Customer Support & Call Center Triage Endpoint
  app.post('/api/ai/support-chat', async (req, res) => {
    try {
      const { agentRole, message, clusterZone, userRole } = req.body ?? {};
      if (!message) {
        res.status(400).json({ error: 'message is required.' });
        return;
      }

      const ai = getGeminiClient();
      if (!ai) {
        res.status(503).json({ error: 'GEMINI_API_KEY is not configured in server secrets.' });
        return;
      }

      const roleTitle = agentRole === 'AI Call Center' ? 'AI Call Center Desk' : 'AI Customer Support';
      const response = await withAiTimeout(
        ai.models.generateContent({
          model: 'gemini-3.1-flash-lite',
          contents: `User Role: ${userRole || 'customer'} | Mumbai Zone: ${clusterZone || 'Andheri'} | Query: ${String(message).slice(0, 1000)}`,
          config: {
            systemInstruction: `You are ${roleTitle} for All in One Skill (Mumbai, Maharashtra).
Help customers, shopkeepers, contractors, and technicians with booking services, tracking orders, understanding all 58 Mumbai City & Suburban cluster zones (Colaba, Dadar, Bandra, Andheri, Borivali, Powai, Ghatkopar, Chembur, Mulund, etc.), and raising complaints.
Never approve refunds or promise unverified payouts directly—inform users that financial refunds or disputes are escalated to the human Administrator team. Keep replies concise and helpful.`,
          },
        }),
        15000
      );

      res.json({ reply: response.text ?? 'Thank you for contacting All in One Skill support.' });
    } catch (error) {
      console.error('AI support error:', error);
      const zoneName = String((req.body ?? {}).clusterZone || 'Mumbai');
      res.json({
        reply: `Our live AI desk is currently busy. For ${zoneName}, you can book Available technicians directly from Customer Hub, track shopkeeper courier orders in Marketplace Orders, or submit a refund/dispute ticket for human Admin review.`,
        fallback: true,
      });
    }
  });

  // AI Booking Manager: Match Available Technicians across all 58 Mumbai City & Suburban Clusters via Haversine geodesic distance
  app.post('/api/ai/match-technicians', async (req, res) => {
    try {
      const { customerZone, skillCategory, candidates } = req.body ?? {};
      const list = Array.isArray(candidates) ? candidates : [];

      // Hard rule: NEVER assign or recommend Busy or Unavailable technicians
      const availableOnly = list.filter((t) => t.availabilityStatus === 'Available');
      const { getZoneCoords } = await import('./src/lib/geo');
      const originCoords = getZoneCoords(customerZone);

      const scored = availableOnly
        .map((tech) => {
          const sameZone =
            tech.clusterZone === customerZone ||
            (Array.isArray(tech.preferredLocations) && tech.preferredLocations.includes(customerZone));
          const distResult = originCoords
            ? getTechnicianDistanceFromOrigin(originCoords, {
                clusterZone: tech.clusterZone || '',
                preferredLocations: Array.isArray(tech.preferredLocations) ? tech.preferredLocations : [],
                workingRadiusKm: Number(tech.workingRadiusKm || 5),
              })
            : null;
          const distanceKm = sameZone
            ? 0
            : distResult
              ? Number(distResult.distanceKm.toFixed(1))
              : getDistanceToZoneKm(originCoords, tech.clusterZone);
          const radiusLimit = Number(tech.workingRadiusKm || 5);
          const withinRadius =
            sameZone || (distanceKm !== null && distanceKm <= radiusLimit);
          const skillMatch = !skillCategory || skillCategory === 'All' || tech.skillCategory === skillCategory;
          const proximityBonus =
            sameZone ? 30 : distanceKm !== null ? Math.max(0, 24 - distanceKm * 2) : 0;
          const score =
            (skillMatch ? 50 : 0) +
            proximityBonus +
            Number(tech.ratingAvg || 0) * 6 +
            Math.min(Number(tech.experienceYears || 0), 15);
          return { ...tech, distanceKm, matchScore: Math.round(score), withinRadius };
        })
        .filter((t) => t.withinRadius && (!skillCategory || skillCategory === 'All' || t.skillCategory === skillCategory))
        .sort((a, b) => b.matchScore - a.matchScore);

      res.json({ matched: scored });
    } catch (error) {
      console.error('Match technicians error:', error);
      res.status(500).json({ error: 'Failed to match technicians.' });
    }
  });

  // AI-Recommended Marketplace Picks (User Location + Booking History)
  app.post('/api/ai/recommend-technicians', async (req, res) => {
    try {
      const { originZone, bookedSkills, candidates } = req.body ?? {};
      const list = Array.isArray(candidates) ? candidates.slice(0, 6) : [];
      const skillsSummary = Array.isArray(bookedSkills) ? bookedSkills.slice(0, 8) : [];

      if (list.length === 0) {
        res.json({ reasons: {} });
        return;
      }

      const ai = getGeminiClient();
      if (!ai) {
        res.json({ reasons: {} });
        return;
      }

      const response = await withAiTimeout(
        ai.models.generateContent({
          model: 'gemini-3.1-flash-lite',
          contents: JSON.stringify({
            userLocationZone: originZone || 'Mumbai',
            previousBookedSkills: skillsSummary,
            topCandidates: list.map((c: Record<string, unknown>) => ({
              id: c.id,
              fullName: c.fullName,
              skillCategory: c.skillCategory,
              clusterZone: c.clusterZone,
              distanceKm: c.distanceKm,
              withinServiceRadius: c.withinServiceRadius,
              ratingAvg: c.ratingAvg,
              experienceYears: c.experienceYears,
            })),
          }),
          config: {
            systemInstruction: `You write concise, factual 1-sentence technician recommendation reasons (max 110 characters each) for the All in One Skill Mumbai marketplace.
Highlight why each technician matches the customer's location/service zone and previous booking skills without inventing metrics or discounts.
Return JSON with an array "recommendations" containing objects { "id": string, "reason": string }.`,
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                recommendations: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      id: { type: Type.STRING },
                      reason: { type: Type.STRING },
                    },
                    required: ['id', 'reason'],
                  },
                },
              },
              required: ['recommendations'],
            },
          },
        }),
        15000
      );

      const parsed = JSON.parse((response.text ?? '{}').trim()) as {
        recommendations?: Array<{ id?: string; reason?: string }>;
      };
      const reasons: Record<string, string> = {};
      for (const item of parsed.recommendations || []) {
        if (item.id && item.reason) {
          reasons[item.id] = item.reason.slice(0, 140);
        }
      }

      res.json({ reasons });
    } catch (error) {
      console.error('AI recommend technicians error:', error);
      res.json({ reasons: {} });
    }
  });

  // AI Voice Assistant: Helps customers find services, check Mumbai availability, and guide bookings
  const parseLocalVoiceIntent = (rawQuery: string, language?: string, defaultZone?: string) => {
    const q = rawQuery.toLowerCase();
    const skillMatchers: Array<[string[], string]> = [
      [['ac ', 'air conditioner', 'hvac', 'cooling', 'एसी'], 'AC Technician'],
      [['electrician', 'wiring', 'mcb', 'switch', 'fan', 'light', 'विद्युत', 'इलेक्ट्रीशियन'], 'Electrician'],
      [['plumb', 'pipe', 'tap', 'leak', 'bathroom', 'प्लंबर'], 'Plumber'],
      [['carpent', 'wood', 'furniture', 'door', 'सुतार', 'कारपेंटर'], 'Carpenter'],
      [['car', 'bike', 'ev ', 'garage', 'mechanic', 'scanner', 'auto', 'vehicle', 'गाडी', 'मॅकॅनिक'], 'Automotive Services'],
      [['network', 'wifi', 'router', 'fiber', 'lan', 'cabling'], 'Network Technician'],
      [['software', 'it engineering', 'server', 'cloud', 'laptop', 'computer', 'संगणक'], 'IT Engineering'],
      [['ro ', 'purifier', 'water filter'], 'RO Technician'],
      [['cctv', 'camera'], 'CCTV Technician'],
      [['paint', 'wall', 'putty'], 'Painter'],
      [['clean', 'deep clean', 'sanitiz'], 'Cleaning Services'],
    ];
    let suggestedSkill = '';
    for (const [keywords, skill] of skillMatchers) {
      if (keywords.some((kw) => q.includes(kw))) {
        suggestedSkill = skill;
        break;
      }
    }

    const mumbaiZones = MUMBAI_INITIAL_CLUSTERS.map((z) => z.name);
    const matchedZone = mumbaiZones.find((z) => q.includes(z.toLowerCase())) || defaultZone || '';

    const isCart = q.includes('cart') || q.includes('checkout');
    const isProduct = q.includes('product') || q.includes('buy') || q.includes('shop') || q.includes('part') || q.includes('discount');
    const isContractor = q.includes('contractor') || q.includes('builder') || q.includes('project');
    const suggestedFeed = isProduct ? 'products' : isContractor ? 'contractors' : 'technicians';
    const action = isCart ? 'open_cart' : q.includes('booking') || q.includes('status') ? 'open_booking' : 'search';

    const replyText =
      language === 'mr'
        ? `${matchedZone || 'मुंबई'} साठी ${suggestedSkill || 'तज्ञ सेवा'} फिल्टर केले आहे. कृपया उपलब्ध स्लॉट निवडा किंवा कार्ट तपासा.`
        : `Showing ${suggestedSkill || 'available verified specialists'}${matchedZone ? ` in ${matchedZone}` : ' across Mumbai'}. You can tap the quick button below to apply filters or review live estimates.`;

    return { replyText, suggestedSkill, suggestedZone: matchedZone, suggestedFeed, action };
  };

  app.post('/api/ai/voice-assistant', async (req, res) => {
    const { query: userQuery, language, userRole, clusterZone, liveSummary } = req.body ?? {};
    if (!userQuery || typeof userQuery !== 'string') {
      res.status(400).json({ error: 'query text is required.' });
      return;
    }

    const fallbackResponse = parseLocalVoiceIntent(userQuery, language, clusterZone);

    try {
      const ai = getGeminiClient();
      if (!ai) {
        res.json(fallbackResponse);
        return;
      }

      const systemInstruction = `You are the AI Voice Assistant for All in One Skill in Mumbai, Maharashtra.
Help users search for skilled technicians (Electrician, Plumber, Carpenter, AC Technician, Network Technician, IT Engineering, Automotive Services, Computer Repairing, etc.), shopkeeper hardware products with member discounts, contractor workforce projects, availability, and booking steps.
Cover Mumbai City (Colaba, Fort, Byculla, Dadar, Worli, Sion, Mahim) and Mumbai Suburbs (Bandra, Khar, Santacruz, Andheri, Jogeshwari, Goregaon, Malad, Kandivali, Borivali, Kurla, Ghatkopar, Powai, Mulund, Chembur).
Respond cleanly in ${language === 'mr' ? 'Marathi (concise spoken sentences)' : 'English (concise spoken sentences, max 3 sentences)'}.
Return valid JSON matching the schema.`;

      const modelsToTry = ['gemini-3.1-flash-lite', 'gemini-4-hydrogen'];
      let parsed: Record<string, unknown> | null = null;

      for (const modelName of modelsToTry) {
        try {
          const response = await withAiTimeout(
            ai.models.generateContent({
              model: modelName,
              contents: JSON.stringify({
                userRole: userRole || 'customer',
                currentZone: clusterZone || 'Andheri',
                liveSummary: liveSummary || {},
                spokenOrTypedQuery: userQuery.slice(0, 600),
              }),
              config: {
                ...(modelName === 'gemini-4-hydrogen'
                  ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }
                  : {}),
                systemInstruction,
                responseMimeType: 'application/json',
                responseSchema: {
                  type: Type.OBJECT,
                  properties: {
                    replyText: { type: Type.STRING, description: 'Natural, spoken-friendly response under 320 characters.' },
                    suggestedSkill: { type: Type.STRING, description: 'Exact skill category name if applicable, else empty string.' },
                    suggestedZone: { type: Type.STRING, description: 'Mumbai zone/suburb name if mentioned, else empty string.' },
                    suggestedFeed: {
                      type: Type.STRING,
                      description: 'One of technicians, products, shops, contractors, projects, or empty string.',
                    },
                    action: {
                      type: Type.STRING,
                      description: 'One of search, open_booking, open_cart, none.',
                    },
                  },
                  required: ['replyText', 'suggestedSkill', 'suggestedZone', 'suggestedFeed', 'action'],
                },
              },
            }),
            12000
          );
          parsed = JSON.parse((response.text ?? '{}').trim()) as Record<string, unknown>;
          break;
        } catch (modelErr) {
          console.warn(`AI voice assistant model ${modelName} unavailable, trying next:`, modelErr);
        }
      }

      if (parsed) {
        res.json({
          replyText: String(parsed.replyText || fallbackResponse.replyText),
          suggestedSkill: String(parsed.suggestedSkill || fallbackResponse.suggestedSkill),
          suggestedZone: String(parsed.suggestedZone || fallbackResponse.suggestedZone),
          suggestedFeed: String(parsed.suggestedFeed || fallbackResponse.suggestedFeed),
          action: String(parsed.action || fallbackResponse.action),
        });
        return;
      }

      res.json(fallbackResponse);
    } catch (error) {
      console.error('AI voice assistant error:', error);
      res.json(fallbackResponse);
    }
  });

  if (isProduction) {
    const distDir = path.join(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`All in One Skill server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
