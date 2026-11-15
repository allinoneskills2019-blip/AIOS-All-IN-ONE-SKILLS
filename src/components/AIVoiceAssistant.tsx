import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  Loader2,
  Mic,
  MicOff,
  RotateCcw,
  Send,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useMarketplace } from '../context/MarketplaceContext';
import { translateSkillCategory, type AppLanguage } from '../lib/i18n';

interface AIVoiceAssistantProps {
  onApplySearch?: (params: { skill?: string; zone?: string; feed?: string }) => void;
  onOpenBookingHelp?: () => void;
  onOpenCart?: () => void;
}

interface SpeechRecognitionAlternativeLike {
  transcript: string;
}

interface SpeechRecognitionResultLike {
  0: SpeechRecognitionAlternativeLike;
}

interface SpeechRecognitionEventLike {
  results: ArrayLike<SpeechRecognitionResultLike>;
}

interface SpeechRecognitionErrorEventLike {
  error?: string;
}

interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: ((e?: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
}

const VOICE_COPY: Record<
  AppLanguage,
  {
    buttonLabel: string;
    listeningLabel: string;
    processingLabel: string;
    title: string;
    subtitle: string;
    promptHint: string;
    youAsked: string;
    placeholder: string;
    openBooking: string;
    openCart: string;
    showMatchesPrefix: string;
    parseUnclear: string;
    retry: string;
    speechUnsupported: string;
    micDenied: string;
    noSpeech: string;
    micGenericError: string;
    networkError: string;
    samples: string[];
  }
> = {
  en: {
    buttonLabel: 'AI Voice Help',
    listeningLabel: 'Listening...',
    processingLabel: 'Analyzing request...',
    title: 'AI Voice Service Assistant',
    subtitle: 'Search Mumbai services, availability & booking help',
    promptHint: 'Tap the microphone or ask in English / हिंदी / मराठी:',
    youAsked: 'You asked',
    placeholder: 'Ask about Mumbai services or bookings...',
    openBooking: 'Open Booking Hub',
    openCart: 'Open Shopping Cart',
    showMatchesPrefix: 'Show',
    parseUnclear:
      'I could not pinpoint a service or Mumbai area. Try mentioning a trade (Electrician, Beauticians, Bike mechanic) and area (Andheri, Dadar).',
    retry: 'Try again',
    speechUnsupported:
      'Browser microphone recognition is unavailable here. Type your request below in English, हिंदी, or मराठी.',
    micDenied: 'Microphone permission was blocked. Enable mic access or type your question below.',
    noSpeech: 'No speech was detected. Tap the mic to speak clearly or type below.',
    micGenericError: 'Could not capture audio. You can type your service request below.',
    networkError: 'Unable to reach AI Voice Assistant right now. Please try again.',
    samples: [
      'Electrician available in Andheri',
      'Bike mechanic near Dadar',
      'Open my service booking hub',
    ],
  },
  hi: {
    buttonLabel: 'AI आवाज़ सहायता',
    listeningLabel: 'सुन रहे हैं...',
    processingLabel: 'आपका अनुरोध प्रोसेस हो रहा है...',
    title: 'AI वॉइस सेवा सहायक',
    subtitle: 'मुंबई सेवाएं, उपलब्धता और बुकिंग सहायता खोजें',
    promptHint: 'माइक दबाएं या हिंदी / मराठी / English में पूछें:',
    youAsked: 'आपने पूछा',
    placeholder: 'मुंबई सेवा, मैकेनिक या बुकिंग के बारे में पूछें...',
    openBooking: 'बुकिंग केंद्र खोलें',
    openCart: 'शॉपिंग कार्ट खोलें',
    showMatchesPrefix: 'देखें:',
    parseUnclear:
      'सेवा या मुंबई क्षेत्र स्पष्ट नहीं हुआ। कृपया कोई सेवा (जैसे इलेक्ट्रिशियन, बाइक मैकेनिक, ब्यूटीशियन) और इलाका (जैसे अंधेरी, दादर) बताएं।',
    retry: 'फिर से कोशिश करें',
    speechUnsupported:
      'इस ब्राउज़र में माइक वॉयस पहचान उपलब्ध नहीं है। आप नीचे हिंदी, मराठी या English में टाइप कर सकते हैं।',
    micDenied: 'माइक्रोफ़ोन अनुमति बंद है। ब्राउज़र में अनुमति दें या नीचे टाइप करें।',
    noSpeech: 'कोई आवाज़ सुनाई नहीं दी। कृपया फिर से बोलें या नीचे टाइप करें।',
    micGenericError: 'ऑडियो कैप्चर नहीं हो सका। आप नीचे अपना सवाल टाइप कर सकते हैं।',
    networkError: 'AI वॉइस सहायक से संपर्क नहीं हो पा रहा है। कृपया दोबारा प्रयास करें।',
    samples: [
      'अंधेरी में इलेक्ट्रिशियन चाहिए',
      'दादर में बाइक मैकेनिक दिखाओ',
      'सेवा बुक करनी है, बुकिंग केंद्र खोलें',
    ],
  },
  mr: {
    buttonLabel: 'AI आवाज मदत',
    listeningLabel: 'ऐकत आहे...',
    processingLabel: 'विनंती तपासली जात आहे...',
    title: 'AI व्हॉइस सेवा सहाय्यक',
    subtitle: 'मुंबई सेवा, उपलब्धता आणि बुकिंग मदत शोधा',
    promptHint: 'माइक दाबा किंवा मराठी / हिंदी / English मध्ये विचारा:',
    youAsked: 'तुम्ही विचारले',
    placeholder: 'मुंबई सेवा, मॅकॅनिक किंवा बुकिंगबद्दल विचारा...',
    openBooking: 'बुकिंग केंद्र उघडा',
    openCart: 'शॉपिंग कार्ट उघडा',
    showMatchesPrefix: 'दाखवा:',
    parseUnclear:
      'सेवा किंवा मुंबई विभाग स्पष्ट झाला नाही. कृपया सेवा (उदा. इलेक्ट्रिशियन, बाइक मॅकॅनिक) आणि विभाग (उदा. अंधेरी, दादर) सांगा.',
    retry: 'पुन्हा प्रयत्न करा',
    speechUnsupported:
      'या ब्राउझरमध्ये माइक व्हॉइस ओळख उपलब्ध नाही. खाली मराठी, हिंदी किंवा English मध्ये टाइप करा.',
    micDenied: 'मायक्रोफोन परवानगी नाकारली आहे. परवानगी द्या किंवा खाली टाइप करा.',
    noSpeech: 'आवाज ऐकू आला नाही. पुन्हा बोला किंवा खाली टाइप करा.',
    micGenericError: 'आवाज रेकॉर्ड होऊ शकला नाही. कृपया खाली विनंती टाइप करा.',
    networkError: 'AI व्हॉइस सहाय्यकाशी संपर्क होऊ शकला नाही. कृपया पुन्हा प्रयत्न करा.',
    samples: [
      'अंधेरी मध्ये इलेक्ट्रिशियन हवा आहे',
      'दादर जवळ बाइक मॅकॅनिक दाखवा',
      'मला सेवा बुक करायची आहे',
    ],
  },
};

function getSpeechLocale(lang: AppLanguage): string {
  if (lang === 'hi') return 'hi-IN';
  if (lang === 'mr') return 'mr-IN';
  return 'en-IN';
}

export const AIVoiceAssistant: React.FC<AIVoiceAssistantProps> = ({
  onApplySearch,
  onOpenBookingHelp,
  onOpenCart,
}) => {
  const { userAccount, activeRole, technicians, products, zones } = useMarketplace();
  const { language, setLanguage } = useLanguage();

  const [open, setOpen] = useState(false);
  const [voiceLang, setVoiceLang] = useState<AppLanguage>(language);
  const [listening, setListening] = useState(false);
  const [voiceOutputEnabled, setVoiceOutputEnabled] = useState(true);
  const [query, setQuery] = useState('');
  const [lastQuery, setLastQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [suggestedAction, setSuggestedAction] = useState<{
    skill: string;
    zone: string;
    feed: string;
    action: string;
  } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  useEffect(() => {
    setVoiceLang(language);
  }, [language]);

  const copy = VOICE_COPY[voiceLang] || VOICE_COPY.en;

  const liveSummary = useMemo(
    () => ({
      availableTechnicians: technicians.filter((t) => t.availabilityStatus === 'Available').length,
      totalProducts: products.length,
      activeZonesCount: zones.length,
    }),
    [technicians, products, zones]
  );

  const speakResponse = (text: string, targetLang: AppLanguage) => {
    if (!voiceOutputEnabled || typeof window === 'undefined' || !('speechSynthesis' in window)) {
      return;
    }
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      const locale = getSpeechLocale(targetLang);
      utterance.lang = locale;
      const voices = window.speechSynthesis.getVoices?.() || [];
      const matchingVoice =
        voices.find((v) => v.lang.toLowerCase() === locale.toLowerCase()) ||
        voices.find((v) => v.lang.toLowerCase().startsWith(targetLang));
      if (matchingVoice) {
        utterance.voice = matchingVoice;
      }
      utterance.rate = 1;
      window.speechSynthesis.speak(utterance);
    } catch {
      // Ignore synthesis playback errors cleanly
    }
  };

  const askGeminiVoice = async (textQuery: string, overrideLang?: AppLanguage) => {
    const cleaned = textQuery.trim();
    if (!cleaned) return;
    const activeLang = overrideLang || voiceLang;
    setLastQuery(cleaned);
    setBusy(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/ai/voice-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: cleaned,
          language: activeLang,
          userRole: activeRole,
          clusterZone: userAccount?.clusterZone || 'Andheri',
          liveSummary,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || VOICE_COPY[activeLang].networkError);
      }
      const replyLang: AppLanguage =
        data.resolvedLanguage === 'hi' || data.resolvedLanguage === 'mr' || data.resolvedLanguage === 'en'
          ? data.resolvedLanguage
          : activeLang;
      const reply = String(data.replyText || '').trim();
      if (!reply) {
        throw new Error(VOICE_COPY[activeLang].parseUnclear);
      }
      const nextAction = {
        skill: String(data.suggestedSkill || ''),
        zone: String(data.suggestedZone || ''),
        feed: String(data.suggestedFeed || ''),
        action: String(data.action || 'none'),
      };
      setReplyText(reply);
      setSuggestedAction(nextAction);
      speakResponse(reply, replyLang);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : VOICE_COPY[activeLang].networkError);
    } finally {
      setBusy(false);
    }
  };

  const toggleVoiceCapture = () => {
    if (listening && recognitionRef.current) {
      recognitionRef.current.stop();
      setListening(false);
      return;
    }

    const win = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionLike;
      webkitSpeechRecognition?: new () => SpeechRecognitionLike;
    };
    const SpeechRec = win.SpeechRecognition || win.webkitSpeechRecognition;

    if (!SpeechRec) {
      setOpen(true);
      setErrorMsg(copy.speechUnsupported);
      return;
    }

    try {
      const recognition = new SpeechRec();
      recognition.lang = getSpeechLocale(voiceLang);
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;
      recognition.onresult = (event: SpeechRecognitionEventLike) => {
        const transcript = event.results[0]?.[0]?.transcript || '';
        setQuery(transcript);
        setOpen(true);
        if (!transcript.trim()) {
          setErrorMsg(copy.noSpeech);
          return;
        }
        void askGeminiVoice(transcript, voiceLang);
      };
      recognition.onerror = (errEvent?: SpeechRecognitionErrorEventLike) => {
        setListening(false);
        const code = errEvent?.error || '';
        if (code === 'not-allowed' || code === 'service-not-allowed') {
          setErrorMsg(copy.micDenied);
        } else if (code === 'no-speech') {
          setErrorMsg(copy.noSpeech);
        } else {
          setErrorMsg(copy.micGenericError);
        }
      };
      recognition.onend = () => setListening(false);

      recognitionRef.current = recognition;
      setListening(true);
      setOpen(true);
      setErrorMsg(null);
      recognition.start();
    } catch {
      setListening(false);
      setOpen(true);
      setErrorMsg(copy.micDenied);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void askGeminiVoice(query, voiceLang);
  };

  const handleApplySuggestion = () => {
    if (!suggestedAction) return;
    if (suggestedAction.action === 'open_booking') {
      onOpenBookingHelp?.();
      setOpen(false);
      return;
    }
    if (suggestedAction.action === 'open_cart') {
      onOpenCart?.();
      setOpen(false);
      return;
    }
    onApplySearch?.({
      skill: suggestedAction.skill || undefined,
      zone: suggestedAction.zone || undefined,
      feed: suggestedAction.feed || undefined,
    });
    setOpen(false);
  };

  const hasActionableMatch = Boolean(
    suggestedAction &&
      (suggestedAction.skill ||
        suggestedAction.zone ||
        suggestedAction.feed ||
        (suggestedAction.action && suggestedAction.action !== 'none'))
  );

  const isParseUnclear = Boolean(suggestedAction && !hasActionableMatch && replyText);

  return (
    <div className="fixed bottom-20 md:bottom-6 right-5 z-40 flex flex-col items-end gap-3">
      {open && (
        <div
          className="w-[calc(100vw-2.5rem)] max-w-sm rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden"
          role="dialog"
          aria-label="AI Voice Assistant"
        >
          <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between gap-2 bg-slate-900 text-white">
            <div className="min-w-0">
              <div className="text-sm font-semibold truncate">{copy.title}</div>
              <div className="text-xs text-slate-300 truncate">{copy.subtitle}</div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => {
                  const next = !voiceOutputEnabled;
                  setVoiceOutputEnabled(next);
                  if (!next && typeof window !== 'undefined' && 'speechSynthesis' in window) {
                    window.speechSynthesis.cancel();
                  }
                }}
                aria-label={voiceOutputEnabled ? 'Mute spoken response' : 'Enable spoken response'}
                className="p-1.5 rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white"
              >
                {voiceOutputEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close voice assistant"
                className="p-1.5 rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Voice Assistant Language Switcher */}
          <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-2">
            <span className="text-[11px] font-medium text-slate-600 whitespace-nowrap">
              {voiceLang === 'hi' ? 'आवाज़ भाषा:' : voiceLang === 'mr' ? 'आवाज भाषा:' : 'Voice Language:'}
            </span>
            <div role="group" aria-label="Voice assistant language" className="inline-flex rounded-md border border-slate-300 bg-white p-0.5">
              {(
                [
                  ['en', 'EN'],
                  ['hi', 'हिंदी'],
                  ['mr', 'मराठी'],
                ] as const
              ).map(([code, label]) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => {
                    setVoiceLang(code);
                    setLanguage(code);
                    setErrorMsg(null);
                  }}
                  aria-pressed={voiceLang === code}
                  className={`px-2 py-0.5 text-[11px] font-semibold rounded transition-colors whitespace-nowrap ${
                    voiceLang === code ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="p-4 space-y-3">
            {busy && (
              <div
                role="status"
                aria-live="polite"
                className="rounded-xl border border-amber-200 bg-amber-50/80 px-3 py-2.5 flex items-center gap-2.5 text-xs font-medium text-amber-950"
              >
                <Loader2 className="w-4 h-4 animate-spin text-amber-600 shrink-0" />
                <span>{copy.processingLabel}</span>
              </div>
            )}

            {errorMsg && (
              <div
                role="alert"
                className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-900 space-y-2"
              >
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <span className="leading-relaxed">{errorMsg}</span>
                </div>
                {lastQuery && (
                  <button
                    type="button"
                    onClick={() => void askGeminiVoice(lastQuery, voiceLang)}
                    disabled={busy}
                    className="inline-flex items-center gap-1 rounded-md border border-red-300 bg-white px-2.5 py-1 text-[11px] font-medium text-red-800 hover:bg-red-50"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>{copy.retry}</span>
                  </button>
                )}
              </div>
            )}

            {lastQuery && replyText && !busy && (
              <div className="text-[11px] text-slate-500 truncate">
                <span className="font-medium text-slate-700">{copy.youAsked}:</span> “{lastQuery}”
              </div>
            )}

            {replyText ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2.5">
                <p className="text-xs text-slate-800 leading-relaxed">{replyText}</p>
                {hasActionableMatch && suggestedAction && (
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={handleApplySuggestion}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800"
                    >
                      <span>
                        {suggestedAction.action === 'open_booking'
                          ? copy.openBooking
                          : suggestedAction.action === 'open_cart'
                            ? copy.openCart
                            : `${copy.showMatchesPrefix} ${
                                suggestedAction.skill
                                  ? translateSkillCategory(suggestedAction.skill, voiceLang)
                                  : suggestedAction.feed || 'Matches'
                              }${suggestedAction.zone ? ` · ${suggestedAction.zone}` : ''}`}
                      </span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                    {suggestedAction.action === 'search' && (
                      <button
                        type="button"
                        onClick={() => {
                          onOpenBookingHelp?.();
                          setOpen(false);
                        }}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
                      >
                        {copy.openBooking}
                      </button>
                    )}
                  </div>
                )}
                {isParseUnclear && (
                  <div className="pt-1 flex flex-wrap gap-1.5">
                    {copy.samples.slice(0, 2).map((sample) => (
                      <button
                        key={sample}
                        type="button"
                        onClick={() => {
                          setQuery(sample);
                          void askGeminiVoice(sample, voiceLang);
                        }}
                        className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-700 hover:bg-slate-100"
                      >
                        {sample}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-xs text-slate-600 space-y-2">
                <p>{copy.promptHint}</p>
                <div className="flex flex-wrap gap-1.5">
                  {copy.samples.map((sample) => (
                    <button
                      key={sample}
                      type="button"
                      onClick={() => {
                        setQuery(sample);
                        void askGeminiVoice(sample, voiceLang);
                      }}
                      className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-700 hover:bg-slate-100 text-left"
                    >
                      {sample}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="flex items-center gap-2">
              <button
                type="button"
                onClick={toggleVoiceCapture}
                disabled={busy}
                aria-label={listening ? 'Stop voice capture' : 'Start voice capture'}
                className={`min-h-[40px] min-w-[40px] inline-flex items-center justify-center rounded-lg border transition-colors disabled:opacity-50 ${
                  listening
                    ? 'border-red-500 bg-red-50 text-red-700 animate-pulse'
                    : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                {listening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={listening ? copy.listeningLabel : copy.placeholder}
                className="flex-1 min-h-[40px] rounded-lg border border-slate-300 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-amber-600"
              />
              <button
                type="submit"
                disabled={busy || !query.trim()}
                aria-label="Send voice query"
                className="min-h-[40px] min-w-[40px] inline-flex items-center justify-center rounded-lg bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50"
              >
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
            </form>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Toggle AI Voice Assistant"
        className="h-12 px-4 rounded-full bg-slate-900 text-white shadow-lg border border-slate-700 hover:bg-slate-800 inline-flex items-center gap-2 text-xs font-semibold whitespace-nowrap"
      >
        {busy ? (
          <Loader2 className="w-4 h-4 text-amber-400 animate-spin" />
        ) : (
          <Mic className="w-4 h-4 text-amber-400" />
        )}
        <span>{listening ? copy.listeningLabel : busy ? copy.processingLabel : copy.buttonLabel}</span>
      </button>
    </div>
  );
};
