import React, { useState } from 'react';
import { Download, FileCode, Smartphone, WifiOff, X } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { buildAndroidBuildScript, buildTwaManifestObject, triggerTextDownload } from '../lib/androidBuild';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const { t } = useLanguage();
  const [showModal, setShowModal] = useState(false);

  const handlePrimaryClick = async () => {
    if (isInstallable) {
      await install();
      return;
    }
    setShowModal(true);
  };

  const handleDownloadTwa = () => {
    const origin = typeof window !== 'undefined' ? window.location.origin : undefined;
    triggerTextDownload(
      'twa-manifest.json',
      JSON.stringify(buildTwaManifestObject(origin), null, 2),
      'application/json;charset=utf-8;'
    );
  };

  const handleDownloadBuildScript = () => {
    const origin = typeof window !== 'undefined' ? window.location.origin : undefined;
    triggerTextDownload('build-apk.sh', buildAndroidBuildScript(origin), 'text/x-shellscript;charset=utf-8;');
  };

  return (
    <>
      <button
        type="button"
        onClick={handlePrimaryClick}
        className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
      >
        {isInstallable ? (
          <>
            <Download className="w-3.5 h-3.5 text-amber-600" />
            {t.pwa.installAndroid}
          </>
        ) : (
          <>
            <Smartphone className="w-3.5 h-3.5 text-amber-600" />
            {isIOS ? t.pwa.installMobile : 'Android App / APK Kit'}
          </>
        )}
      </button>

      {showModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="pwa-android-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 id="pwa-android-modal-title" className="text-base font-bold text-slate-900">
                  {isIOS ? t.pwa.installTitle : 'Get All in One Skill on Android'}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {isInstalled
                    ? 'App is installed in standalone mode.'
                    : 'Install directly via Android Chrome or compile signed .apk / .aab packages.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                aria-label="Close dialog"
                className="p-1 text-slate-400 hover:text-slate-700 rounded-md"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {isIOS ? (
              <p className="text-sm text-slate-600 leading-relaxed">
                1. Tap the <strong>Share</strong> icon in Safari.<br />
                2. Select <strong>Add to Home Screen</strong> to launch All in One Skill as a full-screen mobile app.
              </p>
            ) : (
              <div className="space-y-3 text-xs text-slate-700 leading-relaxed">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-1">
                  <div className="font-semibold text-slate-900">1. Instant Android Install (No APK File Needed)</div>
                  <p>
                    Open this app in <strong>Google Chrome on Android</strong>, tap the browser menu (&#8942;) and choose{' '}
                    <strong>Install app</strong> or <strong>Add to Home screen</strong>.
                  </p>
                </div>

                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 space-y-2 text-amber-950">
                  <div className="font-semibold">2. Android APK &amp; Play Console (.aab) Build Kit</div>
                  <p>
                    Browsers cannot compile Android Java/Gradle binaries into a signed <span className="font-mono">.apk</span> on the fly. Download the pre-configured Bubblewrap files below or run{' '}
                    <span className="font-mono font-semibold">android/build-apk.sh</span> (or the included GitHub Actions workflow) to produce signed{' '}
                    <span className="font-mono">.apk</span> and <span className="font-mono">.aab</span> packages.
                  </p>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <a
                      href="/all-in-one-skill-android-kit.tar.gz"
                      download="all-in-one-skill-android-kit.tar.gz"
                      className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 whitespace-nowrap"
                    >
                      <Download className="w-3.5 h-3.5" /> Complete Android Kit (.tar.gz)
                    </a>
                    <button
                      type="button"
                      onClick={handleDownloadTwa}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-50 whitespace-nowrap"
                    >
                      <Download className="w-3.5 h-3.5 text-amber-600" /> twa-manifest.json
                    </button>
                    <button
                      type="button"
                      onClick={handleDownloadBuildScript}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-50 whitespace-nowrap"
                    >
                      <FileCode className="w-3.5 h-3.5 text-amber-600" /> build-apk.sh
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();
  const { t } = useLanguage();
  if (isOnline) return null;

  return (
    <div className="fixed bottom-20 md:bottom-4 left-4 z-50 flex items-center gap-2 rounded-lg bg-amber-600 px-3.5 py-2 text-xs font-medium text-white shadow-lg">
      <WifiOff className="w-4 h-4" />
      <span>{t.pwa.offlineBanner}</span>
    </div>
  );
};
