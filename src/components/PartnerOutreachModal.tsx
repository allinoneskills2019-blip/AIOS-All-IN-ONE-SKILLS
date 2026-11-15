import React, { useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import { Check, Copy, Download, QrCode, Share2, Users, X } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import type { AppLanguage } from '../lib/i18n';

interface PartnerOutreachModalProps {
  open: boolean;
  onClose: () => void;
}

type TargetAudience = 'technicians' | 'shops' | 'contractors';

const MODAL_TEXT: Record<
  AppLanguage,
  {
    title: string;
    subtitle: string;
    honestyNote: string;
    audienceLabel: string;
    techniciansTab: string;
    shopsTab: string;
    contractorsTab: string;
    previewLabel: string;
    shareWhatsapp: string;
    nativeShare: string;
    copyMsg: string;
    copiedMsg: string;
    downloadQr: string;
    qrHint: string;
  }
> = {
  en: {
    title: 'Partner Recruitment & Referral Kit',
    subtitle: 'Invite verified Mumbai technicians, electrical/hardware shops, and contractors to join All in One Skill.',
    honestyNote:
      'Only real partners who complete OTP or Google sign-up appear in the directory — no unverified or fabricated listings are auto-uploaded.',
    audienceLabel: 'Select Partner Type',
    techniciansTab: 'Technicians & Mechanics',
    shopsTab: 'Electrical & Hardware Shops',
    contractorsTab: 'Contractors',
    previewLabel: 'Ready-to-Send Invite Message',
    shareWhatsapp: 'Send on WhatsApp',
    nativeShare: 'Share App Link',
    copyMsg: 'Copy Message',
    copiedMsg: 'Copied!',
    downloadQr: 'Download QR',
    qrHint: 'Scan to register in under 60 seconds',
  },
  hi: {
    title: 'पार्टनर जोड़ो और वायरल शेयर किट',
    subtitle: 'मुंबई के इलेक्ट्रीशियन, हार्डवेयर दुकानदारों, मैकेनिकों और ठेकेदारों को सीधे आमंत्रित करें।',
    honestyNote:
      'डायरेक्टरी में केवल वही असली टेक्नीशियन और दुकानदार दिखते हैं जो स्वयं OTP या Google से पंजीकरण करते हैं — कोई फ़र्ज़ी डेटा अपलोड नहीं किया जाता।',
    audienceLabel: 'पार्टनर श्रेणी चुनें',
    techniciansTab: 'टेक्नीशियन और मैकेनिक',
    shopsTab: 'इलेक्ट्रिकल व हार्डवेयर दुकानें',
    contractorsTab: 'ठेकेदार',
    previewLabel: 'तैयार आमंत्रण संदेश (सीधे भेजें)',
    shareWhatsapp: 'WhatsApp पर भेजें',
    nativeShare: 'ऐप लिंक शेयर करें',
    copyMsg: 'संदेश कॉपी करें',
    copiedMsg: 'कॉपी हो गया!',
    downloadQr: 'QR डाउनलोड करें',
    qrHint: '६० सेकंड में रजिस्टर करने के लिए स्कैन करें',
  },
  mr: {
    title: 'पार्टनर भरती आणि शेअर किट',
    subtitle: 'मुंबईतील इलेक्ट्रिशियन, हार्डवेअर दुकाने, मॅकॅनिक आणि कंत्राटदारांना थेट आमंत्रित करा.',
    honestyNote:
      'डिरेक्टरीमध्ये फक्त OTP किंवा Google द्वारे स्वतः नोंदणी केलेले खरे तंत्रज्ञ व दुकानदार दिसतात — कोणतीही बनावट नावे अपलोड केली जात नाहीत.',
    audienceLabel: 'भागीदार प्रकार निवडा',
    techniciansTab: 'तंत्रज्ञ आणि मॅकॅनिक',
    shopsTab: 'इलेक्ट्रिकल व हार्डवेअर दुकाने',
    contractorsTab: 'कंत्राटदार',
    previewLabel: 'पाठवण्यासाठी तयार संदेश',
    shareWhatsapp: 'WhatsApp वर पाठवा',
    nativeShare: 'अॅप लिंक शेअर करा',
    copyMsg: 'संदेश कॉपी करा',
    copiedMsg: 'कॉपी झाले!',
    downloadQr: 'QR डाउनलोड करा',
    qrHint: '६० सेकंदांत नोंदणीसाठी स्कॅन करा',
  },
};

function buildInviteMessage(lang: AppLanguage, audience: TargetAudience, appUrl: string): string {
  if (lang === 'hi') {
    if (audience === 'shops') {
      return `नमस्ते! अपने मुंबई इलेक्ट्रिकल और हार्डवेयर स्टोर को All in One Skill से जोड़ें। अपने एरिया (अंधेरी, दादर, बांद्रा, बोरीवली व सभी ५८ मुंबई ज़ोन) के ग्राहकों और टेक्नीशियनों से सीधे ऑर्डर और पूछताछ पाएं। मुफ्त जुड़ने के लिए अभी खोलें: ${appUrl}`;
    }
    if (audience === 'contractors') {
      return `नमस्ते! All in One Skill मुंबई पर अपने निर्माण प्रोजेक्ट पोस्ट करें और ३–१० किमी दायरे में सत्यापित इलेक्ट्रिशियन, प्लंबर, कारपेंटर और मैकेनिक तुरंत नियुक्त करें। अभी जुड़ें: ${appUrl}`;
    }
    return `नमस्ते! क्या आप इलेक्ट्रिशियन, प्लंबर, एसी टेक्नीशियन, ब्यूटीशियन, बाइक/फोर-व्हीलर या EVM मैकेनिक हैं? All in One Skill मुंबई पर ६० सेकंड में जुड़ें और अपने ५ किमी इलाके के सीधे ग्राहक व ठेकेदार काम पाएं। लिंक खोलें: ${appUrl}`;
  }
  if (lang === 'mr') {
    if (audience === 'shops') {
      return `नमस्कार! तुमचे मुंबईतील इलेक्ट्रिकल आणि हार्डवेअर दुकान All in One Skill वर नोंदवा आणि जवळच्या ग्राहक व तंत्रज्ञांकडून थेट ऑर्डर्स मिळवा. लिंक: ${appUrl}`;
    }
    if (audience === 'contractors') {
      return `नमस्कार! All in One Skill मुंबईवर साईट प्रोजेक्ट पोस्ट करा आणि ३–१० किमीमधील पडताळलेले इलेक्ट्रिशियन, प्लंबर व मॅकॅनिक थेट नेमा: ${appUrl}`;
    }
    return `नमस्कार! तुम्ही इलेक्ट्रिशियन, प्लंबर, एसी तंत्रज्ञ, ब्यूटीशियन, बाइक किंवा ईव्हीएम मॅकॅनिक आहात का? All in One Skill मुंबईवर मोफत नोंदणी करा आणि ५ किमी परिसरातील थेट कामे मिळवा: ${appUrl}`;
  }
  if (audience === 'shops') {
    return `Hello! List your Mumbai Electrical & Hardware Store on All in One Skill to receive direct local orders, member-discount enquiries, and courier dispatches across 58 Mumbai zones. Register free in 60 seconds: ${appUrl}`;
  }
  if (audience === 'contractors') {
    return `Hello! Post construction projects and hire verified Mumbai electricians, plumbers, beauticians, and EV/auto mechanics within 3–10 km on All in One Skill. Join now: ${appUrl}`;
  }
  return `Hello! Are you a skilled Electrician, Plumber, AC Tech, Beautician, Bike/Four-wheeler or EVM Mechanic in Mumbai? Register free on All in One Skill to receive direct customer bookings and 5 km urgent dispatch jobs: ${appUrl}`;
}

export const PartnerOutreachModal: React.FC<PartnerOutreachModalProps> = ({ open, onClose }) => {
  const { language } = useLanguage();
  const [msgLang, setMsgLang] = useState<AppLanguage>(language);
  const [audience, setAudience] = useState<TargetAudience>('technicians');
  const [copied, setCopied] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');

  useEffect(() => {
    setMsgLang(language);
  }, [language]);

  const appUrl =
    typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : 'https://ais-pre-qo3kxiduq6rs3dhqtxynxu-828642031036.asia-northeast1.run.app';

  const messageText = useMemo(
    () => buildInviteMessage(msgLang, audience, appUrl),
    [msgLang, audience, appUrl]
  );

  useEffect(() => {
    if (!open) return;
    let active = true;
    QRCode.toDataURL(appUrl, { width: 220, margin: 1 })
      .then((url) => {
        if (active) setQrDataUrl(url);
      })
      .catch(() => {
        if (active) setQrDataUrl('');
      });
    return () => {
      active = false;
    };
  }, [open, appUrl]);

  if (!open) return null;

  const text = MODAL_TEXT[language] || MODAL_TEXT.en;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(messageText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Ignore clipboard failure in restricted context
    }
  };

  const handleWhatsappShare = () => {
    const waUrl = `https://wa.me/?text=${encodeURIComponent(messageText)}`;
    const link = document.createElement('a');
    link.href = waUrl;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.click();
  };

  const handleNativeShare = async () => {
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title: 'All in One Skill — Mumbai Marketplace',
          text: messageText,
          url: appUrl,
        });
        return;
      } catch {
        // Fall through to clipboard copy if cancelled/unsupported
      }
    }
    await handleCopy();
  };

  const handleDownloadQr = () => {
    if (!qrDataUrl) return;
    const a = document.createElement('a');
    a.href = qrDataUrl;
    a.download = 'all-in-one-skill-invite-qr.png';
    a.click();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="partner-outreach-title"
    >
      <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
        <div className="px-5 py-4 border-b border-slate-200 flex items-start justify-between gap-3 bg-slate-900 text-white">
          <div className="flex items-start gap-2.5 min-w-0">
            <Users className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <h2 id="partner-outreach-title" className="text-base font-bold leading-snug">
                {text.title}
              </h2>
              <p className="text-xs text-slate-300 mt-0.5">{text.subtitle}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close partner recruitment kit"
            className="p-1.5 rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto">
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-950 leading-relaxed">
            {text.honestyNote}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
              {(
                [
                  ['technicians', text.techniciansTab],
                  ['shops', text.shopsTab],
                  ['contractors', text.contractorsTab],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setAudience(key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                    audience === key
                      ? 'bg-slate-900 text-white'
                      : 'border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="inline-flex rounded-lg border border-slate-300 bg-slate-100 p-0.5">
              {(
                [
                  ['hi', 'हिंदी'],
                  ['mr', 'मराठी'],
                  ['en', 'EN'],
                ] as const
              ).map(([code, label]) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => setMsgLang(code)}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${
                    msgLang === code ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-start">
            <div className="sm:col-span-8 space-y-2">
              <div className="text-xs font-semibold text-slate-700">{text.previewLabel}</div>
              <textarea
                readOnly
                rows={5}
                value={messageText}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-800 leading-relaxed focus:outline-none"
              />
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleWhatsappShare}
                  className="min-h-[40px] inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-700 whitespace-nowrap"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>{text.shareWhatsapp}</span>
                </button>
                <button
                  type="button"
                  onClick={handleNativeShare}
                  className="min-h-[40px] inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800 whitespace-nowrap"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>{text.nativeShare}</span>
                </button>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="min-h-[40px] inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-800 hover:bg-slate-50 whitespace-nowrap"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? text.copiedMsg : text.copyMsg}</span>
                </button>
              </div>
            </div>

            <div className="sm:col-span-4 rounded-xl border border-slate-200 bg-slate-50 p-3 flex flex-col items-center text-center space-y-2">
              {qrDataUrl ? (
                <img
                  src={qrDataUrl}
                  alt="QR code to register on All in One Skill"
                  className="w-32 h-32 rounded-lg border border-slate-200 bg-white p-1.5"
                />
              ) : (
                <div className="w-32 h-32 rounded-lg border border-slate-200 bg-white flex items-center justify-center text-slate-400">
                  <QrCode className="w-10 h-10" />
                </div>
              )}
              <p className="text-[11px] text-slate-600 leading-snug">{text.qrHint}</p>
              <button
                type="button"
                onClick={handleDownloadQr}
                disabled={!qrDataUrl}
                className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-100 disabled:opacity-50"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{text.downloadQr}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
