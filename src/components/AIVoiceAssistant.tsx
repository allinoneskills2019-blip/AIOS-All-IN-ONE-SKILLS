import React, { useMemo, useRef, useState } from 'react';
import { Mic, MicOff, Send, Volume2, VolumeX, X, ArrowRight } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useMarketplace } from '../context/MarketplaceContext';

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

interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
}

export const AIVoiceAssistant: React.FC<AIVoiceAssistantProps> = ({
  onApplySearch,
  onOpenBookingHelp,
  onOpenCart,
}) => {
  const { userAccount, activeRole, technicians, products, zones } = useMarketplace();
  const { language } = useLanguage();

  const [open, setOpen] = useState(false);
  const [listening, setListening] = useState(false);
  const [voiceOutputEnabled, setVoiceOutputEnabled] = useState(true);
  const [query, setQuery] = useState('');
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

  const liveSummary = useMemo(
    () => ({
      availableTechnicians: technicians.filter((t) => t.availabilityStatus === 'Available').length,
      totalProducts: products.length,
      activeZonesCount: zones.length,
    }),
    [technicians, products, zones]
  );

  const speakResponse = (text: string) => {
    if (!voiceOutputEnabled || typeof window === 'undefined' || !('speechSynthesis' in window)) {
      return;
    }
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = language === 'mr' ? 'mr-IN' : 'en-IN';
      utterance.rate = 1;
      window.speechSynthesis.speak(utterance);
    } catch {
      // Ignore synthesis playback errors cleanly
    }
  };

  const askGeminiVoice = async (textQuery: string) => {
    const cleaned = textQuery.trim();
    if (!cleaned) return;
    setBusy(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/ai/voice-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: cleaned,
          language,
          userRole: activeRole,
          clusterZone: userAccount?.clusterZone || 'Andheri',
          liveSummary,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Voice assistant request failed.');
      }
      const reply = String(data.replyText || 'Let me help you find Mumbai services.');
      setReplyText(reply);
      setSuggestedAction({
        skill: String(data.suggestedSkill || ''),
        zone: String(data.suggestedZone || ''),
        feed: String(data.suggestedFeed || ''),
        action: String(data.action || 'none'),
      });
      speakResponse(reply);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to reach AI Voice Assistant.');
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
      setErrorMsg(
        'Voice microphone recognition is unavailable in this browser. Type your request below for spoken & text help.'
      );
      return;
    }

    try {
      const recognition = new SpeechRec();
      recognition.lang = language === 'mr' ? 'mr-IN' : 'en-IN';
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;
      recognition.onresult = (event: SpeechRecognitionEventLike) => {
        const transcript = event.results[0]?.[0]?.transcript || '';
        setQuery(transcript);
        setOpen(true);
        void askGeminiVoice(transcript);
      };
      recognition.onerror = () => {
        setListening(false);
        setErrorMsg('Could not capture audio. You can type your service request below.');
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
      setErrorMsg('Microphone permission required for voice input. Type your question below.');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void askGeminiVoice(query);
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

  return (
    <div className="fixed bottom-20 md:bottom-6 right-5 z-40 flex flex-col items-end gap-3">
      {open && (
        <div
          className="w-[calc(100vw-2.5rem)] max-w-sm rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden"
          role="dialog"
          aria-label="AI Voice Assistant"
        >
          <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between bg-slate-900 text-white">
            <div className="min-w-0">
              <div className="text-sm font-semibold truncate">AI Voice Service Assistant</div>
              <div className="text-xs text-slate-300 truncate">
                Search Mumbai services, availability &amp; booking help
              </div>
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

          <div className="p-4 space-y-3">
            {errorMsg && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                {errorMsg}
              </div>
            )}

            {replyText ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2.5">
                <p className="text-xs text-slate-800 leading-relaxed">{replyText}</p>
                {suggestedAction &&
                  (suggestedAction.skill ||
                    suggestedAction.zone ||
                    suggestedAction.feed ||
                    suggestedAction.action !== 'none') && (
                    <button
                      type="button"
                      onClick={handleApplySuggestion}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800"
                    >
                      <span>
                        {suggestedAction.action === 'open_booking'
                          ? 'Open Booking Hub'
                          : suggestedAction.action === 'open_cart'
                            ? 'Open Shopping Cart'
                            : `Show ${suggestedAction.skill || suggestedAction.feed || 'Matches'}${
                                suggestedAction.zone ? ` in ${suggestedAction.zone}` : ''
                              }`}
                      </span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}
              </div>
            ) : (
              <div className="text-xs text-slate-600 space-y-2">
                <p>Tap the microphone or ask in English / Marathi:</p>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    'Electrician available in Andheri',
                    'EV bike mechanic near Dadar',
                    'Discounted wiring & tools',
                  ].map((sample) => (
                    <button
                      key={sample}
                      type="button"
                      onClick={() => {
                        setQuery(sample);
                        void askGeminiVoice(sample);
                      }}
                      className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-700 hover:bg-slate-100"
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
                aria-label={listening ? 'Stop voice capture' : 'Start voice capture'}
                className={`min-h-[40px] min-w-[40px] inline-flex items-center justify-center rounded-lg border transition-colors ${
                  listening
                    ? 'border-red-500 bg-red-50 text-red-700'
                    : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                {listening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={listening ? 'Listening...' : 'Ask about services or bookings...'}
                className="flex-1 min-h-[40px] rounded-lg border border-slate-300 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-amber-600"
              />
              <button
                type="submit"
                disabled={busy || !query.trim()}
                aria-label="Send voice query"
                className="min-h-[40px] min-w-[40px] inline-flex items-center justify-center rounded-lg bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
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
        <Mic className="w-4 h-4 text-amber-400" />
        <span>{listening ? 'Listening...' : 'AI Voice Help'}</span>
      </button>
    </div>
  );
};
