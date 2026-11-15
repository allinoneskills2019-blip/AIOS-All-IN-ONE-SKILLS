import React from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { Bell, ExternalLink, X } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useMarketplace } from '../context/MarketplaceContext';
import { db } from '../lib/firebase';
import { handleFirestoreError, OperationType } from '../lib/firestoreError';

interface NotificationsDrawerProps {
  open: boolean;
  onClose: () => void;
}

export const NotificationsDrawer: React.FC<NotificationsDrawerProps> = ({ open, onClose }) => {
  const { notifications, userAccount, userPII } = useMarketplace();
  const { t } = useLanguage();

  if (!open) return null;

  const markAsRead = async (id: string) => {
    try {
      await updateDoc(doc(db, 'notifications', id), { read: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `notifications/${id}`);
    }
  };

  const whatsappDigest = encodeURIComponent(
    `All in One Skill (${userAccount?.clusterZone || 'Mumbai'}): Latest update check for ${userAccount?.displayName || 'Member'}.`
  );

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/50 backdrop-blur-sm">
      <div className="w-full max-w-md bg-white h-full border-l border-slate-200 flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-amber-600" />
            <h2 className="text-base font-semibold text-slate-900">{t.notifications.title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t.common.close}
            className="p-2 rounded-lg text-slate-500 hover:bg-slate-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs">
          <span className="text-slate-600">
            {t.notifications.smsOtp}: {userAccount?.phoneVerified ? t.notifications.verified : t.notifications.pending} · {t.notifications.whatsapp}:{' '}
            {userPII?.whatsappOptIn ? t.notifications.authorized : t.notifications.disabled}
          </span>
          {userPII?.whatsappOptIn && (
            <a
              href={`https://wa.me/?text=${whatsappDigest}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 font-medium text-emerald-700 hover:underline"
            >
              {t.notifications.whatsappAlert} <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-slate-100 p-4">
          {notifications.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-12">
              {t.notifications.empty}
            </p>
          ) : (
            notifications.map((n) => (
              <div
                key={n.id}
                className={`py-3.5 px-2 space-y-1 ${n.read ? 'opacity-65' : ''}`}
              >
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span className="capitalize">
                    {n.category} · {n.channel.replace('_', ' ')}
                  </span>
                  {!n.read && (
                    <button
                      type="button"
                      onClick={() => markAsRead(n.id)}
                      className="text-amber-700 font-medium hover:underline"
                    >
                      {t.notifications.markRead}
                    </button>
                  )}
                </div>
                <div className="text-sm font-semibold text-slate-900">{n.title}</div>
                <p className="text-xs text-slate-600">{n.body}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
