import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import {
  ArrowLeft, Bell, BookOpen, Camera, Check, ChevronRight, CircleHelp, CreditCard,
  Crown, Flame, Home, MapPin, Menu, PackageCheck, Pencil, Plus, RefreshCw, Search, Send, ShieldCheck,
  ShoppingBag, Sparkles, Store, Tag, Ticket, Truck, Upload, UserRound, WalletCards, X, Zap,
  Gift, Lamp, Palette, Shirt, Utensils,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { DEMO_CITY, ABOUT_LINKS } from '@/lib/config';
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { readPage, matchPhotos, cropToBlob, type Box, type TextItem } from '@/catalogPhotos';

type Role = 'customer' | 'merchant';
type View = 'home' | 'search' | 'cart' | 'tokens' | 'profile' | 'orders' | 'returns' | 'delivery-checkout' | 'requests' | 'scan' | 'wallet' | 'radar' | 'pricing' | 'catalog' | 'kits' | 'merchant-orders' | 'earnings' | 'more' | 'product' | 'about' | 'inventory';
type AuthMode = 'login' | 'signup';
type Product = { id: string; slug: string; name: string; category: string; has_sizes: boolean; description?: string | null; material?: string | null; color?: string | null; image_url?: string | null };
type Shop = { id: string; name: string; slug: string; distance_km: number; subscribed: boolean; token_volume: number; wallet_balance?: number };
type Offer = { id: string; shop: string; product: string; price: number; mrp: number | null; stock: Record<string, number> };
type CartItem = { product: Product; offer: Offer; shop: Shop; quantity: number; size?: string; mode: 'token' | 'delivery' };
type Token = { id: string; shop: Shop; total: number; otp: string; status: string; expires_at: string; items: CartItem[] };
type DeliveryDetails = { name: string; phone: string; address: string; pin: string; paymentMethod: 'upi' | 'card' | 'cod' };
type OrderRecord = { id: string; shop: string; items: CartItem[]; total: number; delivery_fee: number; status: 'placed' | 'confirmed' | 'out_for_delivery' | 'delivered' | 'returned'; created_at: string; delivery_name: string | null; delivery_phone: string | null; delivery_address: string | null; delivery_pin: string | null; payment_method: string | null };
type ReturnRecord = { id: string; order_id: string | null; token_id: string | null; kind: 'return' | 'exchange' | 'grievance'; reason: string; status: 'requested' | 'approved' | 'rejected'; photo_path: string | null; note: string | null; created_at: string };
type BulkRequest = { id: string; shop: string; items: CartItem[]; status: 'pending' | 'held' | 'rejected' | 'expired'; approval_expires_at: string | null; approved_items: CartItem[] | null; created_at: string };
type Reliability = { no_show_count: number; free_tokens_disabled_until: string | null };
type FestivalKit = { id: string; shop: string; product: string | null; name: string; tier: 'basic' | 'pro'; price: number; count: number };
type MerchantOrder = { id: string; customer: string; items: CartItem[]; total: number; delivery_fee: number; status: 'placed' | 'confirmed' | 'out_for_delivery' | 'delivered' | 'returned'; created_at: string; delivery_name: string | null; delivery_phone: string | null; delivery_address: string | null; delivery_pin: string | null; payment_method: string | null };
type BillRecord = { id: string; shop: string; token: string; items: CartItem[]; total: number; fee: number; created_at: string };
type Toast = { message: string; tone?: 'success' | 'error' };

function tokenFee(category: string, price: number) { if (category === 'Fashion') { if (price <= 250) return 2.5; if (price <= 499) return 10; return 20; } else { if (price <= 250) return 0; if (price <= 499) return 6; return 12; } }

const demoProducts: Product[] = [
  { id: 'p1', slug: 'cotton-blue-kurti', name: 'Cotton Blue Kurti', category: 'Fashion', has_sizes: true },
  { id: 'p2', slug: 'chikankari-white-kurti', name: 'Chikankari White Kurti', category: 'Fashion', has_sizes: true },
  { id: 'p3', slug: 'cotton-dupatta-mustard', name: 'Cotton Dupatta', category: 'Fashion', has_sizes: false },
  { id: 'p4', slug: 'led-diya-lights-12', name: 'LED Diya Lights 12', category: 'Decor', has_sizes: false },
  { id: 'p5', slug: 'pipe-cleaner-flower-kit', name: 'Pipe Cleaner Flower Kit', category: 'Crafts', has_sizes: false },
  { id: 'p6', slug: 'kanya-pujan-kit-basic', name: 'Kanya Pujan Kit Basic', category: 'Festival kits', has_sizes: false },
  { id: 'p7', slug: 'kanya-pujan-kit-pro', name: 'Kanya Pujan Kit Pro', category: 'Festival kits', has_sizes: false },
  { id: 'p8', slug: 'steel-katori-set', name: 'Steel Katori Set', category: 'Essentials', has_sizes: false },
];
const demoShops: Shop[] = [
  { id: 's1', name: 'Sharma Fashion', slug: 'sharma-fashion', distance_km: .8, subscribed: true, token_volume: 42 },
  { id: 's2', name: 'Verma Boutique', slug: 'verma-boutique', distance_km: 1.2, subscribed: false, token_volume: 80 },
  { id: 's3', name: 'Patel Garments', slug: 'patel-garments', distance_km: 2.4, subscribed: false, token_volume: 36 },
  { id: 's4', name: 'Patel Decor', slug: 'patel-decor', distance_km: 1.9, subscribed: false, token_volume: 70 },
  { id: 's5', name: 'Gupta Crafts', slug: 'gupta-crafts', distance_km: .6, subscribed: false, token_volume: 28 },
  { id: 's6', name: 'Joshi Stores', slug: 'joshi-stores', distance_km: .9, subscribed: false, token_volume: 52 },
  { id: 's7', name: 'Raj Textiles', slug: 'raj-textiles', distance_km: 6.5, subscribed: false, token_volume: 18 },
];
const demoOffers: Offer[] = [
  { id: 'o1', shop: 's1', product: 'p1', price: 449, mrp: 599, stock: { S: 4, M: 2, L: 3 } },
  { id: 'o2', shop: 's2', product: 'p1', price: 459, mrp: 599, stock: { S: 2, M: 4, L: 1 } },
  { id: 'o3', shop: 's3', product: 'p1', price: 479, mrp: 650, stock: { S: 1, M: 2, L: 2 } },
  { id: 'o4', shop: 's7', product: 'p1', price: 439, mrp: 599, stock: { S: 3, M: 3, L: 3 } },
  { id: 'o5', shop: 's2', product: 'p2', price: 459, mrp: 599, stock: { S: 2, M: 3, L: 2 } },
  { id: 'o6', shop: 's1', product: 'p3', price: 299, mrp: 399, stock: { quantity: 8 } },
  { id: 'o7', shop: 's4', product: 'p4', price: 349, mrp: 449, stock: { quantity: 12 } },
  { id: 'o8', shop: 's5', product: 'p5', price: 260, mrp: null, stock: { quantity: 9 } },
  { id: 'o9', shop: 's6', product: 'p6', price: 299, mrp: null, stock: { quantity: 16 } },
  { id: 'o10', shop: 's6', product: 'p7', price: 999, mrp: null, stock: { quantity: 7 } },
  { id: 'o11', shop: 's6', product: 'p8', price: 225, mrp: null, stock: { quantity: 20 } },
];

function money(value: number) { return `₹${value.toLocaleString('en-IN')}`; }
function getLabel(shop: Shop) { return shop.subscribed ? 'Sponsored' : shop.token_volume >= 50 ? 'Top seller' : 'Nearby'; }
function deliveryFee(distance: number) { return distance <= 3 ? 55 : distance <= 5 ? 70 : distance <= 8 ? 90 : distance <= 10 ? 110 : null; }
function friendlyError(error: unknown) { return error instanceof Error ? error.message : 'Something went wrong. Try again.'; }

function App() {
  const [showSplash, setShowSplash] = useState(() => sessionStorage.getItem('locopick-splash-seen') !== 'true');
  return <BrowserRouter>{showSplash ? <Splash onDone={() => { sessionStorage.setItem('locopick-splash-seen', 'true'); setShowSplash(false); }} /> : <AppContent />}</BrowserRouter>;
}

function AppContent() {
  const location = useLocation();
  const navigate = useNavigate();
  const [session, setSession] = useState<{ userId: string; name: string; email: string } | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [products, setProducts] = useState<Product[]>(demoProducts);
  const [shops, setShops] = useState<Shop[]>(demoShops);
  const [offers, setOffers] = useState<Offer[]>(demoOffers);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [tokens, setTokens] = useState<Token[]>([]);
  const [query, setQuery] = useState('');
  const [toast, setToast] = useState<Toast | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const scrollPositions = useRef<Record<string, number>>({});
  const view = viewFromPath(location.pathname);
  const demoSession = sessionStorage.getItem('locopick-demo') === 'true';

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      if (data.session) {
        const isDemoMarker = sessionStorage.getItem('locopick-demo') === 'true';
        const demoEmail = data.session.user.email?.startsWith('demo-');
        if (demoEmail && !isDemoMarker) {
          await supabase.auth.signOut();
          setAuthLoading(false);
          return;
        }
        const { data: profile } = await supabase.from('profiles').select('name, role').eq('id', data.session.user.id).maybeSingle();
        const nextRole = profile?.role as Role | undefined;
        if (!nextRole) {
          await supabase.auth.signOut();
          setAuthLoading(false);
          return;
        }
        setSession({ userId: data.session.user.id, name: profile?.name ?? `${DEMO_CITY} shopper`, email: data.session.user.email ?? '' });
        setRole(nextRole);
        const rolePrefix = nextRole === 'customer' ? '/c/' : '/m/';
        const isAuthPath = location.pathname === '/welcome' || location.pathname === '/c/login' || location.pathname === '/m/login';
        if (isAuthPath || !location.pathname.startsWith(rolePrefix)) navigate(nextRole === 'customer' ? '/c/home' : '/m/requests', { replace: true });
        await loadCatalog();
      }
      setAuthLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (nextSession) setSession({ userId: nextSession.user.id, name: nextSession.user.user_metadata.name ?? `${DEMO_CITY} shopper`, email: nextSession.user.email ?? '' });
      else setSession(null);
    });
    return () => { active = false; listener.subscription.unsubscribe(); };
  }, [location.pathname, navigate]);

  useEffect(() => {
    const previous = sessionStorage.getItem('locopick-current-path');
    if (previous) scrollPositions.current[previous] = window.scrollY;
    sessionStorage.setItem('locopick-current-path', location.pathname);
    window.requestAnimationFrame(() => window.scrollTo(0, scrollPositions.current[location.pathname] ?? 0));
  }, [location.pathname]);

  async function loadCatalog() {
    const [{ data: productsData }, { data: shopsData }, { data: offersData }] = await Promise.all([
      supabase.from('products').select('*'), supabase.from('shops').select('*'), supabase.from('offers').select('*'),
    ]);
    if (productsData?.length) setProducts(productsData as Product[]);
    if (shopsData?.length) setShops(shopsData as Shop[]);
    if (offersData?.length) setOffers(offersData.map((item) => ({ ...item, stock: item.stock as Record<string, number> })) as Offer[]);
  }

  async function authenticate(email: string, password: string, nextRole: Role, profile: Record<string, string>, isDemo = false) {
    const result = await supabase.auth.signInWithPassword({ email, password });
    let created = false;
    if (result.error) {
      const signup = await supabase.auth.signUp({ email, password, options: { data: { name: profile.name } } });
      if (signup.error) throw signup.error;
      if (!signup.data.session) throw new Error('Your account was created. Please try logging in.');
      created = true;
    }
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) throw new Error('We could not finish signing you in.');
    if (created) {
      await supabase.from('profiles').upsert({ id: userId, role: nextRole, name: profile.name });
      if (nextRole === 'merchant' && !isDemo) await supabase.from('shops').insert({ owner: userId, name: profile.shopName, category: profile.category, phone: profile.phone, city: profile.city, wallet_balance: 0, slug: `${profile.shopName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${userId.slice(0, 6)}` });
    }
    if (isDemo && nextRole === 'merchant') {
      const claim = await supabase.rpc('claim_demo_shopkeeper');
      if (claim.error) throw claim.error;
    }
    const { data: savedProfile } = await supabase.from('profiles').select('name, role').eq('id', userId).maybeSingle();
    const resolvedRole = savedProfile?.role as Role | undefined;
    if (!resolvedRole) throw new Error('We could not find your account role.');
    setRole(resolvedRole); setSession({ userId, name: savedProfile?.name ?? profile.name, email });
    if (isDemo) sessionStorage.setItem('locopick-demo', 'true'); else sessionStorage.removeItem('locopick-demo');
    await loadCatalog();
    navigate(resolvedRole === 'customer' ? '/c/home' : '/m/requests', { replace: true });
  }

  async function handleDemo(nextRole: Role) {
    setAuthLoading(true);
    try { await authenticate(nextRole === 'merchant' ? 'demo-shop@locopick.app' : 'demo-customer@locopick.app', 'LocoPickDemo123!', nextRole, { name: nextRole === 'merchant' ? 'Sharma Fashion' : 'Aarohi Sharma', shopName: 'Sharma Fashion', category: 'Fashion', phone: '', city: DEMO_CITY }, true); }
    catch (error) { setToast({ message: friendlyError(error), tone: 'error' }); }
    setAuthLoading(false);
  }

  async function signOut() { await supabase.auth.signOut(); sessionStorage.removeItem('locopick-demo'); setSession(null); setCart([]); navigate('/welcome', { replace: true }); }
  function notify(message: string, tone: Toast['tone'] = 'success') { setToast({ message, tone }); window.setTimeout(() => setToast(null), 2600); }
  function goToView(nextView: View) { if (!role) return; const prefix = role === 'customer' ? '/c' : '/m'; const nextPath = `${prefix}/${nextView}`; if (location.pathname === nextPath) window.scrollTo(0, 0); else navigate(nextPath); }
  useEffect(() => {
    if (!session || !role) return;
    const channel = supabase.channel(`locopick-${role}-${session.userId}`).on('postgres_changes', { event: '*', schema: 'public', table: role === 'merchant' ? 'requests' : 'tokens' }, () => { if (role === 'merchant') notify('A customer request just arrived'); }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [session, role]);
  function addToCart(product: Product, offer: Offer, shop: Shop, size?: string) { setCart((current) => { const existing = current.find((item) => item.offer.id === offer.id && item.size === size); return existing ? current.map((item) => item === existing ? { ...item, quantity: item.quantity + 1 } : item) : [...current, { product, offer, shop, size, quantity: 1, mode: offer.price >= 250 ? 'token' : 'delivery' }]; }); notify('Added to your basket'); }
  async function placeRequests(deliveryDetails?: DeliveryDetails) {
    if (!session || cart.length === 0) return;
    const buckets = Array.from(new Set(cart.map((item) => item.shop.id))).map((shopId) => cart.filter((item) => item.shop.id === shopId)); const nextTokens: Token[] = []; let createdDelivery = false; let createdBulk = false; let createdStockRequest = false;
    for (const items of buckets) {
      const total = items.reduce((sum, item) => sum + item.offer.price * item.quantity, 0); const shop = items[0].shop; const tokenAllowed = items[0].mode === 'token' && total >= 250;
      const isBulk = items.reduce((sum, item) => sum + item.quantity, 0) >= 5; const request = await supabase.from('requests').insert({ shop: shop.id, items, total, bulk: isBulk, multi: buckets.length > 1, approval_expires_at: isBulk ? new Date(Date.now() + 30 * 60000).toISOString() : null }).select().maybeSingle();
      if (request.error) { notify('Could not create the request. Please try again.', 'error'); return; }
      if (isBulk) {
        createdBulk = true;
      } else if (tokenAllowed) {
        createdStockRequest = true;
      } else {
        const fee = deliveryFee(shop.distance_km);
        if (fee === null) { notify(`${shop.name} is too far for delivery. Choose reserve instead.`, 'error'); return; }
        if (!deliveryDetails) { notify('Add delivery details before placing the order.', 'error'); return; }
        const order = await supabase.from('orders').insert({ shop: shop.id, items, total, delivery_fee: fee, delivery_name: deliveryDetails.name, delivery_phone: deliveryDetails.phone, delivery_address: deliveryDetails.address, delivery_pin: deliveryDetails.pin, payment_method: deliveryDetails.paymentMethod }).select().maybeSingle();
        if (order.error) { notify('Could not place the delivery order. Please try again.', 'error'); return; }
        createdDelivery = true;
      }
    }
    if (nextTokens.length) setTokens((current) => [...nextTokens, ...current]); setCart([]);
    if (createdDelivery) goToView('orders'); else goToView('tokens');
    notify(createdBulk ? 'Waiting for the shop to approve your cart.' : createdStockRequest ? 'Request sent. The shop will confirm stock, then your token appears.' : 'Delivery order placed.');
  }

  if (authLoading || (session && !role)) return <div className="loading-screen"><div className="brand-mark"><img src="/brand/logo-mark.png" alt="" /></div><p>Getting LocoPick ready</p></div>;
  if (!session) {
    const authPath = location.pathname === '/c/login' || location.pathname === '/m/login';
    if (location.pathname !== '/welcome' && !authPath) return <Navigate to="/welcome" replace />;
    return <Welcome onDemo={handleDemo} />;
  }
  const guardedRole = location.pathname.startsWith('/m/') ? 'merchant' : 'customer';
  if (guardedRole !== role) return <Navigate to={role === 'customer' ? '/c/home' : '/m/requests'} replace />;
  return <div className="app-shell"><div className="phone-frame"><Topbar view={view} onBack={() => navigate(-1)} userId={session?.userId} />{demoSession && (view === 'profile' || view === 'more') && <DemoChip role={role!} onSwitch={handleDemo} onExit={signOut} />}<main className="screen-content"><Routes><Route path="/c/*" element={<CustomerApp view={view} setView={goToView} products={products} shops={shops} offers={offers} query={query} setQuery={setQuery} cart={cart} setCart={setCart} addToCart={addToCart} tokens={tokens} notify={notify} placeRequests={placeRequests} onSignOut={signOut} demoSession={demoSession} email={session.email} userId={session.userId} onSwitchDemo={handleDemo} />} /><Route path="/m/*" element={<MerchantApp view={view} setView={goToView} shops={shops} tokens={tokens} notify={notify} email={session.email} products={products} offers={offers} userId={session.userId} loadCatalog={loadCatalog} demoSession={demoSession} onSwitchDemo={handleDemo} onSignOut={signOut} />} /><Route path="*" element={<Navigate to={role === 'customer' ? '/c/home' : '/m/requests'} replace />} /></Routes></main>{role === 'customer' ? <BottomNav view={view} setView={goToView} cartCount={cart.length} /> : <MerchantNav view={view} setView={goToView} onSignOut={signOut} />}{toast && <div className={`toast ${toast.tone === 'error' ? 'toast-error' : ''}`}><Check size={16} />{toast.message}</div>}</div></div>;
}

function viewFromPath(pathname: string): View { if (pathname.includes('/product/')) return 'product'; const last = pathname.split('/').filter(Boolean).pop(); const known: View[] = ['home','search','cart','tokens','profile','orders','returns','delivery-checkout','requests','scan','wallet','radar','pricing','catalog','kits','merchant-orders','earnings','more','about','inventory']; return (known as string[]).includes(last) ? (last as View) : 'home'; }

function Splash({ onDone }: { onDone: () => void }) { const [visible, setVisible] = useState(true); useEffect(() => { if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { onDone(); return; } const fadeTimer = window.setTimeout(() => setVisible(false), 1800); const doneTimer = window.setTimeout(onDone, 2000); return () => { window.clearTimeout(fadeTimer); window.clearTimeout(doneTimer); }; }, [onDone]); return <AnimatePresence>{visible && <motion.div className="splash-screen" initial={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: .2 }}><motion.img className="splash-mark" src="/brand/logo-mark.png" alt="LocoPick" initial={{ y: -80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ type: 'spring', bounce: .55, duration: .6 }} /><motion.div className="splash-wordmark" initial={{ y: 12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: .65, duration: .4 }}><span>Loco</span><b>Pick</b></motion.div><motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.05, duration: .4 }}>Your City. Your Local Shops.</motion.p></motion.div>}</AnimatePresence>; }

function Welcome({ onDemo }: { onDemo: (role: Role) => void }) {
  return <div className="welcome-wrap"><div className="welcome-card"><div className="welcome-logo"><img src="/brand/logo-mark.png" alt="LocoPick" /></div><div className="wordmark"><span>Loco</span><b>Pick</b></div><h1 className="welcome-heading">Local shopping,<br /><em>without the guesswork.</em></h1><p className="welcome-sub">Find your size nearby. Reserve it free.</p><div className="welcome-actions"><button className="primary-button welcome-primary" onClick={() => onDemo('customer')}>Try demo customer</button><button className="outline-button welcome-secondary" onClick={() => onDemo('merchant')}>Try demo shopkeeper</button></div><p className="welcome-note">Prototype with demo data</p></div></div>;
}

function Topbar({ view, onBack, userId }: { view: View; onBack: () => void; userId?: string }) {
  const showBack = !['home', 'requests'].includes(view);
  return <header className="topbar">{showBack ? <button className="icon-button" onClick={onBack}><ArrowLeft size={19} /></button> : <div className="brand-mini"><img src="/brand/logo-mark.png" alt="" /><span><strong>Loco</strong><b>Pick</b></span></div>}<div className="topbar-title">{view === 'requests' ? 'Sharma Fashion' : ''}</div><NotificationBell userId={userId} /></header>;
}

function DemoChip({ role, onSwitch, onExit }: { role: Role; onSwitch: (role: Role) => void; onExit: () => void }) {
  const [open, setOpen] = useState(false);
  const label = role === 'customer' ? 'Customer' : 'Shopkeeper';
  return <><button className="demo-chip-fab" onClick={() => setOpen(true)}>Demo · {label} <ChevronRight size={12} style={{ transform: 'rotate(90deg)' }} /></button>{open && <div className="sheet-overlay" onClick={() => setOpen(false)}><div className="bottom-sheet" onClick={(e) => e.stopPropagation()}><div className="sheet-handle" /><h3>Demo session</h3><button className="sheet-option" onClick={() => { setOpen(false); onSwitch(role === 'customer' ? 'merchant' : 'customer'); }}><RefreshCw size={16} /> Switch to demo {role === 'customer' ? 'shopkeeper' : 'customer'}</button><button className="sheet-option sheet-exit" onClick={() => { setOpen(false); onExit(); }}><X size={16} /> Exit demo</button></div></div>}</>;
}

function NotificationBell({ userId }: { userId?: string }) {
  const [count, setCount] = useState(0);
  useEffect(() => { if (!userId) return; supabase.from('notifications').select('id', { count: 'exact', head: true }).eq('customer', userId).is('read_at', null).then(({ count: nextCount }) => setCount(nextCount ?? 0)); }, [userId]);
  async function openNotifications() { if (!userId) return; const { data } = await supabase.from('notifications').select('id, message').eq('customer', userId).is('read_at', null).order('created_at', { ascending: false }).limit(1); if (data?.[0]) { window.alert(data[0].message); await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', data[0].id); setCount((value) => Math.max(0, value - 1)); } }
  return <button className="icon-button" onClick={openNotifications} aria-label="Notifications"><Bell size={18} />{count > 0 && <span className="count-badge">{count}</span>}</button>;
}

function CustomerApp({ view, setView, products, shops, offers, query, setQuery, cart, setCart, addToCart, tokens, notify, placeRequests, onSignOut, demoSession, email, userId, onSwitchDemo }: { view: View; setView: (view: View) => void; products: Product[]; shops: Shop[]; offers: Offer[]; query: string; setQuery: (value: string) => void; cart: CartItem[]; setCart: React.Dispatch<React.SetStateAction<CartItem[]>>; addToCart: (product: Product, offer: Offer, shop: Shop, size?: string) => void; tokens: Token[]; notify: (message: string, tone?: Toast['tone']) => void; placeRequests: (details?: DeliveryDetails) => void; onSignOut: () => void; demoSession: boolean; email: string; userId: string; onSwitchDemo: (role: Role) => void }) {
  if (view === 'product') return <ProductPage products={products} shops={shops} offers={offers} addToCart={addToCart} setCart={setCart} setView={setView} />;
  if (view === 'search') return <SearchView products={products} shops={shops} offers={offers} query={query} setQuery={setQuery} />;
  if (view === 'cart') return <CartView cart={cart} setCart={setCart} placeRequests={placeRequests} setView={setView} onDeliveryCheckout={() => setView('delivery-checkout')} />;
  if (view === 'tokens') return <TokensView tokens={tokens} shops={shops} notify={notify} userId={userId} setView={setView} />;
  if (view === 'orders') return <OrdersView shops={shops} demoSession={demoSession} notify={notify} userId={userId} />;
  if (view === 'returns') return <ReturnsView shops={shops} tokens={tokens} notify={notify} userId={userId} />;
  if (view === 'delivery-checkout') return <DeliveryCheckout cart={cart} placeRequests={placeRequests} />;
  if (view === 'about') return <AboutPage />;
  if (view === 'profile') return <ProfileView onSignOut={onSignOut} setView={setView} demoSession={demoSession} userId={userId} onSwitchDemo={onSwitchDemo} />;
  return <HomeView products={products} shops={shops} offers={offers} setView={setView} addToCart={addToCart} />;
}

function HomeView({ products, shops, offers, setView, addToCart }: { products: Product[]; shops: Shop[]; offers: Offer[]; setView: (view: View) => void; addToCart: (product: Product, offer: Offer, shop: Shop, size?: string) => void }) {
  const navigate = useNavigate();
  const categoryChips: [string, string, typeof Shirt][] = [['Clothes', 'Fashion', Shirt], ['Festival', 'Festival kits', Gift], ['Decor', 'Decor', Lamp], ['Craft', 'Crafts', Palette], ['Utensils', 'Essentials', Utensils]];
  const featured = products.filter((p) => ['cotton-blue-kurti', 'chikankari-white-kurti', 'cotton-dupatta-mustard', 'led-diya-lights-12'].includes(p.slug));
  return <div className="page"><section className="greeting"><div><span className="eyebrow">Good morning, Aarohi</span><h1>What are you<br /><em>looking for?</em></h1></div><div className="location-pill"><MapPin size={15} /> {DEMO_CITY}</div></section><button className="search-box" onClick={() => setView('search')}><Search size={19} /><span>Search kurtis, gifts, essentials...</span><Camera size={18} /></button><div style={{ display: 'flex', gap: 14, overflowX: 'auto', padding: '4px 2px 16px' }}>{categoryChips.map(([label, category, Icon]) => <button key={category} onClick={() => navigate(`/c/search?cat=${encodeURIComponent(category)}`)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, background: 'none', border: 'none', padding: 0, cursor: 'pointer', flex: '0 0 auto' }}><span style={{ width: 60, height: 60, borderRadius: 20, background: '#fff', border: '1px solid #e2e8ec', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(18,52,90,0.06)', color: '#12345a' }}><Icon size={26} strokeWidth={1.7} /></span><span style={{ fontSize: 12, fontWeight: 600, color: '#12345a' }}>{label}</span></button>)}</div><section className="section-block"><SectionTitle title="From top local shops" action="See all" /><div className="product-grid">{featured.map((product) => { const offer = offers.find((item) => item.product === product.id); const shop = shops.find((item) => item.id === offer?.shop); return offer && shop ? <ProductCard key={product.id} product={product} offer={offer} shop={shop} onAdd={() => addToCart(product, offer, shop, product.has_sizes ? 'S' : undefined)} /> : null; })}</div></section><section className="trend-banner"><div><span className="eyebrow">Trending in {DEMO_CITY}</span><h2>Festival shopping<br />starts here.</h2><button onClick={() => setView('search')}>Explore now <ChevronRight size={16} /></button></div><div className="sunburst"><Sparkles size={30} /></div></section><section className="section-block"><SectionTitle title="Festival kits" action="View all" /><div className="kit-row">{products.filter((p) => p.category === 'Festival kits').map((product) => { const offer = offers.find((item) => item.product === product.id); const shop = shops.find((item) => item.id === offer?.shop); return offer && shop ? <ProductCard key={product.id} product={product} offer={offer} shop={shop} onAdd={() => addToCart(product, offer, shop)} /> : null; })}</div></section><section className="city-note"><BookOpen size={18} /><div><b>Why these results?</b><p>We rank by trusted local shops, stock confidence, distance and price.</p></div><ChevronRight size={18} /></section></div>;
}

function SearchView({ products, shops, offers, query, setQuery }: { products: Product[]; shops: Shop[]; offers: Offer[]; query: string; setQuery: (value: string) => void }) {
  const location = useLocation();
  const urlCategory = new URLSearchParams(location.search).get('cat') ?? 'All';
  const [filter, setFilter] = useState(urlCategory);
  useEffect(() => { setFilter(urlCategory); }, [urlCategory]);
  const results = useMemo(() => offers.map((offer) => ({ offer, product: products.find((p) => p.id === offer.product), shop: shops.find((s) => s.id === offer.shop) })).filter((item) => item.product && item.shop && (!query || item.product.name.toLowerCase().includes(query.toLowerCase())) && (filter === 'All' || item.product.category === filter)).sort((a, b) => Number(b.shop?.subscribed) - Number(a.shop?.subscribed) || Number((b.shop?.token_volume ?? 0) >= 50) - Number((a.shop?.token_volume ?? 0) >= 50) || (a.shop?.distance_km ?? 0) - (b.shop?.distance_km ?? 0)), [offers, products, shops, query, filter]);
  return <div className="page"><div className="search-header"><div className="search-box compact"><Search size={18} /><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search products" /><X size={17} onClick={() => setQuery('')} /></div><button className="icon-button filled"><Camera size={18} /></button></div><div className="chip-row">{['All', 'Fashion', 'Festival kits', 'Decor', 'Crafts', 'Essentials'].map((item) => <button key={item} className={`filter-chip ${filter === item ? 'selected' : ''}`} onClick={() => setFilter(item)}>{item}</button>)}</div><div className="search-intro"><div><span className="eyebrow">Showing nearby stock</span><h2>{results.length} matches for you</h2></div><button className="sort-button"><Zap size={14} /> Best match</button></div><div className="product-grid search-grid">{results.map(({ product, offer, shop }) => product && shop ? <ProductCard key={offer.id} product={product} offer={offer} shop={shop} onAdd={() => {}} /> : null)}</div>{results.length === 0 && <div className="empty-card"><PackageCheck size={28} /><h3>Nothing nearby yet</h3><p>Try a different search term.</p></div>}</div>;
}



function CartView({ cart, setCart, placeRequests, setView, onDeliveryCheckout }: { cart: CartItem[]; setCart: React.Dispatch<React.SetStateAction<CartItem[]>>; placeRequests: (details?: DeliveryDetails) => void; setView: (view: View) => void; onDeliveryCheckout: () => void }) {
  const buckets = Array.from(new Set(cart.map((item) => item.shop.id))).map((id) => cart.filter((item) => item.shop.id === id)); const total = cart.reduce((sum, item) => sum + item.offer.price * item.quantity, 0); const delivery = cart.reduce((sum, item) => sum + (item.mode === 'delivery' ? deliveryFee(item.shop.distance_km) ?? 0 : 0), 0);
  return <div className="page"><div className="page-heading"><div><span className="eyebrow">Your basket</span><h1>{cart.length ? 'Ready when you are' : 'Your basket is empty'}</h1></div><ShoppingBag size={23} /></div>{!cart.length ? <div className="empty-card"><ShoppingBag size={30} /><h3>Find something lovely nearby</h3><p>Search local shops and reserve the exact item you want.</p><button className="primary-button" onClick={() => setView('search')}>Start searching</button></div> : <><div className="route-card"><div className="route-icon"><MapPin size={18} /></div><div><b>{buckets.length} shop{buckets.length > 1 ? 's' : ''} on your route</b><p>{buckets.map((bucket) => bucket[0].shop.name).join('  →  ')}</p></div><ChevronRight size={18} /></div>{buckets.map((bucket) => { const bucketTotal = bucket.reduce((sum, item) => sum + item.offer.price * item.quantity, 0); return <section className="cart-bucket" key={bucket[0].shop.id}><div className="bucket-heading"><div><h3>{bucket[0].shop.name}</h3><span><MapPin size={12} /> {bucket[0].shop.distance_km} km away</span></div><b>{money(bucketTotal)}</b></div><div className="segmented"><button className={bucket[0].mode === 'token' ? 'selected' : ''} onClick={() => setCart((current) => current.map((item) => item.shop.id === bucket[0].shop.id ? { ...item, mode: 'token' } : item))}><Ticket size={14} /> Reserve & inspect</button><button className={bucket[0].mode === 'delivery' ? 'selected' : ''} onClick={() => setCart((current) => current.map((item) => item.shop.id === bucket[0].shop.id ? { ...item, mode: 'delivery' } : item))}><Truck size={14} /> Home delivery</button></div>{bucket[0].mode === 'token' && bucketTotal < 250 && <p className="hint"><CircleHelp size={14} /> Reserve is free above ₹250. Choose delivery for this basket.</p>}{bucket.map((item) => <div className="cart-line" key={item.offer.id}><ImageThumb slug={item.product.slug} url={item.product.image_url} small /><div><b>{item.product.name}</b><p>{item.size ? `Size ${item.size} · ` : ''}{item.quantity} item</p></div><strong>{money(item.offer.price * item.quantity)}</strong></div>)}</section>; })}<div className="checkout-card"><div><span>Total</span><h2>{money(total + delivery)}</h2><p>{delivery ? `Includes ${money(delivery)} delivery` : 'Pay the shop directly on pickup'}</p></div><button className="primary-button" onClick={() => buckets.some((bucket) => bucket[0].mode === 'delivery') ? onDeliveryCheckout() : placeRequests()}>Place request <Send size={16} /></button></div></>}</div>;
}

function DeliveryCheckout({ cart, placeRequests }: { cart: CartItem[]; placeRequests: (details?: DeliveryDetails) => void }) {
  const [paymentMethod, setPaymentMethod] = useState<DeliveryDetails['paymentMethod']>('upi');
  const deliveryItems = cart.filter((item) => item.mode === 'delivery');
  const buckets = Array.from(new Set(deliveryItems.map((item) => item.shop.id))).map((id) => deliveryItems.filter((item) => item.shop.id === id));
  const unavailable = buckets.filter((bucket) => deliveryFee(bucket[0].shop.distance_km) === null);
  function submit(event: React.FormEvent<HTMLFormElement>) { event.preventDefault(); const data = new FormData(event.currentTarget); placeRequests({ name: String(data.get('name') ?? ''), phone: String(data.get('phone') ?? ''), address: String(data.get('address') ?? ''), pin: String(data.get('pin') ?? ''), paymentMethod }); }
  return <div className="page"><div className="page-heading"><div><span className="eyebrow">Home delivery</span><h1>Almost there</h1></div><Truck size={23} /></div>{unavailable.length > 0 && <div className="empty-card"><Truck size={28} /><h3>Delivery is not available</h3><p>{unavailable.map((bucket) => bucket[0].shop.name).join(', ')} is beyond 10 km. Choose reserve and visit instead.</p></div>}<form className="auth-form" onSubmit={submit}><section className="cart-bucket"><h3>Delivery address</h3><label>Name<input name="name" required /></label><label>Phone<input name="phone" required inputMode="tel" /></label><label>Address line<input name="address" required /></label><label>Pin code<input name="pin" required inputMode="numeric" pattern="[0-9]{6}" /></label></section><section className="cart-bucket"><h3>Order summary</h3>{buckets.map((bucket) => { const total = bucket.reduce((sum, item) => sum + item.offer.price * item.quantity, 0); const fee = deliveryFee(bucket[0].shop.distance_km) ?? 0; return <div className="cart-line" key={bucket[0].shop.id}><div><b>{bucket[0].shop.name}</b><p>{bucket.reduce((sum, item) => sum + item.quantity, 0)} items · {money(total)} + {money(fee)} delivery</p>{total < 300 && <p>Small-order delivery charge applies</p>}</div><strong>{money(total + fee)}</strong></div>; })}</section><section className="cart-bucket"><h3>Payment</h3>{(['upi', 'card', 'cod'] as const).map((method) => <label key={method}><input type="radio" name="payment" value={method} checked={paymentMethod === method} onChange={() => setPaymentMethod(method)} /> {method === 'upi' ? 'UPI' : method === 'card' ? 'Card' : 'Cash on delivery'}</label>)}</section><button className="primary-button full" disabled={unavailable.length > 0 || buckets.length === 0}>Place delivery order <Send size={16} /></button></form></div>;
}

function OrdersView({ shops, demoSession, notify, userId }: { shops: Shop[]; demoSession: boolean; notify: (message: string, tone?: Toast['tone']) => void; userId: string }) {
  const [orders, setOrders] = useState<OrderRecord[]>([]); const [loading, setLoading] = useState(true);
  useEffect(() => { let active = true; supabase.from('orders').select('*').eq('customer', userId).order('created_at', { ascending: false }).then(({ data }) => { if (active) { setOrders((data ?? []) as OrderRecord[]); setLoading(false); } }); return () => { active = false; }; }, [userId]);
  async function advance(order: OrderRecord) { const nextStatus: Record<OrderRecord['status'], OrderRecord['status']> = { placed: 'confirmed', confirmed: 'out_for_delivery', out_for_delivery: 'delivered', delivered: 'delivered', returned: 'returned' }; const next = nextStatus[order.status]; if (next === order.status) return; const result = await supabase.from('orders').update({ status: next }).eq('id', order.id); if (result.error) { notify('Could not update the order.', 'error'); return; } setOrders((current) => current.map((item) => item.id === order.id ? { ...item, status: next } : item)); notify('Order status updated.'); }
  if (loading) return <div className="page"><div className="empty-card"><p>Loading your orders…</p></div></div>;
  return <div className="page"><div className="page-heading"><div><span className="eyebrow">Your deliveries</span><h1>Delivery orders</h1></div><Truck size={23} /></div>{orders.length === 0 ? <div className="empty-card"><Truck size={30} /><h3>No delivery orders yet</h3><p>Choose Home delivery from your basket to see orders here.</p><button className="primary-button" onClick={() => window.history.back()}>Start shopping</button></div> : orders.map((order) => { const shop = shops.find((item) => item.id === order.shop); const currentStep = order.status === 'confirmed' ? 1 : order.status === 'out_for_delivery' ? 2 : order.status === 'delivered' ? 3 : 0; return <article className="request-card" key={order.id}><div className="request-meta"><span className="chip orange-chip">{order.status === 'confirmed' ? 'Packed' : order.status.replace(/_/g, ' ')}</span><span>{new Date(order.created_at).toLocaleDateString('en-IN')}</span></div><div className="request-customer"><div><b>{shop?.name ?? 'Local shop'}</b><p>{money(order.total)} + {money(order.delivery_fee)} delivery · {order.payment_method?.toUpperCase() ?? 'Payment'}</p></div></div><div className="chip-row">{['Placed', 'Packed', 'Out for delivery', 'Delivered'].map((step, index) => <span className={`chip ${index <= currentStep ? 'green-chip' : 'navy-chip'}`} key={step}>{step}</span>)}</div>{demoSession && order.status !== 'delivered' && <button className="primary-button" onClick={() => advance(order)}>Mark next status</button>}</article>; })}</div>;
}

function ReturnsView({ shops, tokens, notify, userId }: { shops: Shop[]; tokens: Token[]; notify: (message: string, tone?: Toast['tone']) => void; userId: string }) {
  const [orders, setOrders] = useState<OrderRecord[]>([]); const [returns, setReturns] = useState<ReturnRecord[]>([]); const [reason, setReason] = useState(''); const [kind, setKind] = useState<'return' | 'exchange'>('return'); const [orderId, setOrderId] = useState(''); const [tokenId, setTokenId] = useState(''); const [grievanceReason, setGrievanceReason] = useState(''); const [busy, setBusy] = useState(false);
  useEffect(() => { let active = true; Promise.all([supabase.from('orders').select('*').eq('customer', userId).order('created_at', { ascending: false }), supabase.from('returns').select('*').eq('customer', userId).order('created_at', { ascending: false })]).then(([ordersResult, returnsResult]) => { if (active) { setOrders((ordersResult.data ?? []) as OrderRecord[]); setReturns((returnsResult.data ?? []) as ReturnRecord[]); } }); return () => { active = false; }; }, [userId]);
  async function upload(file: File | undefined): Promise<string | null> { if (!file) return null; if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) throw new Error('Use a JPG, PNG, or WebP photo under 5 MB.'); const path = `${userId}/${crypto.randomUUID()}.${file.type.split('/')[1]}`; const result = await supabase.storage.from('return-photos').upload(path, file, { contentType: file.type, upsert: false }); if (result.error) throw new Error('Photo upload failed. Please try again.'); return path; }
  async function submitReturn(event: React.FormEvent<HTMLFormElement>) { event.preventDefault(); setBusy(true); try { const file = (event.currentTarget.elements.namedItem('photo') as HTMLInputElement).files?.[0]; const photoPath = await upload(file); const result = await supabase.from('returns').insert({ order_id: orderId, reason, kind, photo_path: photoPath }).select().maybeSingle(); if (result.error) throw new Error('Could not submit the request.'); setReturns((current) => [result.data as ReturnRecord, ...current]); setReason(''); notify('Return request submitted.'); } catch (error) { notify(error instanceof Error ? error.message : 'Could not submit the request.', 'error'); } finally { setBusy(false); } }
  async function submitGrievance(event: React.FormEvent<HTMLFormElement>) { event.preventDefault(); setBusy(true); try { const file = (event.currentTarget.elements.namedItem('photo') as HTMLInputElement).files?.[0]; const photoPath = await upload(file); const result = await supabase.from('returns').insert({ token_id: tokenId, reason: grievanceReason, kind: 'grievance', photo_path: photoPath }).select().maybeSingle(); if (result.error) throw new Error('Could not submit the report.'); setReturns((current) => [result.data as ReturnRecord, ...current]); setGrievanceReason(''); notify('Problem report submitted.'); } catch (error) { notify(error instanceof Error ? error.message : 'Could not submit the report.', 'error'); } finally { setBusy(false); } }
  const eligibleOrders = orders.filter((order) => order.status === 'delivered' && Date.now() - new Date(order.created_at).getTime() <= 86400000);
  return <div className="page"><div className="page-heading"><div><span className="eyebrow">After purchase</span><h1>Returns & exchanges</h1></div><RefreshCw size={23} /></div><section className="cart-bucket"><h3>Delivery orders</h3>{eligibleOrders.length === 0 ? <p>No delivered orders are eligible within 24 hours.</p> : <form className="auth-form" onSubmit={submitReturn}><label>Order<select value={orderId} onChange={(event) => setOrderId(event.target.value)} required><option value="">Choose an order</option>{eligibleOrders.map((order) => <option key={order.id} value={order.id}>{shops.find((shop) => shop.id === order.shop)?.name ?? 'Local shop'} · {money(order.total)}</option>)}</select></label><label>Request<select value={kind} onChange={(event) => setKind(event.target.value as 'return' | 'exchange')}><option value="return">Return</option><option value="exchange">Size exchange</option></select></label><label>Reason<textarea value={reason} onChange={(event) => setReason(event.target.value)} required /></label><label>Photo<input name="photo" type="file" accept="image/jpeg,image/png,image/webp" required /></label><button className="primary-button" disabled={busy}>Submit request</button></form>}</section><section className="cart-bucket"><h3>Token purchases</h3><p>Change-of-mind returns are not available for token purchases. Report a defective or not-as-described item instead.</p>{tokens.length === 0 ? <p>No token purchases to report.</p> : <form className="auth-form" onSubmit={submitGrievance}><label>Token<select value={tokenId} onChange={(event) => setTokenId(event.target.value)} required><option value="">Choose a token</option>{tokens.map((token) => <option key={token.id} value={token.id}>{token.shop.name} · {money(token.total)}</option>)}</select></label><label>Problem<textarea value={grievanceReason} onChange={(event) => setGrievanceReason(event.target.value)} required /></label><label>Photo<input name="photo" type="file" accept="image/jpeg,image/png,image/webp" required /></label><button className="primary-button" disabled={busy}>Report a problem</button></form>}</section>{returns.length > 0 && <section className="cart-bucket"><h3>Request status</h3>{returns.map((item) => <div className="cart-line" key={item.id}><div><b>{item.kind === 'grievance' ? 'Problem report' : item.kind === 'exchange' ? 'Size exchange' : 'Return'}</b><p>{item.reason}</p></div><span className="chip green-chip">{item.status}</span></div>)}</section>}</div>;
}

function TokensView({ tokens, shops, notify, userId, setView }: { tokens: Token[]; shops: Shop[]; notify: (message: string, tone?: Toast['tone']) => void; userId: string; setView: (view: View) => void }) {
  const [bulkRequests, setBulkRequests] = useState<BulkRequest[]>([]);
  const [reliability, setReliability] = useState<Reliability | null>(null);
  useEffect(() => { let active = true; supabase.rpc('expire_my_tokens').then(() => undefined); supabase.from('requests').select('*').eq('customer', userId).eq('bulk', true).in('status', ['pending', 'held']).order('created_at', { ascending: false }).then(({ data }) => { if (active) setBulkRequests((data ?? []) as BulkRequest[]); }); supabase.from('profiles').select('no_show_count, free_tokens_disabled_until').eq('id', userId).maybeSingle().then(({ data }) => { if (active && data) setReliability(data as Reliability); }); return () => { active = false; }; }, [userId]);
  const [tick, setTick] = useState(0); const [stockReqs, setStockReqs] = useState<any[]>([]); const issuing = useRef(new Set<string>());
  useEffect(() => { let active = true; const run = async () => {
    const since = new Date(Date.now() - 86400000).toISOString();
    const r = await supabase.from('requests').select('*').eq('customer', userId).eq('bulk', false).in('status', ['pending', 'held', 'rejected']).gte('created_at', since).order('created_at', { ascending: false });
    const t = await supabase.from('tokens').select('request').eq('customer', userId).gte('created_at', since);
    if (!active || !r.data) return;
    const hasToken = new Set((t.data ?? []).map((x: any) => x.request)); const open = r.data.filter((x: any) => !hasToken.has(x.id));
    for (const q of open.filter((x: any) => x.status === 'held' && x.total >= 250 && !issuing.current.has(x.id))) {
      issuing.current.add(q.id); const otp = String(Math.floor(100000 + Math.random() * 900000)); const exp = new Date(Date.now() + 3 * 3600000).toISOString();
      const ins = await supabase.from('tokens').insert({ request: q.id, shop: q.shop, items: q.items, total: q.total, otp, expires_at: exp });
      if (ins.error) issuing.current.delete(q.id); else { notify('Shop confirmed stock. Your token is ready.'); setTick((n) => n + 1); }
    }
    if (active) setStockReqs(open.filter((x: any) => x.status !== 'held'));
  }; run(); const id = window.setInterval(run, 10000); return () => { active = false; window.clearInterval(id); }; }, [userId]);
  type TokenRow = Token & { created_at?: string };
  const [dbTokens, setDbTokens] = useState<TokenRow[] | null>(null);
  useEffect(() => { let active = true; (async () => { await supabase.rpc('expire_my_tokens'); const { data } = await supabase.from('tokens').select('*').eq('customer', userId).order('created_at', { ascending: false }); if (!active || !data) return; const rows = data.map((row) => ({ id: row.id, shop: shops.find((item) => item.id === row.shop), total: Number(row.total), otp: row.otp, status: row.status, expires_at: row.expires_at, created_at: row.created_at, items: (row.items ?? []) as CartItem[] })).filter((row) => row.shop) as TokenRow[]; setDbTokens(rows); })(); return () => { active = false; }; }, [userId, shops, tokens.length, tick]);
  const isLive = (token: TokenRow) => token.status === 'active' && new Date(token.expires_at).getTime() > Date.now();
  const liveTokens: Token[] = dbTokens ? dbTokens.filter(isLive) : tokens;
  const pastTokens: TokenRow[] = dbTokens ? dbTokens.filter((token) => !isLive(token)) : [];
  const routeShops = Array.from(new Map(liveTokens.map((token) => [token.shop.id, token.shop])).values()).sort((a, b) => a.distance_km - b.distance_km);
  const routeMinutes = routeShops.reduce((total, shop) => total + shop.distance_km * 3, 5 * routeShops.length);
  return <><div className="page">{routeShops.length >= 2 && <div className="route-card"><div className="route-icon"><MapPin size={18} /></div><div><b>Your pickup route</b><p>{routeShops.map((shop) => shop.name).join(' → ')} · About {Math.round(routeMinutes)} minutes</p><a href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(routeShops.map((shop) => shop.name + ' ' + DEMO_CITY).join('|'))}`} target="_blank" rel="noreferrer">Open in Google Maps</a></div></div>}{bulkRequests.map((request) => <BulkRequestCard key={request.id} request={request} shops={shops} notify={notify} setView={setView} />)}{stockReqs.map((q) => <section className="cart-bucket" key={q.id}><div className="bucket-heading"><div><h3>{shops.find((x) => x.id === q.shop)?.name ?? 'Local shop'}</h3><span>{q.status === 'rejected' ? 'Not available' : 'Waiting for shop · ' + money(q.total)}</span></div><span className={`chip ${q.status === 'rejected' ? 'orange-chip' : 'navy-chip'}`}>{q.status === 'rejected' ? 'Out of stock' : 'Checking stock'}</span></div>{(q.items ?? []).map((it: any, k: number) => <p key={k}>{it?.product?.name ?? 'Item'}{it?.size ? ` · ${it.size}` : ''} × {it?.quantity ?? 1}</p>)}{q.status === 'rejected' ? <><p>This shop does not have it right now. Try another shop.</p><button className="primary-button" onClick={() => setView('search')}>Search other shops</button></> : <p className="hint">The shopkeeper was notified. Your token appears here as soon as they confirm. No payment yet.</p>}</section>)}</div><ActiveTokensView tokens={liveTokens} notify={notify} reliability={reliability} /><div className="page" style={{ paddingTop: 0 }}><div className="page-heading"><div><span className="eyebrow">Past pickups</span><h1>Token history</h1></div><Ticket size={23} /></div>{dbTokens === null ? <div className="empty-card"><p>Loading your history...</p></div> : pastTokens.length === 0 ? <div className="empty-card"><Ticket size={28} /><h3>No past tokens yet</h3><p>Used, expired and cancelled tokens will show up here.</p></div> : pastTokens.map((token) => <article className="token-card" key={token.id}><div className="token-head"><div><span className={`chip ${token.status === 'used' ? 'green-chip' : 'orange-chip'}`}>{token.status === 'used' ? 'Picked up' : token.status === 'cancelled' ? 'Cancelled' : 'Expired'}</span><h2>{token.shop.name}</h2><p>{new Date(token.created_at ?? token.expires_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })} · {money(token.total)}</p></div></div><div className="token-items">{(token.items ?? []).map((item, index) => <div key={item.offer?.id ?? index}><span>{item.product?.name ?? 'Item'}{item.size ? ` · ${item.size}` : ''}</span><b>{item.quantity} × {money(item.offer?.price ?? 0)}</b></div>)}</div></article>)}</div></>;
}

function BulkRequestCard({ request, shops, notify, setView }: { request: BulkRequest; shops: Shop[]; notify: (message: string, tone?: Toast['tone']) => void; setView: (view: View) => void }) {
  const [now, setNow] = useState(Date.now()); const [showChoices, setShowChoices] = useState(false);
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(timer); }, []);
  const remaining = request.approval_expires_at ? Math.max(0, new Date(request.approval_expires_at).getTime() - now) : 0; const minutes = Math.floor(remaining / 60000); const seconds = String(Math.floor(remaining / 1000) % 60).padStart(2, '0');
  const available = request.approved_items ?? [];
  async function continueAvailable() { if (!available.length) return; const shop = shops.find((item) => item.id === request.shop); if (!shop) return; const otp = String(Math.floor(100000 + Math.random() * 900000)); const expiresAt = new Date(Date.now() + 3 * 3600000).toISOString(); const result = await supabase.from('tokens').insert({ request: request.id, shop: shop.id, items: available, total: available.reduce((sum, item) => sum + item.offer.price * item.quantity, 0), otp, expires_at: expiresAt }); if (result.error) { notify('Could not continue with the available items.', 'error'); return; } notify('Your available items are ready to pick up.'); setShowChoices(false); }
  return <section className="cart-bucket"><div className="bucket-heading"><div><h3>{shops.find((shop) => shop.id === request.shop)?.name ?? 'Local shop'}</h3><span>{remaining ? `Waiting · ${minutes}:${seconds}` : 'Approval window expired'}</span></div><span className="chip orange-chip">Bulk cart</span></div>{remaining ? <p>Waiting for the shop to approve your cart.</p> : <p>This approval window expired. Try another shop.</p>}{available.length > 0 && <button className="primary-button" onClick={() => setShowChoices(true)}>Choose what to do</button>}{showChoices && <div className="empty-card"><h3>Some items are available</h3><p>Continue with available items, swap missing items, or try another shop.</p><button className="primary-button" onClick={continueAvailable}>Continue with available items</button><button className="outline-button" onClick={() => { setShowChoices(false); setView('search'); }}>Swap items</button><div><b>Try another shop</b>{shops.filter((shop) => shop.id !== request.shop).map((shop) => <p key={shop.id}>{shop.name} · {shop.distance_km} km</p>)}</div></div>}</section>;
}

function ActiveTokensView({ tokens, notify, reliability }: { tokens: Token[]; notify: (message: string, tone?: Toast['tone']) => void; reliability: Reliability | null }) {
  const [reportingToken, setReportingToken] = useState<string | null>(null);
  const [reportReason, setReportReason] = useState('');
  const [busy, setBusy] = useState(false);
  async function submitReport(tokenId: string) {
    if (!reportReason.trim()) { notify('Please describe what happened at the shop.', 'error'); return; }
    setBusy(true);
    const result = await supabase.from('scan_reports').insert({ token: tokenId, reason: reportReason });
    if (result.error) { notify('Could not submit the report. Try again.', 'error'); setBusy(false); return; }
    notify('Scan refusal reported. This token will not count as a missed pickup.');
    setReportingToken(null); setReportReason(''); setBusy(false);
  }
  const paused = reliability && reliability.free_tokens_disabled_until && new Date(reliability.free_tokens_disabled_until) > new Date();
  return <div className="page">{paused && <div className="empty-card"><ShieldCheck size={22} /><h3>Free tokens paused</h3><p>You missed 3 pickups, so free tokens are paused for 24 hours. You can still shop with delivery.</p></div>}<div className="page-heading"><div><span className="eyebrow">Your pickups</span><h1>Active tokens</h1></div><Ticket size={23} /></div>{tokens.length === 0 ? <div className="empty-card"><Ticket size={30} /><h3>No active tokens</h3><p>Reserve an item for free when your shop basket is ₹250 or more.</p></div> : tokens.map((token) => <article className="token-card" key={token.id}><div className="token-head"><div><span className="chip green-chip">Active</span><h2>{token.shop.name}</h2><p><MapPin size={13} /> {token.shop.distance_km} km · Expires today</p></div><div className="qr-box">{token.otp.split('').map((digit, index) => <span key={`${digit}-${index}`} style={{ height: `${10 + Number(digit) * 2}px` }} />)}</div></div><div className="otp-block"><span>Show this code at the counter</span><b>{token.otp}</b></div><p className="hint">No change-of-mind returns. Report defects or items not as described in Returns & exchanges.</p><div className="token-items">{token.items.map((item) => <div key={item.offer.id}><span>{item.product.name}{item.size ? ` · ${item.size}` : ''}</span><b>{item.quantity} × {money(item.offer.price)}</b></div>)}</div><div className="token-actions"><button onClick={() => window.open(`https://maps.google.com/?q=${encodeURIComponent(token.shop.name + ' ' + DEMO_CITY)}`, '_blank')}><MapPin size={15} /> Directions</button><button onClick={() => notify('Token cancelled') }><X size={15} /> Cancel</button><button onClick={() => setReportingToken(token.id)}><ShieldCheck size={15} /> Shop refused to scan</button></div>{reportingToken === token.id && <div className="empty-card"><h3>Report a refused scan</h3><p>This protects your reliability score. The token will not count as a missed pickup.</p><textarea value={reportReason} onChange={(event) => setReportReason(event.target.value)} placeholder="What happened at the shop?" /><button className="primary-button" disabled={busy} onClick={() => submitReport(token.id)}>Submit report</button><button className="ghost-button" onClick={() => { setReportingToken(null); setReportReason(''); }}>Cancel</button></div>}</article>)}</div>;
}

function MerchantApp({ view, setView, shops, tokens, notify, email, products, offers, userId, loadCatalog, demoSession, onSwitchDemo, onSignOut }: { view: View; setView: (view: View) => void; shops: Shop[]; tokens: Token[]; notify: (message: string, tone?: Toast['tone']) => void; email: string; products: Product[]; offers: Offer[]; userId: string; loadCatalog: () => Promise<void>; demoSession: boolean; onSwitchDemo: (role: Role) => void; onSignOut: () => void }) {
  const [ownedId, setOwnedId] = useState<string | null>(null);
  useEffect(() => { let live = true; supabase.from('shops').select('id').eq('owner', userId).limit(1).maybeSingle().then((r) => { if (live && r.data) setOwnedId((r.data as { id: string }).id); }); return () => { live = false; }; }, [userId]);
  const shop = shops.find((x) => x.id === ownedId) ?? shops[0];
  if (view === 'scan') return <ScanView shop={shop} notify={notify} />;
  if (view === 'wallet') return <WalletView shop={shop} notify={notify} />;
  if (view === 'radar') return <RadarView />;
  if (view === 'inventory') return <InventoryView shop={shop} products={products} offers={offers} notify={notify} onChanged={loadCatalog} />;
  if (view === 'pricing') return <PricingView shop={shop} products={products} offers={offers} notify={notify} />;
  if (view === 'catalog') return <CatalogUploadView shop={shop} products={products} notify={notify} onApproved={loadCatalog} userId={userId} />;
  if (view === 'kits') return <KitsView shop={shop} products={products} notify={notify} />;
  if (view === 'merchant-orders') return <MerchantOrdersView shop={shop} notify={notify} />;
  if (view === 'earnings') return <EarningsView shop={shop} notify={notify} />;
  if (view === 'about') return <AboutPage />;
  if (view === 'more') return <MoreView shop={shop} setView={setView} demoSession={demoSession} onSwitchDemo={onSwitchDemo} onSignOut={onSignOut} />;
  return <MerchantRequests shop={shop} setView={setView} notify={notify} products={products} />;
}
type ReqRow = { id: string; customer: string; items: any[]; total: number; bulk: boolean; status: string; created_at: string };
type TokRow = { id: string; request: string | null; customer: string; total: number; otp: string; status: string; expires_at: string; created_at: string };
function ago(iso: string) { const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000)); return m < 1 ? 'Just now' : m < 60 ? `${m} min ago` : `${Math.round(m / 60)} h ago`; }
function MerchantRequests({ shop, setView, notify }: { shop: Shop; setView: (view: View) => void; notify: (message: string, tone?: Toast['tone']) => void; products: Product[] }) {
  const [reqs, setReqs] = useState<ReqRow[]>([]); const [toks, setToks] = useState<TokRow[]>([]); const [loading, setLoading] = useState(true); const [busy, setBusy] = useState('');
  const load = async () => {
    const since = new Date(Date.now() - 7 * 86400000).toISOString();
    const [r, t] = await Promise.all([
      supabase.from('requests').select('*').eq('shop', shop.id).gte('created_at', since).order('created_at', { ascending: false }),
      supabase.from('tokens').select('*').eq('shop', shop.id).gte('created_at', since).order('created_at', { ascending: false }),
    ]);
    if (r.data) setReqs(r.data as ReqRow[]); if (t.data) setToks(t.data as TokRow[]); setLoading(false);
  };
  useEffect(() => { load(); const id = window.setInterval(load, 15000); return () => window.clearInterval(id); }, [shop.id]);
  const now = Date.now(); const day = now - 86400000;
  const tokenByReq = new Map(toks.filter((t) => t.request).map((t) => [t.request as string, t]));
  const liveTokens = toks.filter((t) => t.status === 'active' && new Date(t.expires_at).getTime() > now);
  const newReqs = reqs.filter((r) => r.status === 'pending' && !tokenByReq.has(r.id) && new Date(r.created_at).getTime() > day);
  const heldReqs = reqs.filter((r) => r.status === 'held' && !tokenByReq.has(r.id) && new Date(r.created_at).getTime() > day);
  const reqById = new Map(reqs.map((r) => [r.id, r]));
  const weekTokens = toks.length; const openCount = liveTokens.length + newReqs.length;
  const decide = async (r: ReqRow, status: 'held' | 'rejected') => {
    setBusy(r.id);
    const patch: Record<string, unknown> = { status }; if (status === 'held' && r.bulk) patch.approved_items = r.items;
    const res = await supabase.from('requests').update(patch).eq('id', r.id);
    setBusy('');
    if (res.error) { notify(res.error.message || 'Could not update the request.', 'error'); return; }
    notify(status === 'held' ? 'Stock held for the customer' : 'Marked out of stock'); load();
  };
  const itemsList = (items: any[]) => (items ?? []).map((it, k) => <div className="request-item" key={k}>{it?.product?.slug && <ImageThumb slug={it.product.slug} url={it.product.image_url} small />}<div><b>{it?.product?.name ?? 'Item'}</b><p>{it?.size ? `Size ${it.size} · ` : ''}{it?.quantity ?? 1} pc</p></div></div>);
  const who = (id: string) => `Customer #${id.slice(0, 4).toUpperCase()}`;
  return <div className="page merchant-page"><div className="merchant-banner"><div className="merchant-avatar"><Store size={24} /></div><div><span className="eyebrow">Merchant home</span><h1>{shop.name}</h1><p><span className="live-dot" /> Accepting requests</p></div><Menu size={20} /></div>
    <div className="merchant-stats"><div><b>₹{shop.wallet_balance ?? 0}</b><span>Wallet balance</span></div><div><b>{weekTokens}</b><span>Tokens this week</span></div><div><b>{openCount}</b><span>Open now</span></div></div>
    <div className="section-heading"><div><span className="eyebrow">Live inbox · updates every 15 s</span><h2>Requests <span className="count-badge">{openCount}</span></h2></div><button className="refresh" onClick={load} aria-label="Refresh"><RefreshCw size={16} /></button></div>
    {loading && <p className="hint">Loading…</p>}
    {!loading && openCount === 0 && heldReqs.length === 0 && <div className="empty-card"><b>No open requests right now</b><p className="hint">When a customer reserves an item from your shop, it shows up here.</p></div>}
    {liveTokens.map((t) => { const r = t.request ? reqById.get(t.request) : undefined; return <article className="request-card" key={t.id}><div className="request-meta"><span className="chip green-chip">Token issued · keep items ready</span><span>{ago(t.created_at)}</span></div><div className="request-customer"><div className="customer-avatar">{t.customer.slice(0, 2).toUpperCase()}</div><div><b>{who(t.customer)}</b><p>Will come to inspect and pick up</p></div><strong>₹{t.total}</strong></div>{r && itemsList(r.items)}<div className="request-actions"><button className="primary-button" onClick={() => setView('scan')}>Scan token</button></div><p className="hint">Customer shows a 6-digit code when they arrive.</p></article>; })}
    {newReqs.map((r) => <article className="request-card" key={r.id}><div className="request-meta"><span className="chip orange-chip">{r.bulk ? 'Bulk request · needs approval' : 'New request'}</span><span>{ago(r.created_at)}</span></div><div className="request-customer"><div className="customer-avatar">{r.customer.slice(0, 2).toUpperCase()}</div><div><b>{who(r.customer)}</b><p>Wants to reserve for inspection</p></div><strong>₹{r.total}</strong></div>{itemsList(r.items)}<div className="request-actions"><button className="primary-button" disabled={busy === r.id} onClick={() => decide(r, 'held')}>Hold stock</button><button className="ghost-button" disabled={busy === r.id} onClick={() => decide(r, 'rejected')}>Out of stock</button></div></article>)}
    {heldReqs.map((r) => <article className="request-card" key={r.id}><div className="request-meta"><span className="chip navy-chip">Held</span><span>{ago(r.created_at)}</span></div><div className="request-customer"><div className="customer-avatar">{r.customer.slice(0, 2).toUpperCase()}</div><div><b>{who(r.customer)}</b><p>You approved this request</p></div><strong>₹{r.total}</strong></div>{itemsList(r.items)}<div className="request-actions"><button className="approved-button"><Check size={17} /> Held for customer</button></div></article>)}
    <button className="scan-launch" onClick={() => setView('scan')}><div><span>Ready at the counter?</span><b>Scan a token</b></div><div className="scan-circle"><Camera size={22} /></div></button></div>;
}
function ScanView({ shop, notify }: { shop: Shop; notify: (message: string, tone?: Toast['tone']) => void }) {
  type ScanToken = { id: string; total: number; items: CartItem[] };
  const [otp, setOtp] = useState('');
  const [token, setToken] = useState<ScanToken | null>(null);
  const [problem, setProblem] = useState<'invalid' | 'expired' | 'error' | null>(null);
  const [checking, setChecking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [billed, setBilled] = useState<{ total: number } | null>(null);
  useEffect(() => {
    setToken(null); setProblem(null);
    if (otp.length !== 6) { setChecking(false); return; }
    let active = true; setChecking(true);
    supabase.from('tokens').select('*').eq('otp', otp).eq('shop', shop.id).eq('status', 'active').order('created_at', { ascending: false }).limit(1).maybeSingle().then(({ data, error }) => {
      if (!active) return; setChecking(false);
      if (error) { setProblem('error'); return; }
      if (!data) { setProblem('invalid'); return; }
      if (new Date(data.expires_at).getTime() < Date.now()) { setProblem('expired'); return; }
      setToken({ id: data.id, total: Number(data.total), items: (data.items ?? []) as CartItem[] });
    });
    return () => { active = false; };
  }, [otp, shop.id]);
  async function generateBill() {
    if (!token || busy) return;
    setBusy(true);
    const result = await supabase.rpc('complete_token_pickup', { p_token: token.id });
    setBusy(false);
    if (result.error) { notify(`Could not generate the bill: ${result.error.message}`, 'error'); return; }
    setBilled({ total: token.total }); setToken(null); setOtp('');
    notify('Bill generated and token marked used');
  }
  return <div className="page"><div className="page-heading"><div><span className="eyebrow">Counter tools</span><h1>Scan token</h1></div><Camera size={23} /></div>
    {billed ? <div className="verified-card"><div className="verified-head"><ShieldCheck size={23} /><div><span>Bill generated</span><h3>{money(billed.total)}</h3></div></div><p className="hint">Token marked used. The token fee was deducted from your wallet.</p><button className="primary-button full" onClick={() => setBilled(null)}>Scan another token</button></div> : <>
      <div className="camera-placeholder"><Camera size={35} /><b>Camera preview</b><span>Point at the customer QR</span></div>
      <div className="or-divider"><span>or enter 6-digit OTP</span></div>
      <div className="otp-input"><Ticket size={18} /><input value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="000000" inputMode="numeric" /></div>
      {checking && <p className="hint" style={{ marginTop: 12 }}>Checking token...</p>}
      {problem && <div className="invalid-card"><X size={20} /><div><b>{problem === 'expired' ? 'Token expired' : problem === 'error' ? 'Could not check this token' : 'Invalid token'}</b><p>{problem === 'expired' ? 'This token passed its expiry time. Ask the customer to reserve again.' : problem === 'error' ? 'Check your connection and try again.' : `No active token with this code for ${shop.name}. It may be used, cancelled, expired, or belong to another shop.`}</p></div></div>}
      {token && <div className="verified-card"><div className="verified-head"><ShieldCheck size={23} /><div><span>Verified token</span><h3>{shop.name}</h3></div></div>{token.items.map((item, index) => <div className="verified-item" key={item.offer?.id ?? index}><span>{item.product?.name ?? 'Item'} · {item.size ?? 'Standard'}</span><b>{item.quantity}</b></div>)}<div className="total-line"><span>Total (app price)</span><b>{money(token.total)}</b></div><button className="primary-button full" disabled={busy} onClick={generateBill}>{busy ? 'Generating...' : 'Generate bill'} <CreditCard size={16} /></button></div>}
    </>}
  </div>;
}
function WalletView({ shop, notify }: { shop: Shop; notify: (message: string) => void }) { return <div className="page"><div className="page-heading"><div><span className="eyebrow">Merchant wallet</span><h1>Keep selling</h1></div><WalletCards size={23} /></div><div className="wallet-card"><span>Available balance</span><strong>₹{shop.wallet_balance ?? 500}</strong><p>Prepaid token fees are deducted here.</p><button className="white-button" onClick={() => notify('Top-up simulated via UPI')}>Top up via UPI <Plus size={15} /></button></div><div className="ledger"><h3>Recent activity</h3><div><div className="ledger-icon green"><Plus size={15} /></div><span><b>Wallet top-up</b><small>Today, 10:12 am</small></span><strong className="positive">+₹500</strong></div><div><div className="ledger-icon orange"><Ticket size={15} /></div><span><b>Token fee</b><small>Yesterday, 4:45 pm</small></span><strong>−₹10</strong></div></div></div>; }
function RadarView() {
  // Curated festival calendar (pilot decision: human-curated, not scraped). Dates per published panchang lists; regional dates can differ by a day.
  const FESTIVALS = [
    { name: 'Tulsi Vivah · wedding season starts', date: '2026-11-21', region: 'Pan-India', tip: 'Shaadi season opens. Stock kurtis, sarees, dupattas and return-gift boxes.' },
    { name: 'Dev Diwali (Kartik Purnima)', date: '2026-11-24', region: 'Pan-India', tip: 'Diyas, LED lights, brass puja items and thalis.' },
    { name: 'Early-December wedding dates', date: '2026-12-02', region: 'Dates vary by city', tip: 'Busiest window for ethnic wear, shawls and gifting sets.' },
    { name: 'Champa Shashti', date: '2026-12-15', region: 'Maharashtra', tip: 'Local puja items and festive wear.' },
    { name: 'Datta Jayanti', date: '2026-12-23', region: 'Maharashtra, Gujarat', tip: 'Puja items, brass and flowers.' },
    { name: 'Christmas', date: '2026-12-25', region: 'Pan-India', tip: 'Gifting, decor lights and party wear.' },
    { name: 'Lohri / Makar Sankranti', date: '2027-01-14', region: 'Pan-India', tip: 'Gifting sets and winter wear such as shawls.' },
  ];
  const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0);
  const daysUntil = (date: string) => Math.round((new Date(`${date}T00:00:00`).getTime() - startOfToday.getTime()) / 86400000);
  const upcoming = FESTIVALS.map((festival) => ({ ...festival, days: daysUntil(festival.date) })).filter((festival) => festival.days >= 0).sort((a, b) => a.days - b.days);
  const inWindow = (days: number) => days <= 20;
  const when = (days: number) => days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : `in ${days} days`;
  const next = upcoming[0];
  return <div className="page"><div className="page-heading"><div><span className="eyebrow">{DEMO_CITY} pulse</span><h1>Trend Radar</h1></div><Flame size={23} /></div>
    {next ? <div className="radar-hero"><span>Next demand window · curated calendar</span><h2>{next.name}</h2><div className="radar-line"><span style={{ width: `${Math.max(8, Math.min(100, ((20 - next.days) / 20) * 100))}%` }} /></div><p>{when(next.days)} · {next.region} · {next.tip}</p></div> : <div className="radar-hero"><span>Curated calendar</span><h2>No upcoming festival listed</h2><p>The festival calendar needs to be updated for the next season.</p></div>}
    <h3 className="list-title">Festival forecast</h3>
    {upcoming.length === 0 && <div className="empty-card"><h3>Nothing upcoming</h3><p>Add the next festivals to the calendar.</p></div>}
    {upcoming.map((festival) => <div key={festival.name}><div className="forecast-card"><div><span className={`festival-dot ${inWindow(festival.days) ? 'red' : 'amber'}`} /><b>{festival.name}</b></div><span>{when(festival.days)}</span><strong>{inWindow(festival.days) ? 'Stock now' : 'Plan ahead'}</strong></div><p className="hint" style={{ margin: '-2px 4px 12px' }}>{festival.region} · {festival.tip}</p></div>)}
    <h3 className="list-title">Live waitlist · Demo data</h3><div className="waitlist-row"><span>Cotton Blue Kurti</span><b>14 people waiting</b></div><div className="waitlist-row"><span>Kanya Pujan Kit Pro</span><b>8 people waiting</b></div>
    <p className="hint" style={{ marginTop: 12 }}>Suggested stock is a curated guide. Festival dates follow published panchang lists and can differ by a day in your city.</p>
  </div>;
}
function ProfileView({ onSignOut, setView, demoSession, userId, onSwitchDemo }: { onSignOut: () => void; setView: (view: View) => void; demoSession: boolean; userId: string; onSwitchDemo: (role: Role) => void }) {
  const [reliability, setReliability] = useState<Reliability | null>(null);
  useEffect(() => { supabase.rpc('expire_my_tokens').then(() => undefined); supabase.from('profiles').select('no_show_count, free_tokens_disabled_until').eq('id', userId).maybeSingle().then(({ data }) => { if (data) setReliability(data as Reliability); }); }, [userId]);
  const paused = reliability && reliability.free_tokens_disabled_until && new Date(reliability.free_tokens_disabled_until) > new Date();
  return <div className="page">{paused && <div className="empty-card"><ShieldCheck size={22} /><h3>Free tokens paused</h3><p>You missed 3 pickups, so free tokens are paused for 24 hours. You can still shop with delivery.</p></div>}<div className="profile-hero"><div className="profile-avatar">AS</div><h1>Aarohi Sharma</h1><p>Shopping in {DEMO_CITY}</p><div className="reliability"><ShieldCheck size={17} /><div><b>{paused ? 'Free tokens paused' : 'Great reliability'}</b><span>{paused ? 'Resumes after the 24-hour pause' : `${reliability?.no_show_count ?? 0} missed pickups · Free tokens enabled`}</span></div></div></div><div className="profile-list"><button onClick={() => setView('tokens')}><Ticket size={18} /><span>My tokens</span><ChevronRight size={17} /></button><button onClick={() => setView('orders')}><Truck size={18} /><span>Delivery orders</span><ChevronRight size={17} /></button><button onClick={() => setView('returns')}><RefreshCw size={18} /><span>Returns & exchanges</span><ChevronRight size={17} /></button><button onClick={() => setView('about')}><BookOpen size={18} /><span>About this prototype</span><ChevronRight size={17} /></button></div>{demoSession && <button className="outline-button full" style={{ marginTop: 16 }} onClick={() => onSwitchDemo('merchant')}><RefreshCw size={16} /> Switch to demo shopkeeper</button>}<button className="signout-button" onClick={onSignOut}>Sign out</button></div>;
}
function MoreView({ shop, setView, demoSession, onSwitchDemo, onSignOut }: { shop: Shop; setView: (view: View) => void; demoSession: boolean; onSwitchDemo: (role: Role) => void; onSignOut: () => void }) {
  return <div className="page"><div className="page-heading"><div><span className="eyebrow">{shop.name}</span><h1>More tools</h1></div><Menu size={23} /></div><div className="profile-list"><button onClick={() => setView('inventory')}><PackageCheck size={18} /><span>My items & stock</span><ChevronRight size={17} /></button><button onClick={() => setView('pricing')}><Tag size={18} /><span>Pricing & stock</span><ChevronRight size={17} /></button><button onClick={() => setView('catalog')}><Upload size={18} /><span>Upload catalog</span><ChevronRight size={17} /></button><button onClick={() => setView('kits')}><Crown size={18} /><span>Festival kits</span><ChevronRight size={17} /></button><button onClick={() => setView('merchant-orders')}><Truck size={18} /><span>Delivery orders</span><ChevronRight size={17} /></button><button onClick={() => setView('earnings')}><WalletCards size={18} /><span>Earnings summary</span><ChevronRight size={17} /></button><button onClick={() => setView('wallet')}><WalletCards size={18} /><span>Wallet & ledger</span><ChevronRight size={17} /></button><button onClick={() => setView('about')}><BookOpen size={18} /><span>About this prototype</span><ChevronRight size={17} /></button></div>{demoSession && <button className="outline-button full" style={{ marginTop: 16 }} onClick={() => onSwitchDemo('customer')}><RefreshCw size={16} /> Switch to demo customer</button>}<button className="signout-button" onClick={onSignOut}>Sign out</button></div>;
}

function PricingView({ shop, products, offers, notify }: { shop: Shop; products: Product[]; offers: Offer[]; notify: (message: string, tone?: Toast['tone']) => void }) {
  const [editing, setEditing] = useState<string | null>(null);
  const [priceInput, setPriceInput] = useState(''); const [mrpInput, setMrpInput] = useState(''); const [stockInput, setStockInput] = useState<Record<string, string>>({}); const [busy, setBusy] = useState(false);
  const shopOffers = offers.filter((item) => item.shop === shop.id);
  async function save(offer: Offer) {
    setBusy(true);
    const newPrice = Number(priceInput) || offer.price;
    const newMrp = mrpInput === '' ? offer.mrp : Number(mrpInput) || null;
    if (newMrp !== null && newPrice > newMrp) { notify('App price must be equal to or lower than MRP.', 'error'); setBusy(false); return; }
    const newStock: Record<string, number> = {};
    for (const key of Object.keys(offer.stock)) { const val = Number(stockInput[key]); newStock[key] = isNaN(val) ? offer.stock[key] : val; }
    const result = await supabase.from('offers').update({ price: newPrice, mrp: newMrp, stock: newStock }).eq('id', offer.id);
    if (result.error) { notify('Could not save changes.', 'error'); setBusy(false); return; }
    notify('Pricing and stock updated.'); setEditing(null); setBusy(false);
  }
  return <div className="page"><div className="page-heading"><div><span className="eyebrow">Pricing & stock</span><h1>Your offers</h1></div><Tag size={23} /></div>{shopOffers.length === 0 ? <div className="empty-card"><Tag size={28} /><h3>No offers yet</h3><p>Upload a catalog or set prices for your products.</p></div> : shopOffers.map((offer) => { const product = products.find((p) => p.id === offer.product); if (!product) return null; const fee = tokenFee(product.category, offer.price); const isEditing = editing === offer.id; return <article className="request-card" key={offer.id}><div className="request-item"><ImageThumb slug={product.slug} url={product.image_url} small /><div><b>{product.name}</b><p>{product.category}{offer.mrp ? ` · MRP ${money(offer.mrp)}` : ''}</p></div></div>{!isEditing ? <><div className="price-line"><b>{money(offer.price)}</b>{offer.mrp && <del>{money(offer.mrp)}</del>}</div><div className="chip-row">{product.has_sizes ? Object.entries(offer.stock).map(([size, qty]) => <span className="chip navy-chip" key={size}>{size}: {qty}</span>) : <span className="chip navy-chip">Stock: {offer.stock.quantity}</span>}</div><div className="token-actions"><button onClick={() => { setEditing(offer.id); setPriceInput(String(offer.price)); setMrpInput(offer.mrp ? String(offer.mrp) : ''); setStockInput({}); }}><Pencil size={15} /> Edit</button></div><p className="hint">Token fee: {money(fee)} · Net to you: {money(offer.price - fee)}</p></> : <><label>App price<input type="number" value={priceInput} onChange={(e) => setPriceInput(e.target.value)} /></label>{product.has_sizes ? Object.keys(offer.stock).map((size) => <label key={size}>Stock {size}<input type="number" value={stockInput[size] ?? String(offer.stock[size])} onChange={(e) => setStockInput((s) => ({ ...s, [size]: e.target.value }))} /></label>) : <label>Stock<input type="number" value={stockInput.quantity ?? String(offer.stock.quantity)} onChange={(e) => setStockInput((s) => ({ ...s, quantity: e.target.value }))} /></label>}<p className="hint">Token fee: {money(tokenFee(product.category, Number(priceInput) || offer.price))} · Net: {money((Number(priceInput) || offer.price) - tokenFee(product.category, Number(priceInput) || offer.price))}</p><div className="token-actions"><button className="primary-button" disabled={busy} onClick={() => save(offer)}>Save</button><button className="ghost-button" onClick={() => setEditing(null)}>Cancel</button></div></>}</article>; })}</div>;
}

type ParsedItem = {
  name: string | null; anchor_text: string | null; description: string | null; category: string | null;
  material_or_quality: string | null; color: string | null; price: number | null; mrp: number | null;
  sizes: { size: string; quantity: number }[] | null; quantity: number | null;
  position: number | null; page: number;
  photo_box: [number, number, number, number] | null;
  image_url?: string | null;
};
type ExtractedPhoto = { base64: string; y: number; x: number; width: number; height: number };
type ReviewItem = ParsedItem & { checked: boolean; photoDebug?: string };
const sampleParsedItems: ParsedItem[] = [
  { name: 'Cotton Blue Kurti', description: 'Cotton kurti in blue', category: 'fashion', material_or_quality: 'pure cotton', color: 'blue', price: 449, mrp: 599, sizes: [{ size: 'S', quantity: 5 }, { size: 'M', quantity: 3 }, { size: 'L', quantity: 2 }], quantity: null, position: 0, page: 0 },
  { name: 'Chikankari White Kurti', description: 'Embroidered white kurti', category: 'fashion', material_or_quality: 'cotton', color: 'white', price: 459, mrp: 599, sizes: [{ size: 'S', quantity: 2 }, { size: 'M', quantity: 4 }, { size: 'L', quantity: 3 }], quantity: null, position: 1, page: 0 },
  { name: 'LED Diya Lights 12', description: 'Set of 12 LED diyas', category: 'decor', material_or_quality: 'plastic', color: 'multicolor', price: 349, mrp: 449, sizes: null, quantity: 20, position: 2, page: 0 },
  { name: 'Steel Katori Set', description: 'Stainless steel katori set', category: 'home', material_or_quality: 'steel', color: 'silver', price: 225, mrp: 299, sizes: null, quantity: 15, position: 3, page: 0 },
  { name: 'Pipe Cleaner Flower Kit', description: 'DIY pipe cleaner craft kit', category: 'gifts', material_or_quality: 'pipe cleaner', color: 'multicolor', price: 260, mrp: 320, sizes: null, quantity: 8, position: 4, page: 0 },
  { name: 'Cotton Dupatta', description: 'Mustard cotton dupatta', category: 'fashion', material_or_quality: 'cotton', color: 'mustard', price: 299, mrp: 399, sizes: null, quantity: 12, position: 5, page: 0 },
];

function slugify(name: string) { return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }

function CatalogUploadView({ shop, products, notify, onApproved, userId }: { shop: Shop; products: Product[]; notify: (message: string, tone?: Toast['tone']) => void; onApproved: () => Promise<void>; userId: string }) {
  const [stage, setStage] = useState<'upload' | 'reading' | 'review'>('upload');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [fallback, setFallback] = useState(false);
  const [fallbackReason, setFallbackReason] = useState('');
  const [reviewItems, setReviewItems] = useState<ReviewItem[]>([]);

  function resizeCanvas(canvas: HTMLCanvasElement, maxSide = 1600): HTMLCanvasElement {
    const longest = Math.max(canvas.width, canvas.height);
    if (longest <= maxSide) return canvas;
    const scale = maxSide / longest;
    const out = document.createElement('canvas');
    out.width = Math.round(canvas.width * scale);
    out.height = Math.round(canvas.height * scale);
    const ctx = out.getContext('2d')!;
    ctx.drawImage(canvas, 0, 0, out.width, out.height);
    return out;
  }

  async function uploadBlob(blob: Blob, shopId: string, n: number): Promise<string | null> {
    const path = `${shopId}/${Date.now()}-${n}.jpg`;
    const result = await supabase.storage.from('catalog-images').upload(path, blob, { contentType: 'image/jpeg', upsert: false });
    if (result.error) return null;
    const { data } = supabase.storage.from('catalog-images').getPublicUrl(path);
    return data.publicUrl;
  }

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setStage('reading'); setBusy(true); setFallback(false); setProgress('Reading your catalog…');
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token ?? '';

      if (file.type === 'application/pdf') {
        const pdfjs = await import('pdfjs-dist');
        pdfjs.GlobalWorkerOptions.workerSrc = await import('pdfjs-dist/build/pdf.worker.mjs?url').then((m) => m.default);
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
        const maxPages = Math.min(pdf.numPages, 6);
        const allParsed: ParsedItem[] = [];
        const allReviewItems: ReviewItem[] = [];
        let photoN = 0;
        for (let i = 1; i <= maxPages; i++) {
          setProgress(`Reading page ${i} of ${maxPages}…`);
          const page = await pdf.getPage(i);
          const { canvas, boxes, texts } = await readPage(pdfjs, page, 2);
          // Image for AI
          const resized = resizeCanvas(canvas);
          const pageImage = resized.toDataURL('image/jpeg', 0.75).split(',')[1];
          // Text for AI
          const textLayer = texts.map((t: TextItem) => t.str).join(' ').replace(/ +/g, ' ').trim();

          setProgress(`Analyzing page ${i} of ${maxPages} with AI…`);
          const response = await fetch(`${supabaseUrl}/functions/v1/parse-catalog`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
            body: JSON.stringify({ images: [pageImage], page: i - 1, text: textLayer || undefined }),
          });
          if (!response.ok) {
            const errBody = await response.json().catch(() => ({}));
            throw new Error(errBody.error || `HTTP ${response.status}`);
          }
          const result = await response.json();
          const pageItems: ParsedItem[] = result.items ?? [];

          // Match photos
          const anchors = pageItems.map((item) => item.anchor_text || item.name || '');
          const matched = matchPhotos(anchors, boxes, texts);

          for (let j = 0; j < pageItems.length; j++) {
            const item = pageItems[j];
            let photoDebug = `Photo not found: ${boxes.length} images on page ${i}`;
            const boxIdx = matched[j];
            if (boxIdx >= 0 && boxIdx < boxes.length) {
              try {
                const blob = await cropToBlob(canvas, boxes[boxIdx]);
                const url = await uploadBlob(blob, shop.id, photoN++);
                if (url) {
                  item.image_url = url;
                  photoDebug = `Photo: box ${boxIdx + 1} of ${boxes.length}, page ${i}`;
                }
              } catch { /* crop failed */ }
            }
            if (!item.image_url && item.photo_box) {
              // Fallback: crop the photo_box region from the page canvas
              try {
                const [ymin, xmin, ymax, xmax] = item.photo_box;
                const sw = ((xmax - xmin) / 1000) * canvas.width;
                const sh = ((ymax - ymin) / 1000) * canvas.height;
                const sx = (xmin / 1000) * canvas.width;
                const sy = (ymin / 1000) * canvas.height;
                const cropCanvas = document.createElement('canvas');
                cropCanvas.width = Math.max(1, Math.round(sw));
                cropCanvas.height = Math.max(1, Math.round(sh));
                const cctx = cropCanvas.getContext('2d')!;
                cctx.drawImage(canvas, sx, sy, sw, sh, 0, 0, cropCanvas.width, cropCanvas.height);
                const blob = await new Promise<Blob>((res, rej) => cropCanvas.toBlob((b) => b ? res(b) : rej(new Error('crop')), 'image/jpeg', 0.85));
                const url = await uploadBlob(blob, shop.id, photoN++);
                if (url) {
                  item.image_url = url;
                  photoDebug = `Photo: box region, page ${i}`;
                }
              } catch { /* fallback crop failed */ }
            }
            allReviewItems.push({ ...item, checked: true, photoDebug });
          }
          allParsed.push(...pageItems);
        }
        if (!allParsed.length) throw new Error('No products found');
        setReviewItems(allReviewItems);
        setStage('review');
      } else {
        // Image file — single page, no embedded photos
        const img = await new Promise<HTMLImageElement>((resolve, reject) => {
          const url = URL.createObjectURL(file);
          const i = new Image();
          i.onload = () => { resolve(i); URL.revokeObjectURL(url); };
          i.onerror = reject;
          i.src = url;
        });
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0);
        const resized = resizeCanvas(canvas);
        const pageImage = resized.toDataURL('image/jpeg', 0.75).split(',')[1];

        setProgress('Analyzing page 1 of 1 with AI…');
        const response = await fetch(`${supabaseUrl}/functions/v1/parse-catalog`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
          body: JSON.stringify({ images: [pageImage], page: 0 }),
        });
        if (!response.ok) {
          const errBody = await response.json().catch(() => ({}));
          throw new Error(errBody.error || `HTTP ${response.status}`);
        }
        const result = await response.json();
        const pageItems: ParsedItem[] = result.items ?? [];
        if (!pageItems.length) throw new Error('No products found');
        // No embedded image boxes for a plain image file — try photo_box fallback
        const reviewItems: ReviewItem[] = [];
        let photoN = 0;
        for (let j = 0; j < pageItems.length; j++) {
          const item = pageItems[j];
          let photoDebug = `Photo not found: 0 images on page 1`;
          if (item.photo_box) {
            try {
              const [ymin, xmin, ymax, xmax] = item.photo_box;
              const sw = ((xmax - xmin) / 1000) * resized.width;
              const sh = ((ymax - ymin) / 1000) * resized.height;
              const sx = (xmin / 1000) * resized.width;
              const sy = (ymin / 1000) * resized.height;
              const cropCanvas = document.createElement('canvas');
              cropCanvas.width = Math.max(1, Math.round(sw));
              cropCanvas.height = Math.max(1, Math.round(sh));
              const cctx = cropCanvas.getContext('2d')!;
              cctx.drawImage(resized, sx, sy, sw, sh, 0, 0, cropCanvas.width, cropCanvas.height);
              const blob = await new Promise<Blob>((res, rej) => cropCanvas.toBlob((b) => b ? res(b) : rej(new Error('crop')), 'image/jpeg', 0.85));
              const url = await uploadBlob(blob, shop.id, photoN++);
              if (url) { item.image_url = url; photoDebug = 'Photo: box region, page 1'; }
            } catch { /* crop failed */ }
          }
          reviewItems.push({ ...item, checked: true, photoDebug });
        }
        setReviewItems(reviewItems);
        setStage('review');
      }
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      setFallbackReason(reason);
      setFallback(true);
      setReviewItems(sampleParsedItems.map((item) => ({ ...item, checked: true, photoDebug: 'Sample data' })));
      setStage('review');
      notify('AI reading is unavailable, showing sample data.', 'error');
    } finally {
      setBusy(false); setProgress('');
    }
  }

  function needsReview(item: ReviewItem): boolean {
    return item.name == null || item.name.trim() === '' || item.price == null || item.mrp == null;
  }
  function canApproveItem(item: ReviewItem): boolean {
    return item.price != null && item.mrp != null && item.name != null && item.name.trim() !== '';
  }

  async function approve() {
    setBusy(true);
    const selected = reviewItems.filter((item) => item.checked && canApproveItem(item));
    let added = 0; let updated = 0; let failed = 0;
    for (const item of selected) {
      try {
        const slug = slugify(item.name!);
        const hasSizes = !!(item.sizes && item.sizes.length > 0);
        const stock: Record<string, number> = {};
        if (hasSizes && item.sizes) { for (const s of item.sizes) { stock[s.size] = s.quantity; } }
        else { stock.quantity = item.quantity ?? 0; }

        // Try to find existing product by slug (client-side cache)
        let product = products.find((p) => p.slug === slug);

        if (!product) {
          // Query the server in case another shop created it
          const found = await supabase.from('products').select('*').eq('slug', slug).maybeSingle();
          if (found.data) product = found.data as Product;
        }

        if (!product) {
          // Insert new product
          const ins = await supabase.from('products').insert({ slug, name: item.name!, category: (item.category ?? 'other').charAt(0).toUpperCase() + (item.category ?? 'other').slice(1), has_sizes: hasSizes, description: item.description, material: item.material_or_quality, color: item.color, image_url: item.image_url }).select().maybeSingle();
          if (ins.error) { console.error('product insert', ins.error.message); failed++; continue; }
          product = ins.data as Product;
        } else {
          // Reuse existing product — fill empty fields only
          const patch: Record<string, unknown> = {};
          if (!product.image_url && item.image_url) patch.image_url = item.image_url;
          if (!product.description && item.description) patch.description = item.description;
          if (!product.material && item.material_or_quality) patch.material = item.material_or_quality;
          if (!product.color && item.color) patch.color = item.color;
          if (Object.keys(patch).length > 0) {
            await supabase.from('products').update(patch).eq('id', product.id);
          }
        }
        if (!product) { failed++; continue; }

        // Upsert offer with onConflict (shop, product)
        const off = await supabase.from('offers').upsert(
          { shop: shop.id, product: product.id, price: item.price!, mrp: item.mrp, stock },
          { onConflict: 'shop,product' },
        );
        if (off.error) { console.error('offer upsert', off.error.message); failed++; continue; }

        // Check if offer already existed (by querying before — simple heuristic: if product was in our list already, it likely existed)
        const existing = products.find((p) => p.slug === slug);
        if (existing) updated++; else added++;
      } catch (e) {
        console.error('approve item', e);
        failed++;
      }
    }

    await onApproved();
    const parts: string[] = [];
    if (added) parts.push(`${added} added`);
    if (updated) parts.push(`${updated} updated`);
    if (failed) parts.push(`${failed} failed`);
    const msg = parts.length ? parts.join(', ') : 'Nothing to approve';
    const tone: Toast['tone'] = failed > 0 && added + updated > 0 ? 'error' : failed > 0 ? 'error' : undefined;
    notify(msg, tone);
    setStage('upload'); setReviewItems([]); setFallback(false); setFallbackReason(''); setBusy(false);
  }

  function updateItem(index: number, patch: Partial<ReviewItem>) {
    setReviewItems((arr) => arr.map((it, i) => i === index ? { ...it, ...patch } : it));
  }

  return <div className="page"><div className="page-heading"><div><span className="eyebrow">Catalog upload</span><h1>Upload bill</h1></div><Upload size={23} /></div>{stage === 'upload' && <div className="empty-card"><Upload size={28} /><h3>Upload a wholesaler catalog</h3><p>Upload a PDF (up to 6 pages) or an image. AI will read every product on the page.</p><label className="primary-button"><Upload size={16} /> Choose file<input type="file" accept="image/*,application/pdf" hidden onChange={(e) => handleFile(e.target.files?.[0])} /></label></div>}{stage === 'reading' && <div className="empty-card"><RefreshCw size={28} className="spin" /><h3>Reading your catalog…</h3><p>{progress || 'This takes a moment.'}</p></div>}{stage === 'review' && <>{fallback && <div className="empty-card"><ShieldCheck size={22} /><h3>AI reading is unavailable, showing sample data</h3><p>{fallbackReason || 'The AI service could not be reached.'}</p><p className="hint">You can still edit and approve these sample items.</p></div>}<p className="hint">Review the parsed items. Items marked "Needs review" have missing fields. Enter a price and MRP before approving.</p>{reviewItems.map((item, index) => { const needs = needsReview(item); const canApprove = canApproveItem(item); return <article className="catalog-review-card" key={index}><div className="catalog-review-head"><input type="checkbox" checked={item.checked} onChange={(e) => updateItem(index, { checked: e.target.checked })} /><b>{item.name ?? 'Unnamed product'}</b>{needs ? <span className="chip orange-chip">Needs review</span> : <span className="chip green-chip">Confident</span>}</div><div className="catalog-review-body"><div className="catalog-review-photo">{item.image_url ? <div className="image-thumb"><img src={item.image_url} alt="" /></div> : <div className="image-thumb photo-not-found"><PackageCheck size={28} /><span>Photo not found</span></div>}<p className="photo-debug">{item.photoDebug ?? ''}</p></div><div className="catalog-review-fields"><div className="field-cell"><label>Name{item.name == null && <span className="chip orange-chip">Required</span>}<input value={item.name ?? ''} onChange={(e) => updateItem(index, { name: e.target.value })} /></label></div><div className="field-cell"><label>Category<select value={item.category ?? 'other'} onChange={(e) => updateItem(index, { category: e.target.value })}><option value="fashion">Fashion</option><option value="decor">Decor</option><option value="electronics">Electronics</option><option value="home">Home</option><option value="beauty">Beauty</option><option value="gifts">Gifts</option><option value="other">Other</option></select></label></div><div className="field-cell"><label>Material or quality<input value={item.material_or_quality ?? ''} onChange={(e) => updateItem(index, { material_or_quality: e.target.value })} /></label></div><div className="field-cell"><label>Color<input value={item.color ?? ''} onChange={(e) => updateItem(index, { color: e.target.value })} /></label></div><div className="field-cell"><label>Price (Rs){item.price == null && <span className="chip orange-chip">Required</span>}<input type="number" value={item.price ?? ''} onChange={(e) => updateItem(index, { price: e.target.value ? Number(e.target.value) : null })} /></label></div><div className="field-cell"><label>MRP (Rs){item.mrp == null && <span className="chip orange-chip">Required</span>}<input type="number" value={item.mrp ?? ''} onChange={(e) => updateItem(index, { mrp: e.target.value ? Number(e.target.value) : null })} /></label></div>{item.sizes && item.sizes.length > 0 ? <div className="field-cell sizes-cell"><label>Sizes{item.sizes.map((s, si) => <span className="size-chip" key={si}>{s.size}<input type="number" value={s.quantity} onChange={(e) => updateItem(index, { sizes: item.sizes!.map((sz, j) => j === si ? { ...sz, quantity: Number(e.target.value) } : sz) })} /></span>)}</label></div> : <div className="field-cell"><label>Quantity<input type="number" value={item.quantity ?? ''} onChange={(e) => updateItem(index, { quantity: e.target.value ? Number(e.target.value) : null })} /></label></div>}<div className="field-cell full-width"><label>Description<input value={item.description ?? ''} onChange={(e) => updateItem(index, { description: e.target.value })} /></label></div></div></div>{item.checked && !canApprove && <p className="hint" style={{ color: 'var(--orange)' }}>Enter a name, price and MRP to approve this item.</p>}</article>; })}<button className="primary-button full" disabled={busy || reviewItems.filter((item) => item.checked && canApproveItem(item)).length === 0} onClick={approve}>{busy ? 'Creating…' : `Approve ${reviewItems.filter((item) => item.checked && canApproveItem(item)).length} items`}</button></>}</div>;
}

function KitsView({ shop, products, notify }: { shop: Shop; products: Product[]; notify: (message: string, tone?: Toast['tone']) => void }) {
  const [kits, setKits] = useState<FestivalKit[]>([]); const [loading, setLoading] = useState(true);
  const [name, setName] = useState(''); const [tier, setTier] = useState<'basic' | 'pro'>('basic'); const [price, setPrice] = useState(''); const [count, setCount] = useState(''); const [busy, setBusy] = useState(false);
  useEffect(() => { let active = true; supabase.from('festival_kits').select('*').eq('shop', shop.id).order('created_at', { ascending: false }).then(({ data }) => { if (active) { setKits((data ?? []) as FestivalKit[]); setLoading(false); } }); return () => { active = false; }; }, [shop.id]);
  async function create(event: React.FormEvent<HTMLFormElement>) { event.preventDefault(); setBusy(true); const kitProduct = products.find((p) => p.slug === tier === 'basic' ? 'kanya-pujan-kit-basic' : 'kanya-pujan-kit-pro'); const result = await supabase.from('festival_kits').insert({ shop: shop.id, product: kitProduct?.id ?? null, name, tier, price: Number(price), count: Number(count) }).select().maybeSingle(); if (result.error) { notify('Could not create the kit.', 'error'); setBusy(false); return; } if (result.data) setKits((arr) => [result.data as FestivalKit, ...arr]); setName(''); setPrice(''); setCount(''); notify('Kit created.'); setBusy(false); }
  return <div className="page"><div className="page-heading"><div><span className="eyebrow">Festival kits</span><h1>Pre-packed kits</h1></div><Crown size={23} /></div><form className="auth-form" onSubmit={create}><label>Kit name<input value={name} onChange={(e) => setName(e.target.value)} required /></label><label>Tier<select value={tier} onChange={(e) => setTier(e.target.value as 'basic' | 'pro')}><option value="basic">Basic</option><option value="pro">Pro</option></select></label><label>Price (Rs)<input type="number" value={price} onChange={(e) => setPrice(e.target.value)} required /></label><label>Count<input type="number" value={count} onChange={(e) => setCount(e.target.value)} required /></label><button className="primary-button" disabled={busy}>Create kit</button></form>{loading ? <p className="hint">Loading kits…</p> : kits.length === 0 ? <div className="empty-card"><Crown size={28} /><h3>No kits yet</h3><p>Create a pre-packed festival kit to sell.</p></div> : kits.map((kit) => <article className="bulk-card" key={kit.id}><div className="bulk-icon"><Crown size={19} /></div><div><span className="chip green-chip">Auto-approved</span><h3>{kit.name} · {kit.tier === 'pro' ? 'Pro' : 'Basic'}</h3><p>{money(kit.price)} · {kit.count > 0 ? `${kit.count} in stock` : 'Sold out'}</p></div>{kit.count <= 0 && <span className="chip orange-chip">Sold out</span>}</article>)}</div>;
}

function MerchantOrdersView({ shop, notify }: { shop: Shop; notify: (message: string, tone?: Toast['tone']) => void }) {
  const [orders, setOrders] = useState<MerchantOrder[]>([]); const [loading, setLoading] = useState(true);
  useEffect(() => { let active = true; supabase.from('orders').select('*').eq('shop', shop.id).order('created_at', { ascending: false }).then(({ data }) => { if (active) { setOrders((data ?? []) as MerchantOrder[]); setLoading(false); } }); return () => { active = false; }; }, [shop.id]);
  async function advance(order: MerchantOrder) { const next: Record<MerchantOrder['status'], MerchantOrder['status']> = { placed: 'confirmed', confirmed: 'out_for_delivery', out_for_delivery: 'delivered', delivered: 'delivered', returned: 'returned' }; const status = next[order.status]; if (status === order.status) return; const result = await supabase.from('orders').update({ status }).eq('id', order.id); if (result.error) { notify('Could not update the order.', 'error'); return; } setOrders((arr) => arr.map((o) => o.id === order.id ? { ...o, status } : o)); notify('Order marked as ' + status.replace(/_/g, ' ') + '.'); }
  if (loading) return <div className="page"><div className="empty-card"><p>Loading orders…</p></div></div>;
  return <div className="page"><div className="page-heading"><div><span className="eyebrow">Delivery handoff</span><h1>Delivery orders</h1></div><Truck size={23} /></div>{orders.length === 0 ? <div className="empty-card"><Truck size={30} /><h3>No delivery orders</h3><p>When customers choose home delivery, orders appear here.</p></div> : orders.map((order) => { const step = order.status === 'confirmed' ? 1 : order.status === 'out_for_delivery' ? 2 : order.status === 'delivered' ? 3 : 0; return <article className="request-card" key={order.id}><div className="request-meta"><span className="chip orange-chip">{order.status === 'confirmed' ? 'Packed' : order.status.replace(/_/g, ' ')}</span><span>{new Date(order.created_at).toLocaleDateString('en-IN')}</span></div><div className="request-customer"><div><b>{order.delivery_name ?? 'Customer'}</b><p>{money(order.total)} + {money(order.delivery_fee)} delivery · {order.payment_method?.toUpperCase() ?? 'Payment'}</p>{order.delivery_address && <p>{order.delivery_address}, {order.delivery_pin}</p>}</div></div><div className="chip-row">{['Placed', 'Packed', 'Out for delivery', 'Delivered'].map((label, i) => <span className={`chip ${i <= step ? 'green-chip' : 'navy-chip'}`} key={label}>{label}</span>)}</div>{order.status !== 'delivered' && <button className="primary-button" onClick={() => advance(order)}>Mark next status</button>}</article>; })}</div>;
}

function EarningsView({ shop, notify }: { shop: Shop; notify: (message: string, tone?: Toast['tone']) => void }) {
  const [bills, setBills] = useState<BillRecord[]>([]); const [ledger, setLedger] = useState<{ id: string; type: string; amount: number; note: string; created_at: string }[]>([]); const [loading, setLoading] = useState(true);
  useEffect(() => { let active = true; Promise.all([supabase.from('bills').select('*').eq('shop', shop.id).order('created_at', { ascending: false }), supabase.from('wallet_ledger').select('*').eq('shop', shop.id).order('created_at', { ascending: false })]).then(([billsRes, ledgerRes]) => { if (active) { setBills((billsRes.data ?? []) as BillRecord[]); setLedger((ledgerRes.data ?? []) as { id: string; type: string; amount: number; note: string; created_at: string }[]); setLoading(false); } }); return () => { active = false; }; }, [shop.id]);
  const weekAgo = Date.now() - 7 * 86400000;
  const weekBills = bills.filter((b) => new Date(b.created_at).getTime() > weekAgo);
  const tokensRedeemed = weekBills.length;
  const itemsBilled = weekBills.reduce((sum, b) => sum + (Array.isArray(b.items) ? b.items.length : 0), 0);
  const feesPaid = ledger.filter((l) => l.type === 'fee' && new Date(l.created_at).getTime() > weekAgo).reduce((sum, l) => sum + Number(l.amount), 0);
  return <div className="page"><div className="page-heading"><div><span className="eyebrow">Earnings</span><h1>Weekly summary</h1></div><WalletCards size={23} /></div>{loading ? <div className="empty-card"><p>Loading earnings…</p></div> : <><div className="merchant-stats"><div><b>{tokensRedeemed}</b><span>Tokens redeemed</span></div><div><b>{itemsBilled}</b><span>Items billed</span></div><div><b>{money(feesPaid)}</b><span>Fees paid</span></div></div><div className="ledger"><h3>Recent bills</h3>{weekBills.length === 0 ? <p className="hint">No bills this week yet.</p> : weekBills.map((bill) => <div key={bill.id}><span><b>Bill {bill.token.slice(0, 8)}</b><small>{new Date(bill.created_at).toLocaleDateString('en-IN')}</small></span><strong>{money(bill.total)} · fee {money(bill.fee)}</strong></div>)}</div><div className="ledger"><h3>Wallet activity</h3>{ledger.length === 0 ? <p className="hint">No activity yet.</p> : ledger.map((entry) => <div key={entry.id}><div className={`ledger-icon ${entry.type === 'topup' ? 'green' : 'orange'}`}>{entry.type === 'topup' ? <Plus size={15} /> : <Ticket size={15} />}</div><span><b>{entry.type === 'topup' ? 'Top-up' : 'Token fee'}</b><small>{new Date(entry.created_at).toLocaleDateString('en-IN')}</small></span><strong className={entry.type === 'topup' ? 'positive' : ''}>{entry.type === 'topup' ? '+' : '−'}{money(Number(entry.amount))}</strong></div>)}</div></>}</div>;
}

function ProductCard({ product, offer, shop, onAdd }: { product: Product; offer: Offer; shop: Shop; onAdd: () => void }) {
  const navigate = useNavigate();
  return <article className="product-card"><div className="product-image-wrap" onClick={() => navigate(`/c/product/${product.id}`)}><ImageThumb slug={product.slug} url={product.image_url} /><span className="shop-label">{getLabel(shop)}</span></div><div className="product-info"><h3 onClick={() => navigate(`/c/product/${product.id}`)}>{product.name}</h3><p>{shop.name} · {shop.distance_km} km</p><div className="price-line"><b>{money(offer.price)}</b>{offer.mrp && <del>{money(offer.mrp)}</del>}</div><button className="buy-button" onClick={() => navigate(`/c/product/${product.id}`)}>Buy</button></div></article>;
}
function ImageThumb({ slug, url, small = false }: { slug: string; url?: string | null; small?: boolean }) {
  const extensions = ['jpg', 'jpeg', 'png', 'webp'];
  const candidates = [...(url ? [url] : []), ...extensions.map((ext) => `/images/products/${slug}.${ext}`)];
  const [index, setIndex] = useState(0);
  const [failed, setFailed] = useState(false);
  useEffect(() => { setIndex(0); setFailed(false); }, [slug, url]);
  return <div className={`image-thumb ${small ? 'small' : ''}`}>{failed ? <PackageCheck size={small ? 18 : 28} /> : <img src={candidates[index]} alt="" onError={() => { if (index < candidates.length - 1) setIndex((i) => i + 1); else setFailed(true); }} />}</div>;
}
function QtyStepper({ label, value, onSet }: { label?: string; value: number; onSet: (next: number) => void }) {
  const [text, setText] = useState(String(value));
  useEffect(() => { setText(String(value)); }, [value]);
  function commit() { const n = Math.floor(Number(text)); if (text.trim() === '' || Number.isNaN(n) || n < 0) { setText(String(value)); return; } if (n !== value) onSet(n); else setText(String(value)); }
  const btn = { width: 34, height: 34, borderRadius: 10, background: '#edf2f5', color: '#12345a', fontWeight: 700, fontSize: 17, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' } as const;
  return <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>{label && <b style={{ minWidth: 22, fontSize: 12, color: '#12345a' }}>{label}</b>}<button type="button" aria-label="Decrease" style={btn} onClick={() => onSet(Math.max(0, value - 1))}>−</button><input type="number" min={0} inputMode="numeric" value={text} onChange={(event) => setText(event.target.value)} onBlur={commit} onKeyDown={(event) => { if (event.key === 'Enter') (event.target as HTMLInputElement).blur(); }} style={{ width: 54, height: 34, textAlign: 'center', border: '1px solid #e2e8ec', borderRadius: 10, fontSize: 13, color: '#12345a', background: '#fff', padding: 0 }} /><button type="button" aria-label="Increase" style={btn} onClick={() => onSet(value + 1)}>+</button></div>;
}

function InventoryView({ shop, products, offers, notify, onChanged }: { shop: Shop; products: Product[]; offers: Offer[]; notify: (message: string, tone?: Toast['tone']) => void; onChanged: () => Promise<void> }) {
  const [filter, setFilter] = useState<'all' | 'in' | 'low' | 'out'>('all');
  const [search, setSearch] = useState('');
  const [local, setLocal] = useState<Record<string, Record<string, number>>>({});
  const LOW = 3;
  const stockOf = (offer: Offer): Record<string, number> => local[offer.id] ?? offer.stock;
  const totalOf = (product: Product, stock: Record<string, number>) => product.has_sizes ? Object.values(stock).reduce((sum, qty) => sum + (Number(qty) || 0), 0) : Number(stock.quantity) || 0;
  const statusOf = (total: number): 'in' | 'low' | 'out' => total <= 0 ? 'out' : total <= LOW ? 'low' : 'in';
  const rows = offers.filter((offer) => offer.shop === shop.id).map((offer) => { const product = products.find((p) => p.id === offer.product); return product ? { offer, product, stock: stockOf(offer), total: totalOf(product, stockOf(offer)) } : null; }).filter((row): row is { offer: Offer; product: Product; stock: Record<string, number>; total: number } => row !== null);
  const counts = { all: rows.length, in: rows.filter((r) => statusOf(r.total) === 'in').length, low: rows.filter((r) => statusOf(r.total) === 'low').length, out: rows.filter((r) => statusOf(r.total) === 'out').length };
  const visible = rows.filter((r) => (filter === 'all' || statusOf(r.total) === filter) && (!search.trim() || r.product.name.toLowerCase().includes(search.trim().toLowerCase())));
  async function writeStock(offer: Offer, next: Record<string, number>) {
    setLocal((current) => ({ ...current, [offer.id]: next }));
    const result = await supabase.from('offers').update({ stock: next }).eq('id', offer.id);
    if (result.error) { setLocal((current) => { const copy = { ...current }; delete copy[offer.id]; return copy; }); notify('Could not save the stock. Try again.', 'error'); return; }
    await onChanged();
    setLocal((current) => { if (JSON.stringify(current[offer.id]) !== JSON.stringify(next)) return current; const copy = { ...current }; delete copy[offer.id]; return copy; });
  }
  const keysFor = (product: Product, stock: Record<string, number>) => product.has_sizes ? (Object.keys(stock).length ? Object.keys(stock) : ['S', 'M', 'L']) : ['quantity'];
  const prevKey = (offer: Offer) => `locopick-prev-stock-${offer.id}`;
  function markOut(offer: Offer, product: Product) {
    const stock = stockOf(offer);
    try { localStorage.setItem(prevKey(offer), JSON.stringify(stock)); } catch { /* storage may be unavailable */ }
    const next: Record<string, number> = {};
    keysFor(product, stock).forEach((key) => { next[key] = 0; });
    writeStock(offer, next);
  }
  function markBack(offer: Offer, product: Product) {
    let restored: Record<string, number> | null = null;
    try { const raw = localStorage.getItem(prevKey(offer)); if (raw) restored = JSON.parse(raw) as Record<string, number>; } catch { /* storage may be unavailable */ }
    const restoredTotal = restored ? Object.values(restored).reduce((sum, qty) => sum + (Number(qty) || 0), 0) : 0;
    const fallback: Record<string, number> = {};
    keysFor(product, stockOf(offer)).forEach((key) => { fallback[key] = product.has_sizes ? 2 : 5; });
    writeStock(offer, restored && restoredTotal > 0 ? restored : fallback);
  }
  function setQty(offer: Offer, key: string, value: number) { writeStock(offer, { ...stockOf(offer), [key]: Math.max(0, Math.floor(value)) }); }
  const filters: ['all' | 'in' | 'low' | 'out', string][] = [['all', 'All'], ['in', 'In stock'], ['low', 'Low'], ['out', 'Out of stock']];
  return <div className="page"><div className="page-heading"><div><span className="eyebrow">{shop.name}</span><h1>My items</h1></div><PackageCheck size={23} /></div>
    <div className="chip-row">{filters.map(([key, label]) => <button key={key} className={`filter-chip ${filter === key ? 'selected' : ''}`} onClick={() => setFilter(key)}>{label} · {counts[key]}</button>)}</div>
    <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search your items" style={{ width: '100%', height: 42, margin: '12px 0 4px', padding: '0 14px', border: '1px solid #e2e8ec', borderRadius: 14, background: '#fff', fontSize: 12, color: '#12345a' }} />
    <p className="hint" style={{ margin: '8px 0 0' }}>Every change saves instantly and customers see it right away. Low means {LOW} pieces or fewer.</p>
    {rows.length === 0 ? <div className="empty-card"><PackageCheck size={28} /><h3>No items yet</h3><p>Upload a wholesaler catalog and approve the items. They will appear here with their photos.</p></div> : visible.length === 0 ? <div className="empty-card"><PackageCheck size={28} /><h3>Nothing here</h3><p>No items match this filter.</p></div> : visible.map(({ offer, product, stock, total }) => { const status = statusOf(total); const description = product.description ? (product.description.length > 80 ? `${product.description.slice(0, 80)}...` : product.description) : null; const details = [product.category, product.color, product.material].filter(Boolean).join(' · '); return <article className="request-card" key={offer.id}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <div style={{ width: 84, flex: '0 0 84px', borderRadius: 12, overflow: 'hidden' }}><ImageThumb slug={product.slug} url={product.image_url} /></div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <b style={{ color: '#12345a', fontSize: 13 }}>{product.name}</b>
          <p style={{ color: '#8b96a5', fontSize: 10, margin: '3px 0 6px' }}>{details}</p>
          <div className="price-line"><b>{money(offer.price)}</b>{offer.mrp && <del>{money(offer.mrp)}</del>}</div>
          {description && <p style={{ color: '#6b7787', fontSize: 10, margin: '6px 0 0' }}>{description}</p>}
          <div style={{ marginTop: 8 }}>{status === 'in' ? <span className="chip green-chip">In stock · {total} pcs</span> : status === 'low' ? <span className="chip orange-chip">Low · only {total} left</span> : <span className="chip" style={{ background: '#fde8e8', color: '#c0392b' }}>Out of stock</span>}</div>
        </div>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px 18px', marginTop: 14 }}>{product.has_sizes ? keysFor(product, stock).map((size) => <QtyStepper key={size} label={size} value={Number(stock[size]) || 0} onSet={(next) => setQty(offer, size, next)} />) : <QtyStepper label="Qty" value={Number(stock.quantity) || 0} onSet={(next) => setQty(offer, 'quantity', next)} />}</div>
      <div className="token-actions">{status === 'out' ? <button onClick={() => markBack(offer, product)}><Check size={15} /> Back in stock</button> : <button onClick={() => markOut(offer, product)}><X size={15} /> Mark out of stock</button>}</div>
    </article>; })}
  </div>;
}

function AboutPage() {
  const real = ['Sign-in for customer and shopkeeper, with shops, products and prices from a live database', 'Reserve-and-inspect token with a 6-digit code, saved in the database', 'Shopkeeper scan: the code is verified, the token is marked used, and the bill and fee are created by the database', 'Shopkeeper inventory: stock per size or quantity is saved', 'Product pages, cart, category filters, token history'];
  const fake = ['Wallet top-up is simulated (no real payment)', 'Camera preview is a placeholder; the shopkeeper types the 6-digit code', 'Trend Radar festivals are hand-picked; waitlist counts are demo data', 'Shop distances and ratings are sample data', 'Stock does not reduce when a token is created, and cancelling a token does not update the database yet', 'PRD rules like the 5-minute cap and 7-day / 3-cancel limit are not built here'];
  const card: CSSProperties = { background: '#fff', border: '1px solid #e5ebee', borderRadius: 16, padding: 16, marginBottom: 14 };
  const h: CSSProperties = { margin: '0 0 10px', fontSize: 15, color: '#12345a' };
  const row = (ok: boolean): CSSProperties => ({ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '8px 0', fontSize: 13, lineHeight: 1.45, color: '#33414d', borderTop: '1px solid #f0f3f5', listStyle: 'none' });
  const List = ({ items, ok }: { items: string[]; ok: boolean }) => <ul style={{ margin: 0, padding: 0 }}>{items.map((t) => <li key={t} style={row(ok)}><span style={{ flex: '0 0 20px', height: 20, borderRadius: 10, display: 'grid', placeItems: 'center', background: ok ? '#e3f6ea' : '#fff1e6', color: ok ? '#1c8a4a' : '#e8590c' }}>{ok ? <Check size={12} /> : <X size={12} />}</span><span>{t}</span></li>)}</ul>;
  return <div className="page"><div className="page-heading"><div><span className="eyebrow">About</span><h1>About this prototype</h1></div><BookOpen size={23} /></div>
    <div style={card}><h3 style={h}>LocoPick</h3><p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, color: '#55626e' }}>Customers reserve an item online, inspect it in the shop, and the shopkeeper pays a small fee only when the pickup really happens. Demo city: {DEMO_CITY}. This is a portfolio case study, not a live business.</p></div>
    <div style={card}><h3 style={h}>What really works</h3><List items={real} ok /></div>
    <div style={card}><h3 style={h}>Simulated or not built</h3><List items={fake} ok={false} /></div>
    <p style={{ fontSize: 11, color: '#7d8995', textAlign: 'center' }}>All shops, prices and stock are sample data made for the demo.</p></div>;
}
function SectionTitle({ title, action }: { title: string; action: string }) { return <div className="section-title"><h2>{title}</h2><button>{action} <ChevronRight size={15} /></button></div>; }
function BottomNav({ view, setView, cartCount }: { view: View; setView: (view: View) => void; cartCount: number }) { return <nav className="bottom-nav"><button className={view === 'home' ? 'active' : ''} onClick={() => setView('home')}><Home size={19} /><span>Home</span></button><button className={view === 'tokens' ? 'active' : ''} onClick={() => setView('tokens')}><Ticket size={19} /><span>Tokens</span></button><button className={view === 'cart' ? 'active' : ''} onClick={() => setView('cart')}><ShoppingBag size={19} /><span>Cart{cartCount ? ` · ${cartCount}` : ''}</span></button><button className={view === 'profile' ? 'active' : ''} onClick={() => setView('profile')}><UserRound size={19} /><span>Profile</span></button></nav>; }
function MerchantNav({ view, setView, onSignOut }: { view: View; setView: (view: View) => void; onSignOut: () => void }) { return <nav className="bottom-nav merchant-nav"><button className={view === 'requests' ? 'active' : ''} onClick={() => setView('requests')}><PackageCheck size={19} /><span>Requests</span></button><button className={view === 'scan' ? 'active' : ''} onClick={() => setView('scan')}><Camera size={19} /><span>Scan</span></button><button className={view === 'radar' ? 'active' : ''} onClick={() => setView('radar')}><Flame size={19} /><span>Radar</span></button><button className={view === 'wallet' ? 'active' : ''} onClick={() => setView('wallet')}><WalletCards size={19} /><span>Wallet</span></button><button className={view === 'more' ? 'active' : ''} onClick={() => setView('more')}><Menu size={19} /><span>More</span></button></nav>; }

function ProductPage({ products, shops, offers, addToCart, setCart, setView }: { products: Product[]; shops: Shop[]; offers: Offer[]; addToCart: (product: Product, offer: Offer, shop: Shop, size?: string) => void; setCart: React.Dispatch<React.SetStateAction<CartItem[]>>; setView: (view: View) => void }) {
  const location = useLocation();
  const id = decodeURIComponent(location.pathname.split('/').filter(Boolean).pop() ?? '');
  const product = products.find((p) => p.id === id);
  const productOffers = useMemo(() => offers.filter((o) => o.product === id).map((o) => ({ offer: o, shop: shops.find((s) => s.id === o.shop)! })).filter((item) => item.shop).sort((a, b) => Number(b.shop.subscribed) - Number(a.shop.subscribed) || Number((b.shop.token_volume ?? 0) >= 50) - Number((a.shop.token_volume ?? 0) >= 50) || (a.shop.distance_km ?? 0) - (b.shop.distance_km ?? 0)), [offers, shops, id]);
  const [selectedOfferIdx, setSelectedOfferIdx] = useState(0);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [sizeHighlighted, setSizeHighlighted] = useState(false);
  useEffect(() => { setSelectedOfferIdx(0); setSelectedSize(null); setQuantity(1); }, [id]);
  if (!product || productOffers.length === 0) return <div className="page"><div className="empty-card"><PackageCheck size={28} /><h3>Product not found</h3><p>This item may no longer be available.</p></div></div>;
  const current = productOffers[selectedOfferIdx] ?? productOffers[0];
  const { offer, shop } = current;
  const sizes: string[] = product.has_sizes ? Object.keys(offer.stock).filter((s) => ['S', 'M', 'L'].includes(s)) : [];
  const stockCount = product.has_sizes ? (selectedSize ? offer.stock[selectedSize] ?? 0 : 0) : (offer.stock.quantity ?? 0);
  const totalPrice = offer.price * quantity;
  const otherOffers = productOffers.filter((_, i) => i !== selectedOfferIdx);
  const percentOff = offer.mrp ? Math.round(((offer.mrp - offer.price) / offer.mrp) * 100) : null;
  const desc = product.description || 'Quality product from a trusted local shop.';
  const material = product.material || 'Premium quality';
  const color = product.color || 'As shown';
  function handleBuyNow() {
    if (product!.has_sizes && !selectedSize) { setSizeHighlighted(true); document.getElementById('size-selector')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
    setCart((current) => {
      const item = { product: product!, offer, shop, size: selectedSize ?? undefined, quantity, mode: 'token' as const };
      const existing = current.find((c) => c.offer.id === offer.id && c.size === selectedSize);
      return existing ? current.map((c) => c === existing ? { ...c, quantity: c.quantity + quantity } : c) : [...current, item];
    });
    setView('cart');
  }
  return <div className="page product-page"><div className="product-hero-img"><ImageThumb slug={product.slug} url={product.image_url} /><span className="shop-label">{getLabel(shop)}</span></div><div className="product-page-body"><h1 className="product-page-name">{product.name}</h1><div className="product-shop-row"><Store size={14} /><span>{shop.name}</span><span className="shop-distance"><MapPin size={12} /> {shop.distance_km} km</span><button className="view-shop-link">View shop</button></div><div className="product-price-block"><b className="product-price-large">{money(offer.price)}</b>{offer.mrp && <del className="product-mrp">{money(offer.mrp)}</del>}{percentOff && <span className="chip orange-chip">{percentOff}% off</span>}</div>{product.has_sizes && <div id="size-selector" className={`size-selector ${sizeHighlighted ? 'highlighted' : ''}`}><div className="size-selector-label">Select size</div><div className="size-chips">{sizes.map((size) => <button key={size} className={`size-chip-btn ${selectedSize === size ? 'selected' : ''}`} disabled={!offer.stock[size]} onClick={() => { setSelectedSize(size); setSizeHighlighted(false); }}>{size}{offer.stock[size] <= 3 && <span className="stock-note">Only {offer.stock[size]} left</span>}</button>)}</div></div>}<div className="quantity-row"><span>Quantity</span><div className="stepper"><button onClick={() => setQuantity(Math.max(1, quantity - 1))}>−</button><b>{quantity}</b><button onClick={() => setQuantity(quantity + 1)}>+</button></div></div>{!product.has_sizes && stockCount <= 3 && <p className="only-n-left">Only {stockCount} left</p>}{otherOffers.length > 0 && <div className="also-available"><div className="also-available-title">Also available at</div>{otherOffers.map((item) => { const itemStock = product!.has_sizes ? (selectedSize ? item.offer.stock[selectedSize] ?? 0 : 0) : (item.offer.stock.quantity ?? 0); if (itemStock < quantity) return null; return <button key={item.offer.id} className={`also-available-row ${item.offer.id === offer.id ? 'selected' : ''}`} onClick={() => { const idx = productOffers.findIndex((o) => o.offer.id === item.offer.id); setSelectedOfferIdx(idx); }}><span className="also-available-shop">{item.shop.name}</span><span className="also-available-dist"><MapPin size={11} /> {item.shop.distance_km} km</span><b className="also-available-price">{money(item.offer.price)}</b></button>; })}</div>}<div className="product-details"><h3>Details</h3><p className="detail-row"><span>Description</span>{desc}</p><p className="detail-row"><span>Material</span>{material}</p><p className="detail-row"><span>Colour</span>{color}</p><p className="detail-row"><span>Category</span>{product.category}</p></div><div className="fulfilment-info"><div className="fulfilment-row"><Ticket size={14} /> <span>Reserve & Inspect: free, held for 3 hours, pay in the shop{totalPrice < 250 ? ' (above Rs 250)' : ''}</span></div><div className="fulfilment-row"><Truck size={14} /> <span>Home delivery: fee by distance, not offered beyond 10 km</span></div><div className="fulfilment-row returns-line"><span>Returns: strict for token purchases, 24 hours for delivery</span></div></div></div><div className="product-action-bar"><button className="outline-button add-to-cart-btn" onClick={() => { if (product.has_sizes && !selectedSize) { setSizeHighlighted(true); return; } addToCart(product, offer, shop, selectedSize ?? undefined); }}><ShoppingBag size={16} /> Add to cart</button><button className="primary-button buy-now-btn" onClick={handleBuyNow}>Buy now</button></div></div>;
}

export default App;