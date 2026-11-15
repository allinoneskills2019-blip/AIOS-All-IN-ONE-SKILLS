import React, { useMemo, useState } from 'react';
import {
  CreditCard,
  Minus,
  Plus,
  ShoppingBag,
  Smartphone,
  Trash2,
  Truck,
  Wallet,
  X,
} from 'lucide-react';
import { useMarketplace } from '../context/MarketplaceContext';
import { formatINR } from '../lib/constants';

interface CartDrawerProps {
  open: boolean;
  onClose: () => void;
  onRequireAuth: () => void;
  onCheckoutSuccess?: (totalPaid: number) => void;
}

export const CartDrawer: React.FC<CartDrawerProps> = ({
  open,
  onClose,
  onRequireAuth,
  onCheckoutSuccess,
}) => {
  const {
    user,
    userAccount,
    userPII,
    wallet,
    cart,
    updateCartQty,
    removeFromCart,
    clearCart,
    checkoutCart,
  } = useMarketplace();

  const [paymentMethod, setPaymentMethod] = useState<'UPI' | 'Wallet' | 'Card'>('UPI');
  const [shippingAddress, setShippingAddress] = useState(
    userPII?.fullAddress || `${userAccount?.clusterZone || 'Andheri'}, Mumbai`
  );
  const [paymentRef, setPaymentRef] = useState('');
  const [applyMemberDiscount, setApplyMemberDiscount] = useState(true);
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const summary = useMemo(() => {
    let subtotal = 0;
    let totalMemberDiscount = 0;
    let totalShipping = 0;

    for (const item of cart) {
      const lineSub = item.product.price * item.quantity;
      subtotal += lineSub;
      if (applyMemberDiscount && (item.product.memberDiscountPercent || 0) > 0) {
        totalMemberDiscount += Math.round(
          (lineSub * (item.product.memberDiscountPercent || 0)) / 100
        );
      }
      if (item.product.shippingAvailable) {
        totalShipping += item.product.shippingFee || 0;
      }
    }

    const netTotal = Math.max(0, subtotal - totalMemberDiscount + totalShipping);
    return { subtotal, totalMemberDiscount, totalShipping, netTotal };
  }, [cart, applyMemberDiscount]);

  if (!open) return null;

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!user) {
      onClose();
      onRequireAuth();
      return;
    }
    if (cart.length === 0) return;

    if (paymentMethod === 'UPI' && !paymentRef.trim()) {
      setErrorMsg('Enter your UPI transaction / UTR reference ID to place order.');
      return;
    }
    if (paymentMethod === 'Card' && paymentRef.trim().length < 4) {
      setErrorMsg('Enter Card last 4 digits or payment authorization code.');
      return;
    }

    setBusy(true);
    try {
      const total = await checkoutCart({
        paymentMethod,
        shippingAddress: shippingAddress.trim(),
        utrReference: paymentRef.trim(),
        applyMemberDiscount,
      });
      setSuccessMsg(`Direct purchase confirmed! Total: ${formatINR(total)}. Track shipping in Customer Hub.`);
      setPaymentRef('');
      onCheckoutSuccess?.(total);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Checkout failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-slate-950/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Direct Purchase Shopping Cart"
    >
      <div className="w-full max-w-md bg-white h-full border-l border-slate-200 flex flex-col justify-between overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-amber-600" />
            <div>
              <h2 className="text-base font-bold text-slate-900">Direct Purchase Cart</h2>
              <p className="text-xs text-slate-500">
                {cart.reduce((sum, i) => sum + i.quantity, 0)} item(s) · Member discounts auto-applied
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close cart drawer"
            className="min-h-[38px] min-w-[38px] inline-flex items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {successMsg && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3.5 text-xs font-medium text-emerald-900">
              {successMsg}
            </div>
          )}
          {errorMsg && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3.5 text-xs font-medium text-red-900">
              {errorMsg}
            </div>
          )}

          {cart.length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <p className="text-sm font-medium text-slate-700">Your cart is empty.</p>
              <p className="text-xs text-slate-500">
                Browse Mumbai shopkeeper products in the marketplace to add items with member discounts and courier tracking.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {cart.map(({ product, quantity }) => {
                const discountPct = product.memberDiscountPercent || 0;
                const lineSubtotal = product.price * quantity;
                const lineDiscount = applyMemberDiscount
                  ? Math.round((lineSubtotal * discountPct) / 100)
                  : 0;
                return (
                  <div key={product.id} className="py-3.5 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-slate-900 truncate">
                          {product.name}
                        </div>
                        <div className="text-xs text-slate-500">
                          {product.shopName} · {product.clusterZone}
                        </div>
                        {discountPct > 0 && (
                          <div className="text-xs font-medium text-emerald-700 font-mono tabular-nums mt-0.5">
                            Member Discount: {discountPct}% off (-{formatINR(lineDiscount)})
                          </div>
                        )}
                        {product.shippingAvailable && (
                          <div className="text-xs text-slate-600 flex items-center gap-1 mt-0.5">
                            <Truck className="w-3 h-3 text-slate-500" />
                            <span>
                              {product.courierPartner || 'Mumbai Courier'} ·{' '}
                              {product.shippingFee ? formatINR(product.shippingFee) : 'Free shipping'}
                              {product.deliveryEta ? ` · ${product.deliveryEta}` : ''}
                            </span>
                          </div>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => removeFromCart(product.id)}
                        aria-label={`Remove ${product.name}`}
                        className="p-1.5 text-slate-400 hover:text-red-600"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="inline-flex items-center rounded-lg border border-slate-200 bg-slate-50">
                        <button
                          type="button"
                          onClick={() => updateCartQty(product.id, quantity - 1)}
                          aria-label="Decrease quantity"
                          className="p-1.5 text-slate-700 hover:bg-white rounded-l-lg"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="px-3 text-xs font-mono tabular-nums font-semibold">
                          {quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => updateCartQty(product.id, quantity + 1)}
                          aria-label="Increase quantity"
                          className="p-1.5 text-slate-700 hover:bg-white rounded-r-lg"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="text-sm font-bold font-mono tabular-nums text-slate-900">
                        {formatINR(lineSubtotal - lineDiscount)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {cart.length > 0 && (
            <form id="cart-checkout-form" onSubmit={handleCheckout} className="space-y-4 pt-2 border-t border-slate-200">
              <label className="flex items-center justify-between text-xs text-slate-700">
                <span>Apply All in One Skill Member Discount</span>
                <input
                  type="checkbox"
                  checked={applyMemberDiscount}
                  onChange={(e) => setApplyMemberDiscount(e.target.checked)}
                  className="rounded border-slate-300"
                />
              </label>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Delivery Address (Mumbai)
                </label>
                <textarea
                  rows={2}
                  required
                  value={shippingAddress}
                  onChange={(e) => setShippingAddress(e.target.value)}
                  placeholder="Flat, building, street, Mumbai pin code"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Payment Method
                </label>
                <div className="grid grid-cols-3 gap-1.5 p-1 rounded-lg bg-slate-100">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('UPI')}
                    className={`py-2 text-xs font-medium rounded-md flex items-center justify-center gap-1 ${
                      paymentMethod === 'UPI' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
                    }`}
                  >
                    <Smartphone className="w-3.5 h-3.5" /> UPI
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('Wallet')}
                    className={`py-2 text-xs font-medium rounded-md flex items-center justify-center gap-1 ${
                      paymentMethod === 'Wallet' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
                    }`}
                  >
                    <Wallet className="w-3.5 h-3.5" /> Wallet
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('Card')}
                    className={`py-2 text-xs font-medium rounded-md flex items-center justify-center gap-1 ${
                      paymentMethod === 'Card' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
                    }`}
                  >
                    <CreditCard className="w-3.5 h-3.5" /> Card
                  </button>
                </div>
              </div>

              {paymentMethod === 'Wallet' ? (
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700 flex items-center justify-between">
                  <span>Available Wallet Balance</span>
                  <span className="font-mono tabular-nums font-semibold text-slate-900">
                    {formatINR(wallet?.balance ?? 0)}
                  </span>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    {paymentMethod === 'UPI'
                      ? 'UPI Transaction / UTR Reference'
                      : 'Card Last 4 Digits / Auth Code'}
                  </label>
                  <input
                    type="text"
                    required
                    value={paymentRef}
                    onChange={(e) => setPaymentRef(e.target.value)}
                    placeholder={paymentMethod === 'UPI' ? 'e.g. 429910384920' : 'e.g. 4242'}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono"
                  />
                </div>
              )}
            </form>
          )}
        </div>

        {cart.length > 0 && (
          <div className="p-5 border-t border-slate-200 bg-slate-50 space-y-3">
            <div className="space-y-1 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal</span>
                <span className="font-mono tabular-nums">{formatINR(summary.subtotal)}</span>
              </div>
              {summary.totalMemberDiscount > 0 && (
                <div className="flex justify-between text-emerald-700">
                  <span>Member Discounts</span>
                  <span className="font-mono tabular-nums">-{formatINR(summary.totalMemberDiscount)}</span>
                </div>
              )}
              <div className="flex justify-between text-slate-600">
                <span>Shipping &amp; Courier</span>
                <span className="font-mono tabular-nums">
                  {summary.totalShipping > 0 ? formatINR(summary.totalShipping) : 'Free'}
                </span>
              </div>
              <div className="flex justify-between text-sm font-bold text-slate-900 pt-1.5 border-t border-slate-200">
                <span>Payable Total</span>
                <span className="font-mono tabular-nums">{formatINR(summary.netTotal)}</span>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={clearCart}
                className="min-h-[42px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100"
              >
                Clear
              </button>
              <button
                type="submit"
                form="cart-checkout-form"
                disabled={busy}
                className="flex-1 min-h-[42px] rounded-lg bg-amber-600 px-4 py-2 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
              >
                {busy ? 'Processing...' : `Complete Direct Purchase (${formatINR(summary.netTotal)})`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
