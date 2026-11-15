import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';
import { getDistanceToZoneKm, getTechnicianDistanceFromOrigin } from './src/lib/geo';
import { MUMBAI_INITIAL_CLUSTERS, SKILL_CATEGORIES } from './src/lib/constants';

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

  // AI Voice Assistant: Helps customers find services, check Mumbai availability, and guide bookings in Hindi, Marathi, and English
  const ZONE_ALIAS_MAP: Array<[string[], string]> = [
    [['अंधेरी', 'अंधेरी पूर्व', 'अंधेरी पश्चिम', 'लोखंडवाला'], 'Andheri'],
    [['बांद्रा', 'वांद्रे', 'bkc', 'पाली हिल'], 'Bandra'],
    [['दादर', 'शिवाजी पार्क'], 'Dadar'],
    [['बोरीवली', 'बोरिवली'], 'Borivali'],
    [['कोलाबा', 'कुलाबा', 'कफ परेड'], 'Colaba'],
    [['माहिम', 'माहीम'], 'Mahim'],
    [['खार'], 'Khar'],
    [['सांताक्रूज', 'सांताक्रूझ', 'कलिना'], 'Santacruz'],
    [['जोगेश्वरी', 'ओशिवरा'], 'Jogeshwari'],
    [['पवई', 'हिरानंदानी'], 'Powai'],
    [['घाटकोपर'], 'Ghatkopar'],
    [['कुर्ला'], 'Kurla'],
    [['चेंबूर'], 'Chembur'],
    [['मुलुंड'], 'Mulund'],
    [['भांडुप'], 'Bhandup'],
    [['विक्रोली'], 'Vikhroli'],
    [['कांजूरमार्ग'], 'Kanjurmarg'],
    [['मालाड'], 'Malad'],
    [['कांदिवली'], 'Kandivali'],
    [['गोरेगांव', 'गोरेगाव'], 'Goregaon'],
    [['दहिसर'], 'Dahisar'],
    [['जुहू'], 'Juhu'],
    [['विले पार्ले', 'पार्ले'], 'Vile Parle'],
    [['सायन', 'शीव'], 'Sion'],
    [['परेल', 'परळ'], 'Parel'],
    [['लोअर परेल', 'लोअर परळ'], 'Lower Parel'],
    [['वरळी', 'वर्ली'], 'Worli'],
    [['प्रभादेवी'], 'Prabhadevi'],
    [['माटुंगा'], 'Matunga'],
    [['भायखला', 'भयखळा'], 'Byculla'],
    [['फोर्ट'], 'Fort'],
    [['धारावी'], 'Dharavi'],
    [['गोवंडी'], 'Govandi'],
    [['मानखुर्द'], 'Mankhurd'],
    [['ट्रॉम्बे'], 'Trombay'],
    [['वडाळा', 'नायगाव'], 'Naigaon'],
    [['मलबार हिल'], 'Malabar Hill'],
    [['ताडदेव', 'हाजी अली'], 'Tardeo'],
    [['गिरगाव', 'चर्नी रोड'], 'Girgaon'],
    [['ग्रँट रोड', 'ग्रांट रोड'], 'Grant Road'],
  ];

  const detectResponseLanguage = (rawQuery: string, requestedLang?: string): 'en' | 'hi' | 'mr' => {
    const q = rawQuery.toLowerCase();
    const hasDevanagari = /[\u0900-\u097F]/.test(rawQuery);
    const marathiHints = [
      'आहे', 'पाहिजे', 'हवा', 'हवी', 'दाखवा', 'करा', 'साठी', 'जवळ', 'मध्ये', 'कुठे', 'किती', 'सांगा',
      'मदत', 'नोंदणी', 'दुचाकी', 'चारचाकी', 'तंत्रज्ञ', 'सुतार', 'कामगार', 'हवे', 'कसे',
    ];
    const hindiHints = [
      'है', 'चाहिए', 'दिखाओ', 'दिखाइए', 'बताओ', 'बताइए', 'करना', 'करनी', 'कहाँ', 'कहां', 'में', 'के पास',
      'कितना', 'कितने', 'मदद', 'खोजें', 'खोजो', 'खोलो', 'खोलें', 'मेरा', 'मेरी', 'मुझे', 'मिलेगा', 'मिलेंगे',
      'chahiye', 'dikhao', 'batao', 'kaha', 'kahan', 'kaise', 'kitna', 'madad', 'kholo', 'mujhe', 'karna', 'karni', 'dukan', 'bijli',
    ];

    if (marathiHints.some((w) => q.includes(w))) return 'mr';
    if (hindiHints.some((w) => q.includes(w))) return 'hi';
    if (requestedLang === 'hi' || requestedLang === 'mr' || requestedLang === 'en') {
      return requestedLang;
    }
    if (hasDevanagari) return 'hi';
    return 'en';
  };

  const normalizeCanonicalSkill = (rawSkill: string): string => {
    const clean = rawSkill.trim().toLowerCase();
    if (!clean) return '';
    const exact = SKILL_CATEGORIES.find((s) => s.toLowerCase() === clean);
    return exact || '';
  };

  const normalizeCanonicalZone = (rawZone: string): string => {
    const clean = rawZone.trim().toLowerCase();
    if (!clean) return '';
    const exact = MUMBAI_INITIAL_CLUSTERS.find((z) => z.name.toLowerCase() === clean);
    return exact ? exact.name : '';
  };

  const parseLocalVoiceIntent = (rawQuery: string, requestedLanguage?: string, defaultZone?: string) => {
    const q = rawQuery.toLowerCase().trim();
    const resolvedLanguage = detectResponseLanguage(rawQuery, requestedLanguage);

    // Order specific skills before general ones
    const skillMatchers: Array<[string[], string]> = [
      [['evm four', 'evm car', 'ev four', 'electric car', 'ईवीएम फोर', 'इलेक्ट्रिक कार', 'चार चाकी ईवी'], 'EVM four-wheeler mechanic'],
      [['evm mechanic', 'evm ', 'ev mechanic', 'ev bike', 'electric bike', 'e-scooter', 'electric scooter', 'ईवीएम', 'ईवी मैकेनिक', 'इलेक्ट्रिक वाहन'], 'EVM mechanic'],
      [['four-wheeler', 'four wheeler', 'car mechanic', 'car repair', 'फोर व्हीलर', 'कार मैकेनिक', 'फोर-व्हीलर', 'गाड़ी मैकेनिक'], 'Four-wheeler mechanic'],
      [['bike mechanic', 'two wheeler', 'two-wheeler', 'scooter', 'motorcycle', 'बाइक', 'बाइक मैकेनिक', 'दुचाकी', 'स्कूटर', 'मोटरसाइकिल'], 'Bike mechanic'],
      [['beautician', 'beauty', 'parlour', 'parlor', 'salon', 'makeup', 'bridal', 'ब्यूटीशियन', 'ब्यूटी', 'पार्लर', 'सैलून', 'मेकअप'], 'Beauticians'],
      [['ac ', 'air conditioner', 'hvac', 'cooling', 'एसी', 'एअर कंडिशनर'], 'AC Technician'],
      [['electrician', 'wiring', 'mcb', 'switch', 'fan', 'light', 'bijli', 'बिजली', 'इलेक्ट्रीशियन', 'इलेक्ट्रिशियन', 'विद्युत', 'वायरिंग'], 'Electrician'],
      [['plumb', 'pipe', 'tap', 'leak', 'bathroom', 'nal', 'प्लंबर', 'नल', 'पाइप', 'लीकेज'], 'Plumber'],
      [['carpent', 'wood', 'furniture', 'door', 'wardrobe', 'सुतार', 'कारपेंटर', 'बढ़ई', 'फर्नीचर', 'लकड़ी'], 'Carpenter'],
      [['ro ', 'purifier', 'water filter', 'आरओ', 'वाटर प्यूरीफायर'], 'RO Technician'],
      [['cctv', 'camera', 'सीसीटीवी', 'कैमरा'], 'CCTV Technician'],
      [['paint', 'wall', 'putty', 'पेंटर', 'पेंट', 'पुताई', 'रंगारी'], 'Painter'],
      [['weld', 'fabrication', 'वेल्डर', 'वेल्डिंग'], 'Welder'],
      [['mason', 'brick', 'tile', 'plaster', 'राजमिस्त्री', 'मेसन', 'गवंडी'], 'Mason'],
      [['civil', 'construction', 'सिविल'], 'Civil Worker'],
      [['appliance', 'fridge', 'washing machine', 'microwave', 'geyser', 'फ्रिज', 'वाशिंग मशीन', 'माइक्रोवेव'], 'Appliance Repair'],
      [['clean', 'deep clean', 'sanitiz', 'सफाई', 'सफ़ाई', 'स्वच्छता', 'क्लीनिंग'], 'Cleaning Services'],
      [['computer repair', 'laptop repair', 'pc repair', 'कंप्यूटर रिपेयर', 'लैपटॉप', 'संगणक'], 'Computer Repairing'],
      [['software', 'windows', 'driver', 'antivirus', 'सॉफ्टवेयर', 'सॉफ़्टवेयर'], 'Software'],
      [['hardware shop', 'hardware store', 'motherboard', 'ram', 'ssd', 'smps'], 'Hardware'],
      [['network technician', 'structured cabling', 'fiber', 'isp', 'नेटवर्क टेक्नीशियन', 'नेटवर्क तंत्रज्ञ'], 'Network Technician'],
      [['network', 'wifi', 'router', 'lan', 'नेटवर्किंग', 'वाईफाई'], 'Networking'],
      [['it engineering', 'server', 'cloud', 'sysadmin', 'आईटी', 'आयटी'], 'IT Engineering'],
      [['automotive', 'garage', 'obd', 'vehicle', 'ऑटोमोबाइल', 'गैरेज', 'गाडी'], 'Automotive Services'],
    ];

    let suggestedSkill = '';
    for (const [keywords, skill] of skillMatchers) {
      if (keywords.some((kw) => q.includes(kw))) {
        suggestedSkill = skill;
        break;
      }
    }

    const mumbaiZones = MUMBAI_INITIAL_CLUSTERS.map((z) => z.name);
    let matchedZone = mumbaiZones.find((z) => q.includes(z.toLowerCase())) || '';
    if (!matchedZone) {
      for (const [aliases, canonicalZone] of ZONE_ALIAS_MAP) {
        if (aliases.some((alias) => q.includes(alias.toLowerCase()))) {
          matchedZone = canonicalZone;
          break;
        }
      }
    }
    const zoneForFilter = matchedZone || '';

    const isCart =
      q.includes('cart') || q.includes('checkout') || q.includes('कार्ट') || q.includes('बास्केट');
    const isProduct =
      q.includes('product') ||
      q.includes('buy') ||
      q.includes('shop') ||
      q.includes('part') ||
      q.includes('discount') ||
      q.includes('wire') ||
      q.includes('tool') ||
      q.includes('दुकान') ||
      q.includes('सामान') ||
      q.includes('खरीद') ||
      q.includes('हार्डवेयर') ||
      q.includes('उत्पाद') ||
      q.includes('छूट') ||
      q.includes('वस्तू');
    const isContractor =
      q.includes('contractor') ||
      q.includes('builder') ||
      q.includes('project') ||
      q.includes('ठेकेदार') ||
      q.includes('कंत्राटदार') ||
      q.includes('प्रोजेक्ट');
    const isBookingHelp =
      q.includes('booking') ||
      q.includes('book ') ||
      q.includes('status') ||
      q.includes('appointment') ||
      q.includes('slot') ||
      q.includes('बुकिंग') ||
      q.includes('बुक ') ||
      q.includes('बुक कर') ||
      q.includes('स्लॉट') ||
      q.includes('स्थिति') ||
      q.includes('ऑर्डर');

    const suggestedFeed = isProduct
      ? 'products'
      : isContractor
        ? 'contractors'
        : suggestedSkill
          ? 'technicians'
          : '';

    const hasServiceIntent = Boolean(suggestedSkill || matchedZone || isProduct || isContractor || isCart || isBookingHelp);
    const action = isCart
      ? 'open_cart'
      : isBookingHelp && !suggestedSkill && !isProduct && !isContractor
        ? 'open_booking'
        : hasServiceIntent
          ? 'search'
          : 'none';

    const displayZone = matchedZone || defaultZone || '';

    let replyText = '';
    if (action === 'none') {
      replyText =
        resolvedLanguage === 'hi'
          ? 'मैं आपका सेवा अनुरोध ठीक से समझ नहीं पाया। कृपया सेवा का नाम (जैसे इलेक्ट्रिशियन, बाइक मैकेनिक, ब्यूटीशियन) और मुंबई इलाका (जैसे अंधेरी, दादर) बताएं।'
          : resolvedLanguage === 'mr'
            ? 'तुमची विनंती स्पष्ट समजली नाही. कृपया सेवा श्रेणी (उदा. इलेक्ट्रिशियन, बाइक मॅकॅनिक, ब्यूटीशियन) आणि मुंबईचा भाग (उदा. अंधेरी, दादर) सांगा.'
            : 'I could not identify a specific service or Mumbai area from that request. Please mention a trade (e.g. Electrician, Bike mechanic, Beauticians) or Mumbai locality.';
    } else if (action === 'open_cart') {
      replyText =
        resolvedLanguage === 'hi'
          ? 'आपका शॉपिंग कार्ट तैयार है। ऑर्डर पूरा करने के लिए नीचे "शॉपिंग कार्ट खोलें" बटन दबाएं।'
          : resolvedLanguage === 'mr'
            ? 'तुमचा शॉपिंग कार्ट तयार आहे. ऑर्डर पूर्ण करण्यासाठी खालील "शॉपिंग कार्ट उघडा" बटणावर क्लिक करा.'
            : 'Your shopping cart is ready. Tap the button below to review items and complete checkout.';
    } else if (action === 'open_booking') {
      replyText =
        resolvedLanguage === 'hi'
          ? 'सेवा बुकिंग, उपलब्ध स्लॉट चुनने और अपनी बुकिंग स्थिति देखने के लिए नीचे "बुकिंग केंद्र खोलें" बटन दबाएं।'
          : resolvedLanguage === 'mr'
            ? 'सेवा बुक करण्यासाठी, वेळ स्लॉट निवडण्यासाठी आणि बुकिंग स्थिती पाहण्यासाठी खालील "बुकिंग केंद्र उघडा" बटण दाबा.'
            : 'Tap Open Booking Hub below to schedule a free technician time slot or track your active bookings.';
    } else if (isProduct) {
      replyText =
        resolvedLanguage === 'hi'
          ? `${displayZone || 'मुंबई'} में दुकान के उत्पाद और छूट देखने के लिए नीचे दिए गए बटन पर टैप करें।`
          : resolvedLanguage === 'mr'
            ? `${displayZone || 'मुंबई'} मधील दुकानातील वस्तू आणि सवलती पाहण्यासाठी खालील बटणावर क्लिक करा.`
            : `Showing local Mumbai shop products and member discounts${displayZone ? ` in ${displayZone}` : ''}. Tap below to view listings.`;
    } else {
      replyText =
        resolvedLanguage === 'hi'
          ? `${displayZone || 'मुंबई'} में ${suggestedSkill || 'सत्यापित विशेषज्ञ'} के परिणाम तैयार हैं। फ़िल्टर लागू करने के लिए नीचे बटन दबाएं${isBookingHelp ? ' या तुरंत बुकिंग शुरू करें।' : '।'}`
          : resolvedLanguage === 'mr'
            ? `${displayZone || 'मुंबई'} साठी ${suggestedSkill || 'तज्ञ सेवा'} परिणाम तयार आहेत. फिल्टर लागू करण्यासाठी खालील बटण दाबा.`
            : `Showing ${suggestedSkill || 'available verified specialists'}${displayZone ? ` in ${displayZone}` : ' across Mumbai'}. Tap the button below to apply filters.`;
    }

    return {
      replyText,
      suggestedSkill,
      suggestedZone: zoneForFilter,
      suggestedFeed: suggestedFeed || (action === 'search' ? 'technicians' : ''),
      action,
      resolvedLanguage,
      source: 'local' as const,
    };
  };

  app.post('/api/ai/voice-assistant', async (req, res) => {
    const { query: userQuery, language, userRole, clusterZone, liveSummary } = req.body ?? {};
    if (!userQuery || typeof userQuery !== 'string' || !userQuery.trim()) {
      res.status(400).json({ error: 'Please speak or type a service question first.' });
      return;
    }

    const fallbackResponse = parseLocalVoiceIntent(userQuery, language, clusterZone);
    const targetLanguage = fallbackResponse.resolvedLanguage;

    try {
      const ai = getGeminiClient();
      if (!ai) {
        res.json(fallbackResponse);
        return;
      }

      const languageRule =
        targetLanguage === 'hi'
          ? 'Hindi (Devanagari script — हिन्दी, natural concise spoken sentences under 280 characters)'
          : targetLanguage === 'mr'
            ? 'Marathi (Devanagari script — मराठी, concise spoken sentences under 280 characters)'
            : 'English (concise spoken sentences under 280 characters)';

      const systemInstruction = `You are the AI Voice Service Assistant for "All in One Skill" in Mumbai, Maharashtra.
Help users search for skilled technicians, hardware shopkeeper products & discounts, contractor projects, availability, and service bookings across all 58 Mumbai City & Suburban zones (Colaba, Fort, Byculla, Dadar, Worli, Sion, Mahim, Bandra, Khar, Santacruz, Andheri, Jogeshwari, Goregaon, Malad, Kandivali, Borivali, Kurla, Ghatkopar, Powai, Mulund, Chembur, etc.).

Exact canonical skill category names (use exact spelling in suggestedSkill when applicable):
${SKILL_CATEGORIES.join(', ')}

Rules:
1. Respond cleanly in ${languageRule}.
2. Even if the user types Hinglish (Roman Hindi like "Andheri me bike mechanic chahiye") or Devanagari Hindi ("अंधेरी में इलेक्ट्रिशियन चाहिए"), understand it accurately and reply in ${languageRule}.
3. For booking status/scheduling help without a search filter, set action="open_booking". For cart/checkout, set action="open_cart". For finding technicians/shops/products/contractors, set action="search". If the input is completely unrelated/unintelligible noise, set action="none" and politely ask the user to name a Mumbai service or area.
4. Always return valid JSON matching the schema.`;

      const response = await withAiTimeout(
        ai.models.generateContent({
          model: 'gemini-3.1-flash-lite',
          contents: JSON.stringify({
            requestedLanguage: targetLanguage,
            userRole: userRole || 'customer',
            currentZone: clusterZone || 'Andheri',
            liveSummary: liveSummary || {},
            spokenOrTypedQuery: userQuery.trim().slice(0, 600),
          }),
          config: {
            systemInstruction,
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                replyText: { type: Type.STRING, description: 'Natural spoken-friendly answer in the requested language (max 300 chars).' },
                suggestedSkill: { type: Type.STRING, description: 'Exact canonical skill category name if applicable, else empty string.' },
                suggestedZone: { type: Type.STRING, description: 'Canonical Mumbai zone name in English (e.g. Andheri, Dadar) if mentioned, else empty string.' },
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
        14000
      );

      const parsed = JSON.parse((response.text ?? '{}').trim()) as Record<string, unknown>;
      const aiSkill = normalizeCanonicalSkill(String(parsed.suggestedSkill || ''));
      const aiZone = normalizeCanonicalZone(String(parsed.suggestedZone || ''));
      const rawFeed = String(parsed.suggestedFeed || '');
      const allowedFeeds = new Set(['technicians', 'products', 'shops', 'contractors', 'projects']);
      const normalizedFeed = allowedFeeds.has(rawFeed) ? rawFeed : fallbackResponse.suggestedFeed;
      const rawAction = String(parsed.action || '');
      const allowedActions = new Set(['search', 'open_booking', 'open_cart', 'none']);
      const normalizedAction = allowedActions.has(rawAction) ? rawAction : fallbackResponse.action;

      const replyCandidate = String(parsed.replyText || '').trim();
      res.json({
        replyText: replyCandidate || fallbackResponse.replyText,
        suggestedSkill: aiSkill || fallbackResponse.suggestedSkill,
        suggestedZone: aiZone || fallbackResponse.suggestedZone,
        suggestedFeed: normalizedFeed,
        action:
          normalizedAction === 'none' && (aiSkill || aiZone || fallbackResponse.suggestedSkill || fallbackResponse.suggestedZone)
            ? 'search'
            : normalizedAction,
        resolvedLanguage: targetLanguage,
        source: 'gemini',
      });
    } catch (error) {
      console.warn('AI voice assistant Gemini fallback triggered:', error);
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
