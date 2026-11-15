import React, { useEffect, useMemo, useRef, useState } from 'react';
import { addDoc, collection, deleteDoc, doc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { CheckCircle2, Megaphone, Package, Plus, Trash2, Truck } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useMarketplace } from '../context/MarketplaceContext';
import { db } from '../lib/firebase';
import { formatINR, PRODUCT_CATEGORIES } from '../lib/constants';
import { translateProductCategory } from '../lib/i18n';
import { handleFirestoreError, OperationType } from '../lib/firestoreError';
import type { Product, ProductOrder } from '../types';

interface ShopkeeperDashboardProps {
  onRequireAuth: () => void;
}

export const ShopkeeperDashboard: React.FC<ShopkeeperDashboardProps> = ({ onRequireAuth }) => {
  const {
    user,
    userAccount,
    zones,
    shops,
    products,
    orders,
    enquiries,
    platformConfig,
    createNotification,
  } = useMarketplace();
  const { language, t } = useLanguage();

  const myShop = useMemo(() => shops.find((s) => s.ownerId === user?.uid) || null, [shops, user]);
  const myProducts = useMemo(() => products.filter((p) => p.ownerId === user?.uid), [products, user]);
  const myOrders = useMemo(() => orders.filter((o) => o.shopOwnerId === user?.uid), [orders, user]);
  const myEnquiries = useMemo(() => enquiries.filter((e) => e.shopOwnerId === user?.uid), [enquiries, user]);

  const [shopName, setShopName] = useState(myShop?.shopName || '');
  const [ownerName, setOwnerName] = useState(myShop?.ownerName || userAccount?.displayName || '');
  const [address, setAddress] = useState(myShop?.address || '');
  const [clusterZone, setClusterZone] = useState(myShop?.clusterZone || userAccount?.clusterZone || 'Andheri');
  const hydratedShopId = useRef<string | null>(null);

  useEffect(() => {
    if (myShop && hydratedShopId.current !== myShop.id) {
      hydratedShopId.current = myShop.id;
      setShopName(myShop.shopName || '');
      setOwnerName(myShop.ownerName || '');
      setAddress(myShop.address || '');
      setClusterZone(myShop.clusterZone || 'Andheri');
    }
  }, [myShop]);

  const [editingProdId, setEditingProdId] = useState<string | null>(null);
  const [prodName, setProdName] = useState('');
  const [prodCategory, setProdCategory] = useState<string>(PRODUCT_CATEGORIES[0]);
  const [prodDesc, setProdDesc] = useState('');
  const [prodImageUrl, setProdImageUrl] = useState('');
  const [prodPrice, setProdPrice] = useState('');
  const [prodStock, setProdStock] = useState('');
  const [memberDiscountPercent, setMemberDiscountPercent] = useState('10');
  const [shippingAvailable, setShippingAvailable] = useState(true);
  const [shippingFee, setShippingFee] = useState('49');
  const [courierPartner, setCourierPartner] = useState('Delhivery Mumbai Local');
  const [deliveryEta, setDeliveryEta] = useState('Same / Next Day');
  const [trackingDrafts, setTrackingDrafts] = useState<
    Record<
      string,
      {
        courierName: string;
        trackingId: string;
        shippingStatus: NonNullable<ProductOrder['shippingStatus']>;
      }
    >
  >({});

  const [promoDays, setPromoDays] = useState('7');
  const [promoUtr, setPromoUtr] = useState('');
  const [replyMap, setReplyMap] = useState<Record<string, string>>({});
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  if (!user) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center space-y-4">
        <h2 className="text-xl font-bold text-slate-900">{t.shopkeeper.authTitle}</h2>
        <p className="text-sm text-slate-600 max-w-md mx-auto">
          {t.shopkeeper.authDesc}
        </p>
        <button
          type="button"
          onClick={onRequireAuth}
          className="min-h-[44px] rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-slate-800"
        >
          {t.shopkeeper.authCta}
        </button>
      </div>
    );
  }

  const handleSaveShop = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMsg(null);
    const shopRef = doc(db, 'shops', user.uid);
    try {
      if (myShop) {
        await updateDoc(shopRef, {
          shopName: shopName.trim(),
          ownerName: ownerName.trim(),
          address: address.trim(),
          clusterZone,
          updatedAt: serverTimestamp(),
        });
      } else {
        await setDoc(shopRef, {
          ownerId: user.uid,
          shopName: shopName.trim(),
          ownerName: ownerName.trim(),
          address: address.trim(),
          clusterZone,
          sellerPlan: 'Standard',
          verified: false,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      setStatusMsg('Shop profile saved.');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `shops/${user.uid}`);
    }
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!myShop) {
      setStatusMsg('Please save your shop profile first before adding products.');
      return;
    }
    setStatusMsg(null);
    const payload = {
      shopId: myShop.id,
      ownerId: user.uid,
      shopName: myShop.shopName,
      name: prodName.trim(),
      category: prodCategory,
      description: prodDesc.trim(),
      imageUrl: prodImageUrl.trim(),
      price: Math.max(0, Number(prodPrice) || 0),
      stock: Math.max(0, Number(prodStock) || 0),
      clusterZone: myShop.clusterZone,
      isPromoted: false,
      promotionNote: '',
      memberDiscountPercent: Math.min(80, Math.max(0, Number(memberDiscountPercent) || 0)),
      shippingAvailable,
      shippingFee: shippingAvailable ? Math.max(0, Number(shippingFee) || 0) : 0,
      courierPartner: shippingAvailable ? courierPartner.trim().slice(0, 80) : '',
      deliveryEta: shippingAvailable ? deliveryEta.trim().slice(0, 80) : '',
      updatedAt: serverTimestamp(),
    };
    try {
      if (editingProdId) {
        await updateDoc(doc(db, 'products', editingProdId), {
          name: payload.name,
          category: payload.category,
          description: payload.description,
          imageUrl: payload.imageUrl,
          price: payload.price,
          stock: payload.stock,
          clusterZone: payload.clusterZone,
          memberDiscountPercent: payload.memberDiscountPercent,
          shippingAvailable: payload.shippingAvailable,
          shippingFee: payload.shippingFee,
          courierPartner: payload.courierPartner,
          deliveryEta: payload.deliveryEta,
          updatedAt: serverTimestamp(),
        });
        setStatusMsg('Product updated with member discount & shipping terms.');
      } else {
        await addDoc(collection(db, 'products'), {
          ...payload,
          createdAt: serverTimestamp(),
        });
        setStatusMsg('Product added to catalog with All in One Skill member discount.');
      }
      setEditingProdId(null);
      setProdName('');
      setProdDesc('');
      setProdImageUrl('');
      setProdPrice('');
      setProdStock('');
      setMemberDiscountPercent('10');
      setShippingAvailable(true);
      setShippingFee('49');
      setCourierPartner('Delhivery Mumbai Local');
      setDeliveryEta('Same / Next Day');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'products');
    }
  };

  const startEditProduct = (p: Product) => {
    setEditingProdId(p.id);
    setProdName(p.name);
    setProdCategory(p.category);
    setProdDesc(p.description || '');
    setProdImageUrl(p.imageUrl || '');
    setProdPrice(String(p.price));
    setProdStock(String(p.stock));
    setMemberDiscountPercent(String(p.memberDiscountPercent ?? 0));
    setShippingAvailable(p.shippingAvailable ?? true);
    setShippingFee(String(p.shippingFee ?? 0));
    setCourierPartner(p.courierPartner || '');
    setDeliveryEta(p.deliveryEta || '');
  };

  const handleDeleteProduct = async (productId: string) => {
    try {
      await deleteDoc(doc(db, 'products', productId));
      setStatusMsg('Product deleted.');
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `products/${productId}`);
    }
  };

  const handlePromoteProduct = async (product: Product) => {
    const days = Math.max(1, Number(promoDays) || 7);
    const rate = platformConfig.promotionDailyRate;
    const totalCost = days * rate;
    if (totalCost > 0 && !promoUtr.trim()) {
      setStatusMsg('Enter your UPI / Bank UTR reference to submit product promotion.');
      return;
    }
    try {
      await updateDoc(doc(db, 'products', product.id), {
        isPromoted: true,
        promotionNote: `Sponsored ${days}d campaign`,
        updatedAt: serverTimestamp(),
      });
      await addDoc(collection(db, 'transactions'), {
        userId: user.uid,
        userName: myShop?.shopName || userAccount?.displayName || 'Shopkeeper',
        txType: 'product_promotion',
        amount: totalCost,
        commissionAmount: totalCost,
        referenceId: product.id,
        utrReference: promoUtr.trim() || `PROMO-${Date.now()}`,
        status: 'Pending Verification',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setPromoUtr('');
      setStatusMsg(`Promotion submitted for "${product.name}". Admin will verify payment if applicable.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `products/${product.id}`);
    }
  };

  const handleOrderUpdate = async (order: ProductOrder, nextStatus: ProductOrder['status'], verifyPayment?: boolean) => {
    try {
      await updateDoc(doc(db, 'orders', order.id), {
        status: nextStatus,
        paymentStatus: verifyPayment ? 'Verified' : order.paymentStatus,
        updatedAt: serverTimestamp(),
      });
      await createNotification(
        order.customerId,
        `Order ${nextStatus}`,
        `${order.productName} (${order.quantity}x) is now ${nextStatus}.`,
        'booking'
      );
      setStatusMsg(`Order updated to ${nextStatus}.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `orders/${order.id}`);
    }
  };

  const handleSaveCourierTracking = async (order: ProductOrder) => {
    const draft = trackingDrafts[order.id] || {
      courierName: order.courierName || 'Delhivery Mumbai Local',
      trackingId: order.trackingId || '',
      shippingStatus: order.shippingStatus || 'Packed',
    };
    if (!draft.trackingId.trim()) {
      setStatusMsg('Enter a courier tracking / AWB number before saving.');
      return;
    }
    try {
      await updateDoc(doc(db, 'orders', order.id), {
        courierName: draft.courierName.trim().slice(0, 80),
        trackingId: draft.trackingId.trim().slice(0, 80),
        shippingStatus: draft.shippingStatus,
        updatedAt: serverTimestamp(),
      });
      await createNotification(
        order.customerId,
        `Courier Update: ${draft.shippingStatus}`,
        `${order.productName} (${draft.courierName.trim()}) · Tracking ID: ${draft.trackingId.trim()}`,
        'booking'
      );
      setStatusMsg(`Courier tracking (${draft.shippingStatus}) saved for order #${order.id.slice(0, 6).toUpperCase()}.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `orders/${order.id}`);
    }
  };

  const handleReplyEnquiry = async (enqId: string, customerId: string) => {
    const replyText = (replyMap[enqId] || '').trim();
    if (!replyText) return;
    try {
      await updateDoc(doc(db, 'enquiries', enqId), {
        reply: replyText,
        status: 'Replied',
        updatedAt: serverTimestamp(),
      });
      await createNotification(customerId, 'Shopkeeper Reply', replyText, 'system');
      setReplyMap((prev) => ({ ...prev, [enqId]: '' }));
      setStatusMsg('Reply sent to customer.');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `enquiries/${enqId}`);
    }
  };

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">{t.shopkeeper.dashboardTitle}</h2>
          <p className="text-sm text-slate-600">
            {myShop ? `${myShop.shopName} · ${myShop.clusterZone} · ${myShop.sellerPlan}` : t.shopkeeper.storefrontDetails}
          </p>
        </div>
        {myShop?.verified && (
          <div className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700">
            <CheckCircle2 className="w-4 h-4" /> {t.shopkeeper.verifiedSeller}
          </div>
        )}
      </div>

      {statusMsg && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs font-medium text-amber-900">
          {statusMsg}
        </div>
      )}

      {/* Metrics Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-xs text-slate-500">{t.shopkeeper.listedProducts}</div>
          <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-1">{myProducts.length}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-xs text-slate-500">{t.shopkeeper.customerOrders}</div>
          <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-1">{myOrders.length}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-xs text-slate-500">{t.shopkeeper.openEnquiries}</div>
          <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-1">
            {myEnquiries.filter((e) => e.status === 'Open').length}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-xs text-slate-500">{t.shopkeeper.orderVolume}</div>
          <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-1">
            {formatINR(myOrders.reduce((acc, o) => acc + (o.status !== 'Cancelled' ? o.totalAmount : 0), 0))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Shop Profile Form */}
        <form onSubmit={handleSaveShop} className="lg:col-span-5 rounded-xl border border-slate-200 bg-white p-6 space-y-4 h-fit">
          <h3 className="text-base font-semibold text-slate-900">{t.shopkeeper.storefrontDetails}</h3>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Shop Name</label>
              <input
                type="text"
                required
                value={shopName}
                onChange={(e) => setShopName(e.target.value)}
                placeholder="e.g. Mahalaxmi Electricals & Hardware"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Owner Name</label>
              <input
                type="text"
                required
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                placeholder="Owner full name"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Service Location (Mumbai Cluster)</label>
              <select
                value={clusterZone}
                onChange={(e) => setClusterZone(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
              >
                {zones.map((z) => (
                  <option key={z.id} value={z.name}>
                    {z.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Shop Address</label>
              <textarea
                rows={2}
                required
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Shop no., street, landmark, Mumbai"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
          </div>
          <button
            type="submit"
            className="min-h-[44px] w-full rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            {myShop ? t.shopkeeper.updateShop : t.shopkeeper.registerShop}
          </button>
        </form>

        {/* Add / Edit Product Form */}
        <form onSubmit={handleSaveProduct} className="lg:col-span-7 rounded-xl border border-slate-200 bg-white p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-slate-900">
              {editingProdId ? t.shopkeeper.editProduct : t.shopkeeper.addNewProduct}
            </h3>
            {editingProdId && (
              <button
                type="button"
                onClick={() => {
                  setEditingProdId(null);
                  setProdName('');
                  setProdDesc('');
                  setProdImageUrl('');
                  setProdPrice('');
                  setProdStock('');
                }}
                className="text-xs text-slate-500 hover:text-slate-900"
              >
                Cancel Edit
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Product Name</label>
              <input
                type="text"
                required
                value={prodName}
                onChange={(e) => setProdName(e.target.value)}
                placeholder="e.g. Polycab 2.5 sqmm FR Wire Coil"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Category</label>
              <select
                value={prodCategory}
                onChange={(e) => setProdCategory(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
              >
                {PRODUCT_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {translateProductCategory(c, language)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Price (INR)</label>
              <input
                type="number"
                min={0}
                required
                value={prodPrice}
                onChange={(e) => setProdPrice(e.target.value)}
                placeholder="1450"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Available Stock</label>
              <input
                type="number"
                min={0}
                required
                value={prodStock}
                onChange={(e) => setProdStock(e.target.value)}
                placeholder="40"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                All in One Skill Member Discount (%)
              </label>
              <input
                type="number"
                min={0}
                max={80}
                value={memberDiscountPercent}
                onChange={(e) => setMemberDiscountPercent(e.target.value)}
                placeholder="10"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Courier Shipping Fee (INR, 0 = Free)
              </label>
              <input
                type="number"
                min={0}
                disabled={!shippingAvailable}
                value={shippingFee}
                onChange={(e) => setShippingFee(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono disabled:bg-slate-100"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Courier Partner</label>
              <input
                type="text"
                maxLength={80}
                disabled={!shippingAvailable}
                value={courierPartner}
                onChange={(e) => setCourierPartner(e.target.value)}
                placeholder="Delhivery / Porter / BlueDart"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Delivery ETA</label>
              <input
                type="text"
                maxLength={80}
                disabled={!shippingAvailable}
                value={deliveryEta}
                onChange={(e) => setDeliveryEta(e.target.value)}
                placeholder="Same / Next Day"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100"
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-xs font-medium text-slate-700">
            <input
              type="checkbox"
              checked={shippingAvailable}
              onChange={(e) => setShippingAvailable(e.target.checked)}
              className="rounded border-slate-300"
            />
            <span>Enable Direct Courier Shipping &amp; Live Tracking</span>
          </label>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Product Photo URL (Optional)</label>
            <input
              type="url"
              value={prodImageUrl}
              onChange={(e) => setProdImageUrl(e.target.value)}
              placeholder="https://..."
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Description</label>
            <textarea
              rows={2}
              value={prodDesc}
              onChange={(e) => setProdDesc(e.target.value)}
              placeholder="Specifications, warranty, and local Mumbai delivery details"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <button
            type="submit"
            className="min-h-[44px] inline-flex items-center gap-2 rounded-lg bg-amber-600 px-5 py-2 text-sm font-medium text-white hover:bg-amber-700"
          >
            <Plus className="w-4 h-4" />
            {editingProdId ? t.shopkeeper.saveProductChanges : t.shopkeeper.publishProduct}
          </button>
        </form>
      </div>

      {/* Product Catalog & Promotion */}
      <section className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-slate-900">{t.shopkeeper.catalogTitle}</h3>
            <p className="text-xs text-slate-500">
              Admin promotion rate: <span className="font-mono">{formatINR(platformConfig.promotionDailyRate)}/day</span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={1}
              value={promoDays}
              onChange={(e) => setPromoDays(e.target.value)}
              className="w-20 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-mono"
              aria-label="Promotion days"
            />
            <span className="text-xs text-slate-500">days</span>
            <input
              type="text"
              value={promoUtr}
              onChange={(e) => setPromoUtr(e.target.value)}
              placeholder="UPI UTR (if paid)"
              className="w-40 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-mono"
            />
          </div>
        </div>

        {myProducts.length === 0 ? (
          <p className="text-sm text-slate-500 py-4">No products added yet. Use the form above to publish inventory.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-xs text-slate-500">
                  <th className="py-2.5 pr-4 font-medium">Product</th>
                  <th className="py-2.5 px-4 font-medium">Category</th>
                  <th className="py-2.5 px-4 font-medium text-right">Price &amp; Discount</th>
                  <th className="py-2.5 px-4 font-medium text-right">Stock</th>
                  <th className="py-2.5 pl-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {myProducts.map((p) => (
                  <tr key={p.id}>
                    <td className="py-3 pr-4">
                      <div className="font-medium text-slate-900">{p.name}</div>
                      <div className="text-xs text-slate-500">
                        {p.shippingAvailable ? `${p.courierPartner || 'Courier'} (${formatINR(p.shippingFee || 0)})` : 'Pickup only'}
                        {p.isPromoted ? ` · ${p.promotionNote || 'Promoted'}` : ''}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-slate-600">{p.category}</td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums">
                      <div>{formatINR(p.price)}</div>
                      {(p.memberDiscountPercent || 0) > 0 && (
                        <div className="text-[11px] text-emerald-700">{p.memberDiscountPercent}% member off</div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums">{p.stock}</td>
                    <td className="py-3 pl-4 text-right space-x-2 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => handlePromoteProduct(p)}
                        className="inline-flex items-center gap-1 rounded-md border border-amber-300 px-2.5 py-1 text-xs font-medium text-amber-800 hover:bg-amber-50"
                      >
                        <Megaphone className="w-3.5 h-3.5" /> Promote
                      </button>
                      <button
                        type="button"
                        onClick={() => startEditProduct(p)}
                        className="inline-flex items-center rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteProduct(p.id)}
                        aria-label={`Delete ${p.name}`}
                        className="inline-flex items-center rounded-md border border-red-200 p-1.5 text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Customer Orders & Enquiries */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Package className="w-4 h-4 text-slate-700" />
            <h3 className="text-base font-semibold text-slate-900">{t.shopkeeper.incomingOrders}</h3>
          </div>
          {myOrders.length === 0 ? (
            <p className="text-sm text-slate-500">No orders placed yet.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {myOrders.map((order) => (
                <div key={order.id} className="py-3.5 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-sm font-medium text-slate-900">
                        {order.productName} × <span className="font-mono">{order.quantity}</span>
                      </div>
                      <div className="text-xs text-slate-500">
                        {order.customerName} · {order.clusterZone} · {order.paymentStatus}
                        {order.paymentMethod ? ` · ${order.paymentMethod}` : ''}
                        {order.paymentReference ? ` (Ref: ${order.paymentReference})` : ''}
                      </div>
                      {order.shippingAddress && (
                        <div className="text-xs text-slate-600">Ship to: {order.shippingAddress}</div>
                      )}
                      {order.trackingId && (
                        <div className="text-xs font-mono text-emerald-700">
                          {order.courierName || 'Courier'} · AWB: {order.trackingId} ({order.shippingStatus || 'Packed'})
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold font-mono tabular-nums">{formatINR(order.totalAmount)}</div>
                      <div className="text-xs text-slate-600">{order.status}</div>
                    </div>
                  </div>
                  {order.status !== 'Delivered' && order.status !== 'Cancelled' && (
                    <div className="space-y-2.5 pt-1">
                      <div className="flex flex-wrap gap-2">
                        {order.status === 'Placed' && (
                          <button
                            type="button"
                            onClick={() => handleOrderUpdate(order, 'Confirmed', order.paymentStatus === 'Pending Verification')}
                            className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800"
                          >
                            {t.shopkeeper.confirmOrder}
                          </button>
                        )}
                        {order.status === 'Confirmed' && (
                          <button
                            type="button"
                            onClick={() => handleOrderUpdate(order, 'Dispatched', true)}
                            className="rounded-md bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-700"
                          >
                            {t.shopkeeper.markDispatched}
                          </button>
                        )}
                        {order.status === 'Dispatched' && (
                          <button
                            type="button"
                            onClick={() => handleOrderUpdate(order, 'Delivered', true)}
                            className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700"
                          >
                            {t.shopkeeper.markDelivered}
                          </button>
                        )}
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-slate-50 p-2.5 space-y-2">
                        <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-700">
                          <Truck className="w-3.5 h-3.5 text-amber-600" />
                          <span>Courier &amp; Tracking Dispatch Details</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <input
                            type="text"
                            value={trackingDrafts[order.id]?.courierName ?? order.courierName ?? 'Delhivery Mumbai Local'}
                            onChange={(e) =>
                              setTrackingDrafts((prev) => ({
                                ...prev,
                                [order.id]: {
                                  courierName: e.target.value,
                                  trackingId: prev[order.id]?.trackingId ?? order.trackingId ?? '',
                                  shippingStatus: prev[order.id]?.shippingStatus ?? order.shippingStatus ?? 'Packed',
                                },
                              }))
                            }
                            placeholder="Courier partner"
                            className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs"
                          />
                          <input
                            type="text"
                            value={trackingDrafts[order.id]?.trackingId ?? order.trackingId ?? ''}
                            onChange={(e) =>
                              setTrackingDrafts((prev) => ({
                                ...prev,
                                [order.id]: {
                                  courierName: prev[order.id]?.courierName ?? order.courierName ?? 'Delhivery Mumbai Local',
                                  trackingId: e.target.value,
                                  shippingStatus: prev[order.id]?.shippingStatus ?? order.shippingStatus ?? 'Packed',
                                },
                              }))
                            }
                            placeholder="Tracking ID / AWB"
                            className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-mono"
                          />
                          <select
                            value={trackingDrafts[order.id]?.shippingStatus ?? order.shippingStatus ?? 'Packed'}
                            onChange={(e) =>
                              setTrackingDrafts((prev) => ({
                                ...prev,
                                [order.id]: {
                                  courierName: prev[order.id]?.courierName ?? order.courierName ?? 'Delhivery Mumbai Local',
                                  trackingId: prev[order.id]?.trackingId ?? order.trackingId ?? '',
                                  shippingStatus: e.target.value as NonNullable<ProductOrder['shippingStatus']>,
                                },
                              }))
                            }
                            className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs"
                          >
                            {(['Packed', 'Shipped', 'In Transit', 'Out for Delivery', 'Delivered'] as const).map((st) => (
                              <option key={st} value={st}>
                                {st}
                              </option>
                            ))}
                          </select>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleSaveCourierTracking(order)}
                          className="rounded-md border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-800 hover:bg-slate-100"
                        >
                          Save &amp; Notify Tracking
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
          <h3 className="text-base font-semibold text-slate-900">{t.shopkeeper.customerEnquiries}</h3>
          {myEnquiries.length === 0 ? (
            <p className="text-sm text-slate-500">No customer enquiries yet.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {myEnquiries.map((enq) => (
                <div key={enq.id} className="py-3.5 space-y-2">
                  <div className="flex justify-between text-xs text-slate-500">
                    <span>{enq.customerName}</span>
                    <span>{enq.status}</span>
                  </div>
                  <p className="text-sm text-slate-900">{enq.message}</p>
                  {enq.reply ? (
                    <p className="text-xs text-emerald-700 bg-emerald-50 rounded-md px-3 py-2">
                      {enq.reply}
                    </p>
                  ) : (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={replyMap[enq.id] || ''}
                        onChange={(e) => setReplyMap((prev) => ({ ...prev, [enq.id]: e.target.value }))}
                        placeholder="Write reply..."
                        className="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => handleReplyEnquiry(enq.id, enq.customerId)}
                        className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white"
                      >
                        {t.shopkeeper.replyBtn}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
