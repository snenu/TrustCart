import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Activity,
  BadgeCheck,
  BadgeX,
  Boxes,
  CheckCircle2,
  CircleAlert,
  Copy,
  Fingerprint,
  KeyRound,
  Loader2,
  Lock,
  PackageSearch,
  RefreshCw,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  Store,
  Tag,
  UserRound,
  Wallet,
  Wrench,
} from 'lucide-react';
import { beginWalletConnection, listCompatibleWallets, type WalletOption } from './wallet-connector';
import type { InitialAPI } from '@midnight-ntwrk/dapp-connector-api';
import { BrowserTrustCartManager } from './browser-manager';
import {
  TrustCartAPI,
  bytesToHex,
  dateToEpoch,
  decodeText,
  formatEpochDate,
  hexToBytes,
  type ManufacturerView,
  type ProductView,
  type SellerView,
  type TrustCartDerivedState,
  type WarrantyView,
} from '../../api/src/index';
import { ProductStatus } from 'trustcart-contract';

const CONTRACT_ADDRESS_KEY = 'trustcart:contract-address:v1';

type Phase = 'idle' | 'connecting' | 'ready';
type TabId = 'overview' | 'verify' | 'manufacture' | 'sell' | 'own' | 'settings';

type Toast = { id: number; kind: 'ok' | 'err' | 'info'; text: string };

const getWalletRegistry = (): Record<string, InitialAPI | undefined> => {
  const midnight = (globalThis as unknown as { midnight?: () => Record<string, InitialAPI | undefined> }).midnight;
  return midnight?.() ?? {};
};

const STATUS_META: Record<ProductStatus, { label: string; className: string }> = {
  [ProductStatus.ACTIVE]: { label: 'Active', className: 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/30' },
  [ProductStatus.STOLEN]: { label: 'Stolen', className: 'bg-rose-500/15 text-rose-300 ring-rose-500/30' },
  [ProductStatus.LOST]: { label: 'Lost', className: 'bg-amber-500/15 text-amber-300 ring-amber-500/30' },
  [ProductStatus.RECALLED]: { label: 'Recalled', className: 'bg-orange-500/15 text-orange-300 ring-orange-500/30' },
  [ProductStatus.COUNTERFEIT]: { label: 'Counterfeit', className: 'bg-fuchsia-500/15 text-fuchsia-300 ring-fuchsia-500/30' },
};

const shortHex = (value: string, size = 6): string =>
  `${value.slice(0, size)}…${value.slice(-size)}`;

const button =
  'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-50';
const primaryButton = `${button} bg-gradient-to-r from-emerald-400 to-sky-400 text-slate-950 shadow-lg shadow-emerald-500/20 hover:brightness-110 active:scale-[0.98]`;
const ghostButton = `${button} glass text-slate-200 hover:bg-white/10 active:scale-[0.98]`;
const inputClass =
  'w-full rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 outline-none transition focus:border-emerald-400/60 focus:bg-white/[0.06] focus:ring-2 focus:ring-emerald-400/20';
const labelClass = 'mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-400';

const Field = ({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) => (
  <label className="block">
    <span className={labelClass}>{label}</span>
    {children}
  </label>
);

const Card = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <motion.div
    initial={{ opacity: 0, y: 14 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.35, ease: 'easeOut' }}
    className={`glass rounded-2xl p-5 ${className}`}
  >
    {children}
  </motion.div>
);

const Spinner = () => <Loader2 className="h-4 w-4 animate-spin" />;

const Chip = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${className}`}>
    {children}
  </span>
);
const ConnectScreen = ({
  onConnect,
  busy,
  error,
}: {
  onConnect: (walletId?: string) => void;
  busy: boolean;
  error: string | null;
}) => {
  const wallets: WalletOption[] = useMemo(
    () => listCompatibleWallets(getWalletRegistry()),
    [],
  );

  return (
    <div className="relative z-10 flex min-h-full flex-col items-center justify-center px-6 py-16">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', stiffness: 120, damping: 16 }}
        className="mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-emerald-400/20 to-sky-400/20 ring-1 ring-white/10"
      >
        <ShieldCheck className="h-10 w-10 text-emerald-300" />
      </motion.div>
      <motion.h1
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08 }}
        className="text-center text-5xl font-extrabold tracking-tight"
      >
        Trust<span className="text-gradient">Cart</span>
      </motion.h1>
      <motion.p
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.16 }}
        className="mt-4 max-w-xl text-center text-lg text-slate-400"
      >
        Prove a product is genuine, that you own it, and that its warranty is live —
        with zero-knowledge proofs on Midnight. Serials, prices and identities never touch the chain.
      </motion.p>

      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.24 }}
        className="mt-10 grid w-full max-w-3xl gap-4 sm:grid-cols-3"
      >
        {[
          { icon: Fingerprint, title: 'Serial-blind', text: 'Product serials are hashed into commitments before they ever leave your device.' },
          { icon: UserRound, title: 'Owner-anonymous', text: 'Ownership transfers look like opaque hashes to everyone but the parties involved.' },
          { icon: BadgeCheck, title: 'Warranty-aware', text: 'Warranty windows live on-chain while purchase prices stay private.' },
        ].map(({ icon: Icon, title, text }) => (
          <div key={title} className="glass rounded-2xl p-5">
            <Icon className="mb-3 h-6 w-6 text-sky-300" />
            <h3 className="text-sm font-bold text-slate-100">{title}</h3>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-400">{text}</p>
          </div>
        ))}
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.32 }}
        className="mt-10 flex flex-col items-center gap-3"
      >
        <button className={`${primaryButton} px-8 py-3.5 text-base`} disabled={busy} onClick={() => onConnect()}>
          {busy ? <Spinner /> : <Wallet className="h-5 w-5" />}
          {busy ? 'Connecting…' : 'Connect Midnight Wallet'}
        </button>
        {wallets.length > 1 && (
          <div className="flex flex-wrap justify-center gap-2">
            {wallets.map(({ id, wallet }) => (
              <button key={id} className={`${ghostButton} px-3 py-1.5 text-xs`} disabled={busy} onClick={() => onConnect(id)}>
                Use {wallet.name}
              </button>
            ))}
          </div>
        )}
        <AnimatePresence>
          {error && (
            <motion.p
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="max-w-md text-center text-sm text-rose-300"
            >
              {error}
            </motion.p>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};


const Tabs: { id: TabId; label: string; icon: typeof Boxes }[] = [
  { id: 'overview', label: 'Overview', icon: Boxes },
  { id: 'verify', label: 'Verify', icon: PackageSearch },
  { id: 'manufacture', label: 'Manufacturer', icon: Wrench },
  { id: 'sell', label: 'Sell', icon: ShoppingCart },
  { id: 'own', label: 'My ownership', icon: KeyRound },
  { id: 'settings', label: 'Settings', icon: Lock },
];

type RunFn = (label: string, action: () => Promise<void>) => Promise<void>;

const Dashboard = ({
  api,
  manager,
  state,
  secretHex,
  receivingCode,
  summary,
  onToast,
}: {
  api: TrustCartAPI;
  manager: BrowserTrustCartManager;
  state: TrustCartDerivedState;
  secretHex: string;
  receivingCode: string;
  summary: { name: string; proofServer: string; unshieldedAddress: string };
  onToast: (kind: Toast['kind'], text: string) => void;
}) => {
  const [tab, setTab] = useState<TabId>('overview');
  const [joining, setJoining] = useState('');

  const manufacturer = state.manufacturers.find((m) => m.mfrHash === api.mfrCommitment(secretHex));
  const seller = state.sellers.find((s) => s.sellerHash === api.sellerCommitment(secretHex));

  const run: RunFn = useCallback(
    async (label, action) => {
      onToast('info', `${label} — generating proof & submitting…`);
      try {
        await action();
        onToast('ok', `${label} — finalized on-chain.`);
      } catch (error) {
        onToast('err', error instanceof Error ? error.message : String(error));
      }
    },
    [onToast],
  );

  const joinExisting = () =>
    void run('Join contract', async () => {
      const joined = await manager.join(joining.trim());
      localStorage.setItem(CONTRACT_ADDRESS_KEY, joined.deployedContractAddress);
      onToast('ok', `Joined ${shortHex(joined.deployedContractAddress, 12)} — reload to switch.`);
    });

  return (
    <div className="relative z-10 mx-auto w-full max-w-6xl px-6 pb-20 pt-8">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-400/20 to-sky-400/20 ring-1 ring-white/10">
            <ShieldCheck className="h-6 w-6 text-emerald-300" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold tracking-tight">
              Trust<span className="text-gradient">Cart</span>
            </h1>
            <p className="text-xs text-slate-500">
              {summary.name} · proof server {summary.proofServer.replace(/^https?:\/\//, '')}
            </p>
          </div>
        </div>
        <button
          className={`${ghostButton} max-w-full font-mono text-xs`}
          title={receivingCode}
          onClick={() => {
            void navigator.clipboard.writeText(receivingCode);
            onToast('ok', 'Receiving code copied.');
          }}
        >
          <Copy className="h-3.5 w-3.5" />
          {shortHex(receivingCode, 10)}
        </button>
      </header>

      <nav className="mb-8 flex flex-wrap gap-2">
        {Tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`relative flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
              tab === id ? 'text-slate-950' : 'glass text-slate-300 hover:text-white'
            }`}
          >
            {tab === id && (
              <motion.span
                layoutId="tab-pill"
                className="absolute inset-0 rounded-xl bg-gradient-to-r from-emerald-400 to-sky-400"
                transition={{ type: 'spring', stiffness: 320, damping: 28 }}
              />
            )}
            <Icon className="relative z-10 h-4 w-4" />
            <span className="relative z-10">{label}</span>
          </button>
        ))}
      </nav>

      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.22 }}
        >
          {tab === 'overview' && <OverviewTab state={state} receivingCode={receivingCode} secretHex={secretHex} api={api} />}
          {tab === 'verify' && <VerifyTab api={api} state={state} />}
          {tab === 'manufacture' && (
            <ManufactureTab api={api} state={state} run={run} manufacturer={manufacturer} />
          )}
          {tab === 'sell' && <SellTab api={api} state={state} run={run} seller={seller} />}
          {tab === 'own' && <OwnTab api={api} state={state} run={run} secretHex={secretHex} receivingCode={receivingCode} />}
          {tab === 'settings' && (
            <SettingsTab
              address={api.deployedContractAddress}
              summary={summary}
              manager={manager}
              joining={joining}
              setJoining={setJoining}
              joinExisting={joinExisting}
              onToast={onToast}
            />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};
const StatCard = ({ icon: Icon, label, value }: { icon: typeof Boxes; label: string; value: string | number }) => (
  <Card className="flex items-center gap-4">
    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/5 ring-1 ring-white/10">
      <Icon className="h-5 w-5 text-emerald-300" />
    </div>
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p>
      <p className="text-2xl font-extrabold tabular-nums text-slate-100">{value}</p>
    </div>
  </Card>
);

const OverviewTab = ({
  state,
  receivingCode,
  secretHex,
  api,
}: {
  state: TrustCartDerivedState;
  receivingCode: string;
  secretHex: string;
  api: TrustCartAPI;
}) => {
  const ownerHash = api.ownerCommitment(secretHex);
  const owned = state.products.filter((p) => p.ownerHash === ownerHash);
  const myWarranties = owned
    .map((product) => ({ product, warranty: state.warranties.find((w) => w.id === product.warrantyId) }))
    .filter((entry) => entry.warranty);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Wrench} label="Manufacturers" value={state.manufacturerCount} />
        <StatCard icon={Store} label="Sellers" value={state.sellerCount} />
        <StatCard icon={Boxes} label="Products" value={state.productCount} />
        <StatCard icon={BadgeCheck} label="Warranties" value={state.warrantyCount} />
      </div>

      <Card>
        <div className="mb-4 flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-sky-300" />
          <h2 className="text-sm font-bold text-slate-200">Your receiving code</h2>
        </div>
        <p className="mb-3 text-xs leading-relaxed text-slate-400">
          Share this code with a seller at checkout — it is a one-way commitment that lets them register
          the sale to you without learning who you are.
        </p>
        <code className="block break-all rounded-xl bg-black/40 p-3 font-mono text-[11px] text-emerald-300 ring-1 ring-white/10">
          {receivingCode}
        </code>
      </Card>

      <Card>
        <div className="mb-4 flex items-center gap-2">
          <BadgeCheck className="h-4 w-4 text-emerald-300" />
          <h2 className="text-sm font-bold text-slate-200">Your warranties</h2>
        </div>
        {myWarranties.length === 0 ? (
          <p className="text-sm text-slate-500">
            No warranties yet. Products you buy (via a seller registering your receiving code) will appear here with live warranty windows.
          </p>
        ) : (
          <div className="space-y-3">
            {myWarranties.map(({ product, warranty }) => (
              <WarrantyRow key={product.id} product={product} warranty={warranty!} state={state} />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};

const WarrantyRow = ({
  product,
  warranty,
  state,
}: {
  product: ProductView;
  warranty: WarrantyView;
  state: TrustCartDerivedState;
}) => {
  const manufacturer = state.manufacturers.find((m) => m.id === product.mfrId);
  const expired = Date.now() / 1000 > warranty.expiresAt;
  const status = STATUS_META[product.status];

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      className="rounded-xl border border-white/10 bg-white/[0.03] p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-bold text-slate-100">
            {manufacturer?.brand ?? 'Unknown'} · {product.model}
          </p>
          <p className="text-xs text-slate-500">
            Product #{product.id} · sold {formatEpochDate(BigInt(warranty.issuedAt))}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Chip className={status.className}>{status.label}</Chip>
          <Chip
            className={
              expired
                ? 'bg-slate-500/15 text-slate-300 ring-slate-500/30'
                : 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/30'
            }
          >
            {expired ? 'Expired' : `Warranty until ${formatEpochDate(BigInt(warranty.expiresAt))}`}
          </Chip>
        </div>
      </div>
      {warranty.cancelled && (
        <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-rose-300">
          <CircleAlert className="h-3.5 w-3.5" /> Warranty cancelled by manufacturer
        </p>
      )}
    </motion.div>
  );
};

const VerifyTab = ({ api, state }: { api: TrustCartAPI; state: TrustCartDerivedState }) => {
  const [serial, setSerial] = useState('');
  const [result, setResult] = useState<ProductView | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const verify = async () => {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const matches = state.products.filter((product) => api.isAuthentic(product, serial));
      if (matches.length === 0) {
        setError('No registered product matches this serial number.');
      } else {
        setResult(matches[0]);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <div className="mb-4 flex items-center gap-2">
          <PackageSearch className="h-4 w-4 text-emerald-300" />
          <h2 className="text-sm font-bold text-slate-200">Authenticity check</h2>
        </div>
        <Field label="Product serial number">
          <input
            className={inputClass}
            placeholder="e.g. SN-7C2K-9911"
            value={serial}
            onChange={(event) => setSerial(event.target.value)}
          />
        </Field>
        <button className={`${primaryButton} mt-4 w-full`} disabled={busy || !serial.trim()} onClick={() => void verify()}>
          {busy ? <Spinner /> : <Sparkles className="h-4 w-4" />}
          Verify against chain
        </button>
        <p className="mt-3 text-xs leading-relaxed text-slate-500">
          The serial is hashed locally and compared against the on-chain commitment — the raw serial never leaves this page.
        </p>
        {error && (
          <p className="mt-4 flex items-start gap-2 rounded-xl bg-rose-500/10 p-3 text-xs text-rose-300 ring-1 ring-rose-500/30">
            <BadgeX className="mt-0.5 h-4 w-4 shrink-0" /> {error}
          </p>
        )}
      </Card>

      <AnimatePresence>
        {result && (
          <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}>
            <Card className="border border-emerald-400/30">
              <div className="mb-4 flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-300" />
                <h2 className="text-sm font-bold text-emerald-200">Genuine product</h2>
              </div>
              <dl className="space-y-2 text-sm">
                <Row label="Model" value={result.model} />
                <Row label="Brand" value={state.manufacturers.find((m) => m.id === result.mfrId)?.brand ?? '—'} />
                <Row label="Category" value={result.category} />
                <Row label="Batch" value={result.batch} />
                <Row label="Warranty" value={`${result.warrantyMonths} months from sale`} />
                <Row label="Status" value={STATUS_META[result.status].label} />
                <Row label="Commitment" value={shortHex(result.productCommitment, 12)} mono />
              </dl>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const Row = ({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) => (
  <div className="flex items-center justify-between gap-4 border-b border-white/5 pb-2">
    <dt className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</dt>
    <dd className={`truncate text-right text-sm text-slate-200 ${mono ? 'font-mono text-xs' : ''}`}>{value}</dd>
  </div>
);

const ManufactureTab = ({
  api,
  state,
  run,
  manufacturer,
}: {
  api: TrustCartAPI;
  state: TrustCartDerivedState;
  run: RunFn;
  manufacturer?: ManufacturerView;
}) => {
  const [brand, setBrand] = useState('');
  const [mfrId, setMfrId] = useState('');
  const [model, setModel] = useState('');
  const [category, setCategory] = useState('');
  const [batch, setBatch] = useState('');
  const [warrantyMonths, setWarrantyMonths] = useState('24');
  const [serialNumber, setSerialNumber] = useState('');
  const [productId, setProductId] = useState('');
  const [status, setStatus] = useState<ProductStatus>(ProductStatus.STOLEN);

  const registerManufacturer = () =>
    void run('Register manufacturer', () => api.registerManufacturer({ brand }));

  const registerProduct = () =>
    void run('Register product', () =>
      api.registerProduct({
        mfrId: Number(mfrId),
        model,
        category,
        batch,
        warrantyMonths: Number(warrantyMonths),
        serialNumber,
      }),
    );

  const setStatusOnChain = () =>
    void run('Set product status', () => api.setProductStatus(Number(productId), status));

  const mine = state.products.filter((p) => manufacturer && p.mfrId === manufacturer.id);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <div className="mb-4 flex items-center gap-2">
          <Wrench className="h-4 w-4 text-emerald-300" />
          <h2 className="text-sm font-bold text-slate-200">Register manufacturer</h2>
        </div>
        <p className="mb-4 text-xs leading-relaxed text-slate-500">
          Registers your wallet as a manufacturer under the brand name. Only the brand is public — your identity is a hash.
        </p>
        <Field label="Brand name">
          <input className={inputClass} placeholder="Acme Audio" value={brand} onChange={(e) => setBrand(e.target.value)} />
        </Field>
        <button className={`${primaryButton} mt-4 w-full`} disabled={!brand.trim()} onClick={registerManufacturer}>
          <ShieldCheck className="h-4 w-4" /> Register as manufacturer
        </button>
        {manufacturer && (
          <p className="mt-3 flex items-center gap-2 rounded-xl bg-emerald-500/10 p-3 text-xs text-emerald-300 ring-1 ring-emerald-500/30">
            <BadgeCheck className="h-4 w-4" /> Registered as {manufacturer.brand} (mfr #{manufacturer.id})
          </p>
        )}
      </Card>

      <Card>
        <div className="mb-4 flex items-center gap-2">
          <Tag className="h-4 w-4 text-emerald-300" />
          <h2 className="text-sm font-bold text-slate-200">Register product</h2>
        </div>
        <div className="space-y-3">
          <Field label="Manufacturer id">
            <input className={inputClass} placeholder="1" value={mfrId} onChange={(e) => setMfrId(e.target.value)} />
          </Field>
          <Field label="Model">
            <input className={inputClass} placeholder="Aura Buds Pro" value={model} onChange={(e) => setModel(e.target.value)} />
          </Field>
          <Field label="Category">
            <input className={inputClass} placeholder="Audio" value={category} onChange={(e) => setCategory(e.target.value)} />
          </Field>
          <Field label="Batch">
            <input className={inputClass} placeholder="B-2026-05" value={batch} onChange={(e) => setBatch(e.target.value)} />
          </Field>
          <Field label="Warranty (months)">
            <input className={inputClass} placeholder="24" value={warrantyMonths} onChange={(e) => setWarrantyMonths(e.target.value)} />
          </Field>
          <Field label="Serial number (stays private)">
            <input className={inputClass} placeholder="SN-7C2K-9911" value={serialNumber} onChange={(e) => setSerialNumber(e.target.value)} />
          </Field>
        </div>
        <button
          className={`${primaryButton} mt-4 w-full`}
          disabled={!Number(mfrId) || !model.trim() || !serialNumber.trim()}
          onClick={registerProduct}
        >
          <Fingerprint className="h-4 w-4" /> Commit product to chain
        </button>
        <p className="mt-3 break-all text-xs text-slate-500">
          {serialNumber
            ? `Commitment: ${shortHex(api.productCommitment(serialNumber, Number(mfrId) || 0), 12)}`
            : 'Serial commitment preview appears here.'}
        </p>
      </Card>

      <Card>
        <div className="mb-4 flex items-center gap-2">
          <CircleAlert className="h-4 w-4 text-rose-300" />
          <h2 className="text-sm font-bold text-slate-200">Set product status</h2>
        </div>
        <div className="space-y-3">
          <Field label="Product id">
            <input className={inputClass} placeholder="1" value={productId} onChange={(e) => setProductId(e.target.value)} />
          </Field>
          <Field label="Status">
            <select className={inputClass} value={String(status)} onChange={(e) => setStatus(Number(e.target.value) as ProductStatus)}>
              {Object.entries(ProductStatus)
                .filter(([, v]) => typeof v === 'number')
                .map(([label, value]) => (
                  <option key={String(value)} value={String(value)} className="bg-slate-900">
                    {label}
                  </option>
                ))}
            </select>
          </Field>
        </div>
        <button className={`${primaryButton} mt-4 w-full`} disabled={!Number(productId)} onClick={setStatusOnChain}>
          <Activity className="h-4 w-4" /> Update status
        </button>
      </Card>

      <Card>
        <div className="mb-4 flex items-center gap-2">
          <Boxes className="h-4 w-4 text-sky-300" />
          <h2 className="text-sm font-bold text-slate-200">My products</h2>
        </div>
        {mine.length === 0 ? (
          <p className="text-sm text-slate-500">No products registered yet.</p>
        ) : (
          <div className="space-y-2">
            {mine.map((product) => (
              <div key={product.id} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] p-3">
                <div>
                  <p className="text-sm font-semibold text-slate-100">{product.model}</p>
                  <p className="text-xs text-slate-500">#{product.id} · {product.batch} · {product.warrantyMonths} mo</p>
                </div>
                <Chip className={STATUS_META[product.status].className}>{STATUS_META[product.status].label}</Chip>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};

const SellTab = ({
  api,
  state,
  run,
  seller,
}: {
  api: TrustCartAPI;
  state: TrustCartDerivedState;
  run: RunFn;
  seller?: SellerView;
}) => {
  const [storeName, setStoreName] = useState('');
  const [sellerMfrId, setSellerMfrId] = useState('');
  const [productId, setProductId] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [priceDrops, setPriceDrops] = useState('');
  const [receivingCode, setReceivingCode] = useState('');
  const [transferId, setTransferId] = useState('');
  const [transferCode, setTransferCode] = useState('');
  const [authorized, setAuthorized] = useState(false);

  const registerSeller = () =>
    void run('Register seller', () =>
      api.registerSeller({ storeName, mfrId: Number(sellerMfrId) }),
    );

  const authorize = (revoke: boolean) => {
    setAuthorized(revoke);
    void run(revoke ? 'Revoke authorization' : 'Authorize seller', () =>
      api[revoke ? 'revokeSellerAuthorization' : 'authorizeSeller']({
        mfrId: Number(sellerMfrId),
        storeName,
      }),
    );
  };

  const registerSale = () =>
    void run('Register sale', () =>
      api.registerSale({
        productId: Number(productId),
        serialNumber,
        priceDrops: BigInt(priceDrops || '0'),
        buyerReceivingCode: receivingCode.trim(),
      }),
    );

  const transferOwnership = () =>
    void run('Transfer ownership', () =>
      api.transferOwnership(Number(transferId), transferCode.trim()),
    );

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <div className="mb-4 flex items-center gap-2">
          <Store className="h-4 w-4 text-emerald-300" />
          <h2 className="text-sm font-bold text-slate-200">Register store & authorization</h2>
        </div>
        <div className="space-y-3">
          <Field label="Store name">
            <input className={inputClass} placeholder="GadgetHub" value={storeName} onChange={(e) => setStoreName(e.target.value)} />
          </Field>
          <Field label="Manufacturer id">
            <input className={inputClass} placeholder="1" value={sellerMfrId} onChange={(e) => setSellerMfrId(e.target.value)} />
          </Field>
        </div>
        <div className="mt-4 flex gap-2">
          <button className={`${primaryButton} flex-1`} disabled={!storeName.trim() || !Number(sellerMfrId)} onClick={registerSeller}>
            Register store
          </button>
        </div>
        <div className="mt-2 flex gap-2">
          <button className={`${ghostButton} flex-1`} disabled={!storeName.trim() || !Number(sellerMfrId)} onClick={() => authorize(false)}>
            Request authorization
          </button>
          <button className={`${ghostButton} flex-1 text-rose-300`} disabled={!storeName.trim() || !Number(sellerMfrId)} onClick={() => authorize(true)}>
            Revoke authorization
          </button>
        </div>
        {seller && (
          <p className="mt-3 flex items-center gap-2 rounded-xl bg-emerald-500/10 p-3 text-xs text-emerald-300 ring-1 ring-emerald-500/30">
            <BadgeCheck className="h-4 w-4" /> Store {seller.storeName} (seller #{seller.id})
          </p>
        )}
      </Card>

      <Card>
        <div className="mb-4 flex items-center gap-2">
          <ShoppingCart className="h-4 w-4 text-emerald-300" />
          <h2 className="text-sm font-bold text-slate-200">Register sale</h2>
        </div>
        <p className="mb-4 text-xs leading-relaxed text-slate-500">
          Enter the buyer's receiving code from their TrustCart app. The sale is recorded against their
          commitment — you never learn their identity or wallet.
        </p>
        <div className="space-y-3">
          <Field label="Product id">
            <input className={inputClass} placeholder="1" value={productId} onChange={(e) => setProductId(e.target.value)} />
          </Field>
          <Field label="Serial number">
            <input className={inputClass} placeholder="SN-7C2K-9911" value={serialNumber} onChange={(e) => setSerialNumber(e.target.value)} />
          </Field>
          <Field label="Price (drops)">
            <input className={`${inputClass} font-mono`} placeholder="1000000000000" value={priceDrops} onChange={(e) => setPriceDrops(e.target.value)} />
          </Field>
          <Field label="Buyer receiving code (commitment)">
            <input className={`${inputClass} font-mono text-xs`} placeholder="0x…" value={receivingCode} onChange={(e) => setReceivingCode(e.target.value)} />
          </Field>
        </div>
        <button
          className={`${primaryButton} mt-4 w-full`}
          disabled={!Number(productId) || !serialNumber.trim() || receivingCode.trim().length < 8}
          onClick={registerSale}
        >
          <Sparkles className="h-4 w-4" /> Record sale (ZK)
        </button>
      </Card>

      <Card>
        <div className="mb-4 flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-sky-300" />
          <h2 className="text-sm font-bold text-slate-200">Transfer ownership</h2>
        </div>
        <p className="mb-4 text-xs leading-relaxed text-slate-500">
          For resales: enter the product and the new owner's receiving code.
        </p>
        <div className="space-y-3">
          <Field label="Product id">
            <input className={inputClass} placeholder="1" value={transferId} onChange={(e) => setTransferId(e.target.value)} />
          </Field>
          <Field label="New owner receiving code">
            <input className={`${inputClass} font-mono text-xs`} placeholder="0x…" value={transferCode} onChange={(e) => setTransferCode(e.target.value)} />
          </Field>
        </div>
        <button
          className={`${primaryButton} mt-4 w-full`}
          disabled={!Number(transferId) || transferCode.trim().length < 8}
          onClick={transferOwnership}
        >
          Transfer ownership
        </button>
      </Card>
    </div>
  );
};

