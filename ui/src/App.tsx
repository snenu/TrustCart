import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Activity,
  ArrowDown,
  ArrowRight,
  BadgeCheck,
  BadgeX,
  Boxes,
  Check,
  CheckCircle2,
  ChevronRight,
  Clipboard,
  Copy,
  ExternalLink,
  Fingerprint,
  Globe2,
  KeyRound,
  Layers3,
  Loader2,
  LockKeyhole,
  LogOut,
  PackageCheck,
  PackageSearch,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Store,
  Tag,
  Wallet,
  Wrench,
} from "lucide-react";
import type { InitialAPI } from "@midnight-ntwrk/dapp-connector-api";
import {
  beginWalletConnection,
  listCompatibleWallets,
  type WalletOption,
} from "./wallet-connector";
import { BrowserTrustCartManager, type WalletSummary } from "./browser-manager";
import {
  ProductStatus,
  TrustCartAPI,
  dateToEpoch,
  formatEpochDate,
  productCommitmentForSerial,
  type ManufacturerView,
  type ProductView,
  type SellerView,
  type TrustCartDerivedState,
  type WarrantyView,
} from "../../api/src/index";
import { TrustCartPublicReader } from "../../api/src/public-reader";
import { isValidPrivacyPassphrase } from "./privacy-key";
import type { Subscription } from "rxjs";

const NETWORK_ID = (import.meta.env.VITE_NETWORK_ID ?? "preprod") as string;
const PUBLIC_INDEXER_URI =
  import.meta.env.VITE_PUBLIC_INDEXER_URI ??
  "https://indexer.preprod.midnight.network/api/v4/graphql";
const PUBLIC_INDEXER_WS_URI =
  import.meta.env.VITE_PUBLIC_INDEXER_WS_URI ??
  "wss://indexer.preprod.midnight.network/api/v4/graphql/ws";
// This is a public Preprod contract address, not a secret. The environment variable
// remains the override so a future registry deployment can be promoted without a UI change.
const BUILT_IN_PREPROD_CONTRACT_ADDRESS =
  "a6d78d3f68af39016a32258854cfab473024126eb594f9eff41f57e81b3c7bae";
const DEFAULT_CONTRACT_ADDRESS = (
  import.meta.env.VITE_DEFAULT_CONTRACT_ADDRESS ??
  BUILT_IN_PREPROD_CONTRACT_ADDRESS
).trim();
const CONTRACT_ADDRESS_KEY = "trustcart:contract-address:v2";
type TabId =
  | "overview"
  | "verify"
  | "manufacture"
  | "sell"
  | "own"
  | "settings";
const ZERO_COMMITMENT = "0".repeat(64);
type Toast = {
  id: number;
  kind: "ok" | "err" | "info";
  text: string;
  href?: string;
};
type ToastFn = (
  kind: Toast["kind"],
  text: string,
  options?: { href?: string },
) => void;
type Session = {
  manager: BrowserTrustCartManager;
  summary: WalletSummary;
  secretHex: string;
  receivingCode: string;
};

const readInjectedWallets = (): Record<string, InitialAPI | undefined> => {
  const injected = (
    globalThis as unknown as {
      midnight?: Record<string, InitialAPI | undefined>;
    }
  ).midnight;
  return injected ?? {};
};
const shortHex = (value: string, size = 8) =>
  value.length > size * 2 + 1
    ? `${value.slice(0, size)}...${value.slice(-size)}`
    : value;
const clockTime = (date: Date) =>
  date.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
const explorerTx = (txId: string) =>
  `https://explorer.1am.xyz/tx/${txId}?network=${NETWORK_ID}`;
const isReceivingCode = (value: string) => /^[\da-f]{64}$/i.test(value.trim());
const today = () => new Date().toISOString().slice(0, 10);
const icon = "h-4 w-4";
const primary = "button button-primary";
const secondary = "button button-secondary";
const danger = "button button-danger";
const input = "field";
const STATUS: Record<ProductStatus, { label: string; tone: string }> = {
  [ProductStatus.ACTIVE]: { label: "Active", tone: "status-active" },
  [ProductStatus.STOLEN]: { label: "Stolen", tone: "status-danger" },
  [ProductStatus.LOST]: { label: "Lost", tone: "status-warn" },
  [ProductStatus.RECALLED]: { label: "Recalled", tone: "status-warn" },
  [ProductStatus.COUNTERFEIT]: { label: "Counterfeit", tone: "status-danger" },
};
const statusOptions = [
  [ProductStatus.STOLEN, "Stolen"],
  [ProductStatus.LOST, "Lost"],
  [ProductStatus.RECALLED, "Recalled"],
  [ProductStatus.COUNTERFEIT, "Counterfeit"],
] as const;

// Turns circuit assert messages into guidance the user can actually act on.
const friendlyError = (message: string): string => {
  const lower = message.toLowerCase();
  if (lower.includes("manufacturer not found"))
    return "That manufacturer ID is not on this TrustCart contract yet. Register the identity first, then wait a few seconds for the registry to sync.";
  if (lower.includes("manufacturer identity is already registered"))
    return "This wallet already holds a manufacturer identity on this contract.";
  if (lower.includes("manufacturer authorization failed"))
    return "This wallet is not the manufacturer for that entry. Switch to the wallet that registered it.";
  if (lower.includes("seller identity is already registered"))
    return "This wallet already holds a seller identity on this contract.";
  if (lower.includes("seller is not authorized"))
    return "The manufacturer has not authorized this store yet. Ask the manufacturer wallet to authorize it, then retry.";
  if (lower.includes("seller authorization failed"))
    return "This wallet is not that authorized seller. Switch to the wallet that registered the store.";
  if (lower.includes("seller belongs to another manufacturer"))
    return "That seller belongs to a different manufacturer.";
  if (lower.includes("seller not found"))
    return "That seller ID is not on this TrustCart contract. Register the store first, then wait for the registry to sync.";
  if (lower.includes("product not found"))
    return "That product ID is not on this TrustCart contract. Check the ID in your catalog after the registry syncs.";
  if (lower.includes("product is already"))
    return "That product already has a sale record on chain.";
  if (lower.includes("product serial is already registered"))
    return "A product with that serial is already committed. Each serial can only be registered once.";
  if (lower.includes("serial secret is required"))
    return "Enter the private serial before committing a product.";
  if (lower.includes("product status blocks transfer"))
    return "Transfers are blocked because the product status is not active.";
  if (lower.includes("product has no registered owner"))
    return "This product has no owner yet. A sale must be recorded first.";
  if (lower.includes("ownership proof failed"))
    return "This wallet is not the current owner of that product.";
  if (lower.includes("recipient ownership proof failed"))
    return "This wallet is not the pending recipient of that transfer. Import the private state of the receiving code first.";
  if (lower.includes("another ownership transfer is already pending"))
    return "A transfer is already pending for this product. Cancel it first or wait for acceptance.";
  if (lower.includes("no ownership transfer is pending"))
    return "There is no pending transfer for this product anymore.";
  if (lower.includes("new owner must be different"))
    return "The receiving code must belong to a different owner.";
  if (lower.includes("buyer credential is required") || lower.includes("new owner credential is required"))
    return "A valid 32-byte receiving code is required. Copy it from the other TrustCart wallet.";
  if (lower.includes("terminal product status"))
    return "Stolen, lost, recalled, or counterfeit products cannot be set back to active.";
  if (lower.includes("warranty is already cancelled"))
    return "The warranty was already cancelled.";
  if (lower.includes("warranty is cancelled"))
    return "The warranty is cancelled and can no longer be extended.";
  if (lower.includes("no warranty record"))
    return "There is no warranty on this product yet. A warranty is issued when the sale is recorded.";
  if (lower.includes("extension must be positive"))
    return "The extension must be at least one month.";
  if (lower.includes("sale date cannot be in the future"))
    return "Pick a sale date that is today or earlier.";
  if (lower.includes("already has a sale record"))
    return "That product already has a sale record on chain.";
  if (lower.includes("product is not active"))
    return "Only active products can be sold. Check the product status first.";
  if (
    lower.includes("no compatible midnight wallet") ||
    lower.includes("proof server") ||
    lower.includes("timed out")
  )
    return message;
  return message;
};

function Spinner() {
  return <Loader2 className="h-4 w-4 animate-spin" />;
}
function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="field-wrap">
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}
function StatusChip({ status }: { status: ProductStatus }) {
  const meta = STATUS[status];
  return <span className={`status-chip ${meta.tone}`}>{meta.label}</span>;
}
function Card({
  children,
  className = "",
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <motion.section
      className={`panel ${className}`}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay }}
    >
      {children}
    </motion.section>
  );
}
function Heading({
  icon: Icon,
  eyebrow,
  title,
  detail,
}: {
  icon: typeof Boxes;
  eyebrow?: string;
  title: string;
  detail?: string;
}) {
  return (
    <div className="panel-heading">
      <span className="panel-icon">
        <Icon className={icon} />
      </span>
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h2>{title}</h2>
        {detail && <p className="panel-detail">{detail}</p>}
      </div>
    </div>
  );
}
function Empty({
  icon: Icon,
  title,
  detail,
}: {
  icon: typeof Boxes;
  title: string;
  detail: string;
}) {
  return (
    <div className="empty-state">
      <Icon className="h-5 w-5" />
      <strong>{title}</strong>
      <p>{detail}</p>
    </div>
  );
}
function Row({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="data-row">
      <dt>{label}</dt>
      <dd className={mono ? "mono" : ""}>{value}</dd>
    </div>
  );
}
function ProductLine({
  product,
  state,
  commitment = false,
  note,
  onPick,
}: {
  product: ProductView;
  state: TrustCartDerivedState;
  commitment?: boolean;
  note?: string;
  onPick?: () => void;
}) {
  const mfr = state.manufacturers.find((m) => m.id === product.mfrId);
  const body = (
    <>
      <span className="product-avatar">
        <PackageCheck className={icon} />
      </span>
      <span className="product-copy">
        <strong>
          {mfr?.brand ?? "Unknown brand"} / {product.model}
        </strong>
        <small>
          #{product.id} · {product.category} · {product.warrantyMonths} month
          warranty
        </small>
        {commitment && <code>{shortHex(product.productCommitment, 10)}</code>}
      </span>
      {note && (
        <span className={`product-note ${product.status === ProductStatus.ACTIVE ? "" : "warn"}`}>
          {note}
        </span>
      )}
      <StatusChip status={product.status} />
    </>
  );
  if (!onPick) return <div className="product-line">{body}</div>;
  return (
    <button
      className="product-line clickable"
      type="button"
      onClick={onPick}
      title="Use this product in the forms above"
    >
      {body}
    </button>
  );
}
function Toasts({ toasts }: { toasts: Toast[] }) {
  return (
    <div className="toast-stack" role="status" aria-live="polite">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            className={`toast toast-${t.kind}`}
            initial={{ opacity: 0, x: 18 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 18 }}
          >
            {t.kind === "ok" ? (
              <CheckCircle2 className={icon} />
            ) : t.kind === "err" ? (
              <BadgeX className={icon} />
            ) : (
              <Activity className={icon} />
            )}
            <span>
              {t.text}
              {t.href && (
                <a className="toast-link" href={t.href} target="_blank" rel="noreferrer">
                  View on explorer <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

function ConnectScreen({
  onConnect,
  busy,
  error,
}: {
  onConnect: (id?: string) => void;
  busy: boolean;
  error: string | null;
}) {
  const [options, setOptions] = useState<WalletOption[]>(() =>
    listCompatibleWallets(readInjectedWallets()),
  );
  useEffect(() => {
    const refresh = () =>
      setOptions(listCompatibleWallets(readInjectedWallets()));
    refresh();
    const timer = window.setInterval(refresh, 1_000);
    return () => window.clearInterval(timer);
  }, []);
  const trustPoints = [
    {
      title: "Private by design",
      text: "Serials, prices, and identity stay in your browser.",
    },
    {
      title: "Proofs on chain",
      text: "Authenticity and ownership settle through Midnight.",
    },
    {
      title: "Built for resale",
      text: "Transfer a product passport without exposing a wallet.",
    },
  ];
  const steps = [
    {
      number: "01",
      title: "Connect your wallet",
      text: "Use a compatible Midnight wallet on Preprod. TrustCart joins the live registry automatically.",
      icon: Wallet,
    },
    {
      number: "02",
      title: "Create a proof",
      text: "Register or verify products with private inputs that never become public serial records.",
      icon: Fingerprint,
    },
    {
      number: "03",
      title: "Carry the passport",
      text: "Keep warranty and ownership state verifiable as a product moves from seller to buyer.",
      icon: BadgeCheck,
    },
  ];
  return (
    <main className="landing-page" id="top">
      <div className="landing-bg-grid" />
      <div className="landing-glow landing-glow-one" />
      <div className="landing-glow landing-glow-two" />
      <nav className="landing-nav" aria-label="Main navigation">
        <a
          className="brand-lockup large"
          href="#top"
          aria-label="TrustCart home"
        >
          <span className="brand-mark">
            <ShieldCheck className="h-6 w-6" />
          </span>
          <span>
            trust<span>cart</span>
          </span>
        </a>
        <div className="landing-nav-links">
          <a href="#why-trustcart">Why TrustCart</a>
          <a href="#how-it-works">How it works</a>
          <a href="#verify">Verify</a>
        </div>
        <div className="landing-nav-actions">
          <span className="network-status">
            <span className="live-dot" />
            {NETWORK_ID.toUpperCase()}
          </span>
          <button
            className="button button-nav"
            disabled={busy}
            onClick={() => onConnect()}
          >
            {busy ? <Spinner /> : <Wallet className={icon} />}
            {busy ? "Opening..." : "Connect wallet"}
          </button>
        </div>
      </nav>
      <motion.section
        className="landing-hero"
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
      >
        <div className="landing-hero-copy">
          <p className="kicker">PRIVATE PRODUCT PROOF / MIDNIGHT PREPROD</p>
          <h1>
            Trust what you buy.
            <br />
            <em>Keep what is yours.</em>
          </h1>
          <p className="landing-hero-lede">
            TrustCart is a private product passport for authenticity, ownership,
            and warranty checks. The chain sees commitments and state. Your
            sensitive details stay yours.
          </p>
          <div className="hero-actions">
            <button
              className={`${primary} connect-button`}
              disabled={busy}
              onClick={() => onConnect()}
            >
              {busy ? <Spinner /> : <Wallet className={icon} />}
              {busy ? "Opening wallet..." : "Connect Midnight wallet"}
              <ArrowRight className="h-4 w-4" />
            </button>
            <a className={`${secondary} button`} href="#how-it-works">
              <ArrowDown className={icon} />
              See how it works
            </a>
          </div>
          {options.length > 1 && (
            <div className="wallet-options">
              {options.map(({ id, wallet }) => (
                <button
                  className={secondary}
                  key={id}
                  disabled={busy}
                  onClick={() => onConnect(id)}
                >
                  Use {wallet.name}
                </button>
              ))}
            </div>
          )}
          {error && (
            <div className="inline-error">
              <BadgeX className={icon} />
              {error}
            </div>
          )}
          <div className="hero-trustline">
            <span className="live-dot" />
            Live registry ready
            <span className="trust-divider" />
            Local proving
            <span className="trust-divider" />
            No serial uploads
          </div>
        </div>
        <div
          className="landing-hero-visual"
          aria-label="TrustCart product proof preview"
        >
          <div className="proof-console">
            <div className="proof-console-top">
              <span className="console-kicker">
                <span className="live-dot" />
                LIVE REGISTRY
              </span>
              <span className="console-network">{NETWORK_ID}</span>
            </div>
            <div className="proof-console-body">
              <div className="proof-rings">
                <div className="proof-ring ring-a" />
                <div className="proof-ring ring-b" />
                <div className="proof-seal">
                  <ShieldCheck className="h-7 w-7" />
                </div>
              </div>
              <p className="eyebrow">PRODUCT PASSPORT</p>
              <h2>Proof, without exposure.</h2>
              <p>
                One private record for authenticity, warranty, and ownership.
              </p>
              <div className="proof-console-list">
                <div>
                  <span>Serial commitment</span>
                  <strong>Verified</strong>
                </div>
                <div>
                  <span>Owner identity</span>
                  <strong>Hidden</strong>
                </div>
                <div>
                  <span>Warranty state</span>
                  <strong>On chain</strong>
                </div>
              </div>
            </div>
            <div className="proof-console-bottom">
              <span>
                <Sparkles className="h-3.5 w-3.5" />
                ZERO-KNOWLEDGE READY
              </span>
              <code>TRUSTCART / {NETWORK_ID.toUpperCase()}</code>
            </div>
          </div>
        </div>
      </motion.section>
      <section className="landing-section intro-section" id="why-trustcart">
        <div className="section-heading">
          <div>
            <p className="kicker">THE TRUST LAYER</p>
            <h2>Commerce gets easier when proof travels with the product.</h2>
          </div>
          <p>
            TrustCart gives manufacturers, sellers, and buyers a shared source
            of truth without asking anyone to publish the private data behind
            it.
          </p>
        </div>
        <div className="trust-grid">
          {trustPoints.map(({ title, text }, index) => (
            <motion.article
              className="trust-card"
              key={title}
              whileHover={{ y: -4 }}
            >
              <span className="trust-card-number">0{index + 1}</span>
              <div className="trust-card-mark">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <h3>{title}</h3>
              <p>{text}</p>
            </motion.article>
          ))}
        </div>
      </section>
      <section className="landing-section workflow-section" id="how-it-works">
        <div className="section-heading centered-heading">
          <div>
            <p className="kicker">A SIMPLE FLOW</p>
            <h2>From first proof to final handoff.</h2>
          </div>
          <p>
            Everything important happens through wallet-signed transactions and
            Midnight zero-knowledge proofs.
          </p>
        </div>
        <div className="workflow-grid">
          {steps.map(({ number, title, text, icon: StepIcon }) => (
            <article className="workflow-step" key={number}>
              <span className="workflow-number">{number}</span>
              <span className="workflow-icon">
                <StepIcon className="h-5 w-5" />
              </span>
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>
      <section className="landing-section privacy-section" id="privacy">
        <div className="privacy-layout">
          <div>
            <p className="kicker">PRIVACY THAT DOES THE WORK</p>
            <h2>Share confidence, not your customer file.</h2>
            <p>
              TrustCart uses commitments and local proving so a verifier can
              learn what matters about a product without learning everything
              about the people behind it.
            </p>
            <a className={`${secondary} button`} href="#verify">
              <PackageSearch className={icon} />
              Try the public verifier
            </a>
          </div>
          <div className="privacy-list">
            <div>
              <LockKeyhole className={icon} />
              <span>
                <strong>Private inputs</strong>
                <small>
                  Serials and receiving secrets stay on the device that knows
                  them.
                </small>
              </span>
            </div>
            <div>
              <Globe2 className={icon} />
              <span>
                <strong>Public state</strong>
                <small>
                  Registry facts remain readable through the Midnight indexer.
                </small>
              </span>
            </div>
            <div>
              <Layers3 className={icon} />
              <span>
                <strong>Portable ownership</strong>
                <small>
                  Pass a product passport forward without revealing wallet
                  identity.
                </small>
              </span>
            </div>
          </div>
        </div>
      </section>
      <section className="landing-verify" id="verify">
        <PublicVerification />
      </section>
      <footer className="landing-footer">
        <div className="footer-main">
          <div>
            <a className="brand-lockup" href="#top">
              <span className="brand-mark">
                <ShieldCheck className="h-4 w-4" />
              </span>
              <span>
                trust<span>cart</span>
              </span>
            </a>
            <p>Private product proof for the real world.</p>
          </div>
          <div className="footer-links">
            <span className="eyebrow">EXPLORE</span>
            <a href="#why-trustcart">Why TrustCart</a>
            <a href="#how-it-works">How it works</a>
            <a href="#verify">Verify a product</a>
          </div>
          <div className="footer-links">
            <span className="eyebrow">NETWORK</span>
            <a
              href="https://docs.midnight.network/"
              target="_blank"
              rel="noreferrer"
            >
              Midnight docs <ExternalLink className="h-3 w-3" />
            </a>
            <a
              href="https://explorer.1am.xyz/?network=preprod"
              target="_blank"
              rel="noreferrer"
            >
              Preprod explorer <ExternalLink className="h-3 w-3" />
            </a>
            <span className="footer-network">
              <span className="live-dot" />
              {NETWORK_ID}
            </span>
          </div>
        </div>
        <div className="footer-bottom">
          <span>TrustCart / {NETWORK_ID.toUpperCase()}</span>
          <span>Proofs generated locally. Registry state on chain.</span>
        </div>
      </footer>
    </main>
  );
}

function PublicVerification() {
  const [contractAddress, setContractAddress] = useState(
    DEFAULT_CONTRACT_ADDRESS,
  );
  const [serial, setSerial] = useState("");
  const [state, setState] = useState<TrustCartDerivedState | null>(null);
  const [message, setMessage] = useState(
    DEFAULT_CONTRACT_ADDRESS
      ? "Live TrustCart registry is ready. Add a serial to verify."
      : "Paste a contract address to read its public registry.",
  );
  const [busy, setBusy] = useState(false);
  const subscriptionRef = useRef<Subscription | null>(null);
  useEffect(
    () => () => {
      subscriptionRef.current?.unsubscribe();
    },
    [],
  );
  const readRegistry = () => {
    if (!contractAddress.trim()) {
      setMessage("A contract address is required.");
      return;
    }
    setBusy(true);
    setMessage("Reading the public registry...");
    const reader = new TrustCartPublicReader(
      PUBLIC_INDEXER_URI,
      PUBLIC_INDEXER_WS_URI,
      contractAddress.trim(),
    );
    subscriptionRef.current?.unsubscribe();
    const subscription = reader.state$.subscribe({
      next: (next) => {
        setState(next);
        setBusy(false);
        setMessage(
          `Registry loaded · ${next.productCount} products · ${next.manufacturerCount} brands. Your serial stays in this browser.`,
        );
      },
      error: () => {
        setBusy(false);
        setMessage(
          "The registry could not be read. Check the contract address and network.",
        );
      },
    });
    subscriptionRef.current = subscription;
    window.setTimeout(() => subscription.unsubscribe(), 60_000);
  };
  const match =
    state && serial.trim()
      ? state.products.find(
          (product) =>
            product.productCommitment ===
            productCommitmentForSerial(serial.trim()),
        )
      : undefined;
  return (
    <section className="public-verifier">
      <div>
        <p className="kicker">PUBLIC VERIFIER</p>
        <h2>Check a product without connecting a wallet.</h2>
        <p>
          Read-only verification uses the public indexer. The serial is hashed
          locally and never submitted.
        </p>
      </div>
      <div className="public-verifier-fields">
        <input
          className={input}
          value={contractAddress}
          onChange={(e) => setContractAddress(e.target.value)}
          placeholder={shortHex(DEFAULT_CONTRACT_ADDRESS, 20)}
          aria-label="Contract address"
        />
        <input
          className={input}
          value={serial}
          onChange={(e) => setSerial(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && readRegistry()}
          placeholder="Product serial"
          aria-label="Product serial"
        />
        <button
          className={secondary}
          disabled={busy || !contractAddress.trim()}
          onClick={readRegistry}
        >
          {busy ? <Spinner /> : <PackageSearch className={icon} />}Read registry
        </button>
      </div>
      <p className="public-verifier-message">{message}</p>
      {match && (
        <div className="public-verifier-result">
          <CheckCircle2 className={icon} />
          <span>
            <strong>Commitment matched</strong>
            {match.model} · {match.category} · {STATUS[match.status].label}
          </span>
        </div>
      )}
      {state && serial.trim() && !match && (
        <div className="public-verifier-result verifier-error">
          <BadgeX className={icon} />
          <span>No registered product matches that serial.</span>
        </div>
      )}
    </section>
  );
}

function Setup({
  session,
  ready,
  toast,
}: {
  session: Session;
  ready: (api: TrustCartAPI) => void;
  toast: ToastFn;
}) {
  const [address, setAddress] = useState("");
  const [busy, setBusy] = useState<"deploy" | "join" | null>(null);
  const act = async (kind: "deploy" | "join") => {
    setBusy(kind);
    try {
      const api =
        kind === "deploy"
          ? await session.manager.deploy()
          : await session.manager.join(address.trim());
      localStorage.setItem(CONTRACT_ADDRESS_KEY, api.deployedContractAddress);
      toast(
        "ok",
        kind === "deploy"
          ? "Contract deployed on preprod."
          : "Connected to the contract.",
      );
      ready(api);
    } catch (e) {
      toast("err", e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };
  return (
    <div className="setup-wrap">
      <Card className="setup-card">
        <span className="setup-number">01</span>
        <p className="kicker">DEVELOPER SETUP</p>
        <h1>Connect a TrustCart registry</h1>
        <p className="setup-copy">
          The public app normally connects to the live TrustCart registry
          automatically. This fallback is for local administrators configuring a
          new environment.
        </p>
        <button
          className={`${primary} wide-button`}
          disabled={busy !== null}
          onClick={() => void act("deploy")}
        >
          {busy === "deploy" ? <Spinner /> : <ShieldCheck className={icon} />}
          Deploy new registry
        </button>
        <div className="or-rule">
          <span>or connect an existing registry</span>
        </div>
        <Field
          label="Contract address"
          hint="Paste the full Midnight contract address."
        >
          <input
            className={`${input} mono`}
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="a6d78d3f..."
          />
        </Field>
        <button
          className={`${secondary} wide-button`}
          disabled={busy !== null || !address.trim()}
          onClick={() => void act("join")}
        >
          {busy === "join" ? <Spinner /> : <ChevronRight className={icon} />}
          Connect registry
        </button>
        <div className="setup-note">
          <LockKeyhole className={icon} />
          <span>Private state is scoped to this wallet and contract.</span>
        </div>
      </Card>
      <p className="connection-summary">
        <span className="live-dot" />
        {session.summary.name} connected on{" "}
        <strong>{session.summary.networkId}</strong>
        <span className="mono">
          {shortHex(session.summary.unshieldedAddress, 10)}
        </span>
      </p>
    </div>
  );
}

const TABS: { id: TabId; label: string; icon: typeof Boxes; desc: string }[] = [
  { id: "overview", label: "Overview", icon: Boxes, desc: "Network snapshot" },
  {
    id: "verify",
    label: "Verify product",
    icon: PackageSearch,
    desc: "Private authenticity check",
  },
  {
    id: "manufacture",
    label: "Manufacturer",
    icon: Wrench,
    desc: "Products and warranties",
  },
  {
    id: "sell",
    label: "Seller desk",
    icon: Store,
    desc: "Authorizations and sales",
  },
  {
    id: "own",
    label: "My ownership",
    icon: KeyRound,
    desc: "Private passport",
  },
  {
    id: "settings",
    label: "Settings",
    icon: LockKeyhole,
    desc: "Wallet and contract",
  },
];
type Run = (
  label: string,
  action: () => Promise<string | void>,
) => Promise<void>;

function Dashboard({
  api,
  session,
  state,
  lastSync,
  toast,
}: {
  api: TrustCartAPI;
  session: Session;
  state: TrustCartDerivedState;
  lastSync: Date | null;
  toast: ToastFn;
}) {
  const [tab, setTab] = useState<TabId>("overview");
  const [joining, setJoining] = useState("");
  const disconnect = () => window.location.reload();
  const mfr = state.manufacturers.find(
    (m) => m.mfrHash === api.mfrCommitment(session.secretHex),
  );
  const seller = state.sellers.find(
    (s) => s.sellerHash === api.sellerCommitment(session.secretHex),
  );
  const active = TABS.find((t) => t.id === tab)!;
  const run: Run = useCallback(
    async (label, action) => {
      toast("info", `${label} is generating a proof.`);
      try {
        const txId = await action();
        toast(
          "ok",
          txId
            ? `${label} submitted · ${shortHex(txId, 8)}`
            : `${label} submitted.`,
          txId ? { href: explorerTx(txId) } : undefined,
        );
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        toast("err", friendlyError(message));
      }
    },
    [toast],
  );
  const join = () =>
    void run("Join contract", async () => {
      const next = await session.manager.join(joining.trim());
      localStorage.setItem(CONTRACT_ADDRESS_KEY, next.deployedContractAddress);
      window.location.reload();
    });
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-lockup">
          <span className="brand-mark">
            <ShieldCheck className="h-4 w-4" />
          </span>
          <span>
            trust<span>cart</span>
          </span>
        </div>
        <div className="side-network">
          <span className="live-dot" />
          PREPROD <small>PRIVATE REGISTRY</small>
        </div>
        <nav className="side-nav">
          {TABS.map(({ id, label, icon: Icon, desc }) => (
            <button
              className={`nav-item ${tab === id ? "selected" : ""}`}
              key={id}
              onClick={() => setTab(id)}
              aria-current={tab === id ? "page" : undefined}
            >
              <Icon className={icon} />
              <span>
                <strong>{label}</strong>
                <small>{desc}</small>
              </span>
              {tab === id && <ChevronRight className="nav-arrow" />}
            </button>
          ))}
        </nav>
        <div className="side-bottom">
          <div className="privacy-card">
            <LockKeyhole className={icon} />
            <div>
              <strong>Private by default</strong>
              <span>Secrets stay in this browser.</span>
            </div>
          </div>
          <div className="side-version">
            MIDNIGHT / {NETWORK_ID.toUpperCase()}
          </div>
        </div>
      </aside>
      <main className="workspace">
        <header className="topbar">
          <div className="mobile-brand brand-lockup">
            <span className="brand-mark">
              <ShieldCheck className="h-4 w-4" />
            </span>
            <span>
              trust<span>cart</span>
            </span>
          </div>
          <div className="crumb">
            TRUSTCART <ChevronRight className="h-3 w-3" />{" "}
            <strong>{active.label.toUpperCase()}</strong>
          </div>
          {lastSync && (
            <div className="sync-pill" title="Last registry sync from the Midnight indexer">
              <span className="live-dot" />
              SYNCED {clockTime(lastSync)}
            </div>
          )}
          <div className="wallet-pill">
            <span className="live-dot" />
            <span>{session.summary.name}</span>
            <code>{shortHex(session.summary.unshieldedAddress, 5)}</code>
          </div>
          <button
            className="button button-nav disconnect"
            onClick={disconnect}
            aria-label="Disconnect wallet and reload"
            title="Disconnect wallet"
          >
            <LogOut className={icon} />
            <span className="disconnect-label">Disconnect</span>
          </button>
        </header>
        <div className="content-wrap">
          <AnimatePresence mode="wait">
            <motion.div
              key={tab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              {tab === "overview" && (
                <Overview
                  api={api}
                  state={state}
                  session={session}
                  mfr={mfr}
                  seller={seller}
                  navigate={setTab}
                />
              )}
              {tab === "verify" && <Verify api={api} state={state} />}
              {tab === "manufacture" && (
                <Manufacture api={api} state={state} run={run} mfr={mfr} />
              )}
              {tab === "sell" && (
                <Sell api={api} state={state} run={run} seller={seller} />
              )}
              {tab === "own" && (
                <Own api={api} state={state} run={run} session={session} />
              )}
              {tab === "settings" && (
                <Settings
                  api={api}
                  manager={session.manager}
                  summary={session.summary}
                  joining={joining}
                  setJoining={setJoining}
                  join={join}
                  toast={toast}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}

function Intro({
  eyebrow,
  title,
  detail,
  action,
}: {
  eyebrow: string;
  title: string;
  detail: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="page-intro">
      <div>
        <p className="kicker">{eyebrow}</p>
        <h1>{title}</h1>
        <p>{detail}</p>
      </div>
      {action}
    </div>
  );
}
function Metric({
  label,
  value,
  detail,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  detail: string;
  icon: typeof Boxes;
}) {
  return (
    <motion.div className="metric" whileHover={{ y: -2 }}>
      <div className="metric-top">
        <span>{label}</span>
        <Icon className={icon} />
      </div>
      <strong>{value}</strong>
      <small>{detail}</small>
    </motion.div>
  );
}
function Action({
  icon: Icon,
  title,
  text,
  click,
}: {
  icon: typeof Boxes;
  title: string;
  text: string;
  click: () => void;
}) {
  return (
    <button className="action-card" onClick={click}>
      <span className="action-icon">
        <Icon className={icon} />
      </span>
      <span>
        <strong>{title}</strong>
        <small>{text}</small>
      </span>
      <ArrowRight className="action-arrow" />
    </button>
  );
}

function Overview({
  api,
  state,
  session,
  mfr,
  seller,
  navigate,
}: {
  api: TrustCartAPI;
  state: TrustCartDerivedState;
  session: Session;
  mfr?: ManufacturerView;
  seller?: SellerView;
  navigate: (tab: TabId) => void;
}) {
  const owned = state.products.filter((p) =>
    api.ownsProduct(p, session.secretHex),
  );
  const warranties = owned
    .map((p) => state.warranties.find((w) => w.id === p.warrantyId))
    .filter((w): w is WarrantyView =>
      Boolean(w && !w.cancelled && w.expiresAt > Date.now() / 1000),
    );
  return (
    <>
      <Intro
        eyebrow="NETWORK SNAPSHOT"
        title="Good to see you."
        detail="A live view of the private product registry your wallet can prove against."
        action={
          <div className="chain-badge">
            <span className="live-dot" />
            <div>
              <small>SYNCED TO</small>
              <strong>{session.summary.networkId}</strong>
            </div>
          </div>
        }
      />
      <div className="metric-grid">
        <Metric
          label="Products"
          value={state.productCount}
          detail="registered commitments"
          icon={Boxes}
        />
        <Metric
          label="Manufacturers"
          value={state.manufacturerCount}
          detail="verified brands"
          icon={Wrench}
        />
        <Metric
          label="Sellers"
          value={state.sellerCount}
          detail={`${state.sellers.filter((s) => s.authorized).length} authorized`}
          icon={Store}
        />
        <Metric
          label="Warranties"
          value={warranties.length}
          detail="active for this wallet"
          icon={BadgeCheck}
        />
      </div>
      <div className="overview-grid">
        <Card className="hero-panel">
          <div className="hero-label">
            <span className="live-dot" />
            CHAIN HEALTH / VERIFIED
          </div>
          <h2>
            Your proof layer is
            <br />
            <em>quietly working.</em>
          </h2>
          <p>
            TrustCart checks product commitments, seller authorization,
            ownership, and warranty state without exposing the private inputs
            behind them.
          </p>
          <div className="proof-lines">
            <div>
              <span>Public commitment</span>
              <strong>Registered</strong>
            </div>
            <div>
              <span>Private state</span>
              <strong>Local only</strong>
            </div>
            <div>
              <span>Network</span>
              <strong>{session.summary.networkId}</strong>
            </div>
          </div>
          <div className="hero-scan">
            <span className="scan-line" />
            PRIVATE STATE / READY
          </div>
        </Card>
        <Card className="passport-card">
          <div className="card-topline">
            <div>
              <p className="eyebrow">MY PASSPORT</p>
              <h2>
                {owned.length
                  ? `${owned.length} product${owned.length === 1 ? "" : "s"} in your care`
                  : "Your passport is ready"}
              </h2>
            </div>
            <Fingerprint className="h-5 w-5 muted" />
          </div>
          {owned.length ? (
            <div className="mini-list">
              {owned.slice(0, 3).map((p) => {
                const w = state.warranties.find((item) => item.id === p.warrantyId);
                const note =
                  !w || w.cancelled
                    ? undefined
                    : w.expiresAt > Date.now() / 1000
                      ? `Warranty until ${formatEpochDate(BigInt(w.expiresAt))}`
                      : "Warranty expired";
                return (
                  <ProductLine
                    key={p.id}
                    product={p}
                    state={state}
                    note={note}
                    onPick={() => navigate("own")}
                  />
                );
              })}
            </div>
          ) : (
            <Empty
              icon={Fingerprint}
              title="No ownership records yet"
              detail="When a seller registers a sale to your receiving code, your private passport appears here."
            />
          )}
        </Card>
      </div>
      <div className="section-row">
        <div>
          <p className="eyebrow">QUICK ACTIONS</p>
          <h2>Move a proof forward</h2>
        </div>
        <span className="section-note">
          Choose the surface that matches your role.
        </span>
      </div>
      <div className="action-grid">
        <Action
          icon={PackageSearch}
          title="Verify a product"
          text="Check authenticity with a serial that stays local."
          click={() => navigate("verify")}
        />
        <Action
          icon={Wrench}
          title="Register a product"
          text={
            mfr
              ? `Add a product for ${mfr.brand}.`
              : "Create a manufacturer identity and product commitment."
          }
          click={() => navigate("manufacture")}
        />
        <Action
          icon={Store}
          title="Record a sale"
          text={
            seller
              ? `Sell as ${seller.name}.`
              : "Set up a seller identity and request authorization."
          }
          click={() => navigate("sell")}
        />
      </div>
    </>
  );
}

function Verify({
  api,
  state,
}: {
  api: TrustCartAPI;
  state: TrustCartDerivedState;
}) {
  const [serial, setSerial] = useState("");
  const [result, setResult] = useState<ProductView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const check = () => {
    setResult(null);
    setError(null);
    try {
      const match = state.products.find((p) =>
        api.isAuthentic(p, serial.trim()),
      );
      if (!match) setError("No registered commitment matches that serial.");
      else setResult(match);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };
  const mfr = result && state.manufacturers.find((m) => m.id === result.mfrId);
  const warranty =
    result && state.warranties.find((w) => w.id === result.warrantyId);
  const live = Boolean(
    warranty && !warranty.cancelled && warranty.expiresAt > Date.now() / 1000,
  );
  return (
    <>
      <Intro
        eyebrow="SELECTIVE DISCLOSURE"
        title="Verify without oversharing."
        detail="The serial is encoded locally, then compared with the on-chain product commitment."
      />
      <div className="split-grid">
        <Card>
          <Heading
            icon={PackageSearch}
            eyebrow="PRODUCT CHECK"
            title="Run a private verification"
            detail="Raw serial data never enters the transaction."
          />
          <Field
            label="Serial number"
            hint="Trimmed and encoded locally before comparison."
          >
            <input
              className={input}
              value={serial}
              onChange={(e) => setSerial(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && check()}
              placeholder="SN-7C2K-9911"
            />
          </Field>
          <button
            className={`${primary} wide-button top-gap`}
            disabled={!serial.trim()}
            onClick={check}
          >
            <Fingerprint className={icon} />
            Verify against chain
          </button>
          {error && (
            <div className="inline-error top-gap">
              <BadgeX className={icon} />
              {error}
            </div>
          )}
          <div className="privacy-callout">
            <LockKeyhole className={icon} />
            <span>
              Your serial, identity, purchase price, and address stay hidden.
            </span>
          </div>
        </Card>
        <AnimatePresence mode="wait">
          {result ? (
            <motion.div
              key="result"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
            >
              <Card className="result-card">
                <div className="verified-banner">
                  <CheckCircle2 className="h-5 w-5" />
                  <div>
                    <p className="eyebrow">VERIFIED ON MIDNIGHT</p>
                    <h2>Genuine product</h2>
                  </div>
                  <StatusChip status={result.status} />
                </div>
                <div className="result-rows">
                  <Row label="Product" value={result.model} />
                  <Row label="Brand" value={mfr?.brand ?? "Unknown"} />
                  <Row label="Category" value={result.category} />
                  <Row label="Batch" value={result.batch} />
                  <Row
                    label="Warranty"
                    value={
                      result.warrantyId
                        ? live
                          ? `Valid until ${formatEpochDate(BigInt(warranty!.expiresAt))}`
                          : "Not active"
                        : "Not issued"
                    }
                  />
                  <Row
                    label="Ownership"
                    value={
                      result.sold
                        ? `Buyer held · v${result.ownershipVersion} · ${result.transfers} transfer${result.transfers === 1 ? "" : "s"}`
                        : "Awaiting first sale"
                    }
                  />
                  <Row
                    label="Commitment"
                    value={shortHex(result.productCommitment, 12)}
                    mono
                  />
                </div>
                <div className="proof-checks">
                  <span>
                    <Check className="h-3.5 w-3.5" />
                    Product registered
                  </span>
                  <span>
                    <Check className="h-3.5 w-3.5" />
                    Serial commitment matched
                  </span>
                  <span>
                    <Check className="h-3.5 w-3.5" />
                    {live ? "Warranty is active" : "Warranty needs review"}
                  </span>
                </div>
              </Card>
            </motion.div>
          ) : (
            <Card className="result-placeholder">
              <PackageSearch className="h-8 w-8" />
              <h2>Verification result</h2>
              <p>Enter a serial to see the smallest useful proof.</p>
            </Card>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}

function Manufacture({
  api,
  state,
  run,
  mfr,
}: {
  api: TrustCartAPI;
  state: TrustCartDerivedState;
  run: Run;
  mfr?: ManufacturerView;
}) {
  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [mfrId, setMfrId] = useState("");
  const [model, setModel] = useState("");
  const [category, setCategory] = useState("");
  const [batch, setBatch] = useState("");
  const [months, setMonths] = useState("24");
  const [serial, setSerial] = useState("");
  const [productId, setProductId] = useState("");
  const [status, setStatus] = useState<ProductStatus>(ProductStatus.RECALLED);
  const [extendId, setExtendId] = useState("");
  const [extra, setExtra] = useState("12");
  useEffect(() => {
    if (mfr) setMfrId(String(mfr.id));
  }, [mfr?.id]);
  const selectedMfr = state.manufacturers.find(
    (item) => item.id === Number(mfrId),
  );
  const productReady = Boolean(mfr && selectedMfr?.id === mfr.id);
  const mine = state.products.filter((p) => mfr && p.mfrId === mfr.id);
  const pickProduct = (pid: number) => {
    setProductId(String(pid));
    setExtendId(String(pid));
  };
  return (
    <>
      <Intro
        eyebrow="MANUFACTURER WORKSPACE"
        title="Make every product provable."
        detail="Register commitments, manage status, and keep warranty state verifiable from one manufacturer identity."
      />
      <div className="split-grid">
        <Card>
          <Heading
            icon={Wrench}
            eyebrow="IDENTITY"
            title="Register manufacturer"
            detail="Your manufacturer commitment comes from this wallet's private secret."
          />
          <div className="two-fields">
            <Field label="Account name">
              <input
                className={input}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Example Devices"
              />
            </Field>
            <Field label="Brand">
              <input
                className={input}
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                placeholder="Example Audio"
              />
            </Field>
          </div>
          <button
            className={`${primary} wide-button top-gap`}
            disabled={Boolean(mfr) || !name.trim() || !brand.trim()}
            onClick={() =>
              void run("Register manufacturer", () =>
                api.registerManufacturer({
                  name: name.trim(),
                  brand: brand.trim(),
                }),
              )
            }
          >
            <ShieldCheck className={icon} />
            {mfr ? "Identity registered" : "Register identity"}
          </button>
          {mfr && (
            <div className="success-line">
              <CheckCircle2 className={icon} />
              Active as <strong>{mfr.brand}</strong> · manufacturer #{mfr.id}
            </div>
          )}
        </Card>
        <Card>
          <Heading
            icon={Tag}
            eyebrow="REGISTRY"
            title="Register a product"
            detail="Only the serial commitment is disclosed. The serial stays private."
          />
          <div className="two-fields">
            <Field label="Manufacturer ID">
              <input
                className={input}
                value={mfrId}
                onChange={(e) => setMfrId(e.target.value)}
                placeholder={mfr ? String(mfr.id) : "Register identity first"}
              />
            </Field>
            <Field label="Model">
              <input
                className={input}
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="Aura Buds Pro"
              />
            </Field>
          </div>
          <div className="two-fields">
            <Field label="Category">
              <input
                className={input}
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="audio"
              />
            </Field>
            <Field label="Batch">
              <input
                className={input}
                value={batch}
                onChange={(e) => setBatch(e.target.value)}
                placeholder="B-2026-09"
              />
            </Field>
          </div>
          <div className="two-fields">
            <Field label="Warranty months">
              <input
                className={input}
                value={months}
                onChange={(e) => setMonths(e.target.value)}
              />
            </Field>
            <Field label="Private serial">
              <input
                className={input}
                value={serial}
                onChange={(e) => setSerial(e.target.value)}
                placeholder="SN-7C2K-9911"
              />
            </Field>
          </div>
          {!mfr && (
            <div className="inline-error top-gap">
              <BadgeX className={icon} />
              Register your manufacturer identity first. Product registration
              unlocks after the chain recognizes this wallet.
            </div>
          )}
          {mfr && !productReady && (
            <div className="inline-error top-gap">
              <BadgeX className={icon} />
              Manufacturer #{mfrId || "—"} is not the active on-chain
              manufacturer for this wallet. Use #{mfr.id}.
            </div>
          )}
          {productReady && (
            <p className="field-hint" style={{ marginTop: 12 }}>
              After committing a proof, the product appears in YOUR CATALOG once
              the registry syncs. Click a catalog item to reuse its ID in the
              status and warranty controls.
            </p>
          )}
          <button
            className={`${primary} wide-button top-gap`}
            disabled={
              !productReady ||
              !model.trim() ||
              !category.trim() ||
              !batch.trim() ||
              !serial.trim() ||
              Number(months) <= 0
            }
            onClick={() =>
              void run("Register product", async () => {
                const txId = await api.registerProduct({
                  mfrId: Number(mfrId),
                  model: model.trim(),
                  category: category.trim(),
                  batch: batch.trim(),
                  warrantyMonths: Number(months),
                  serialNumber: serial.trim(),
                });
                setSerial("");
                return txId;
              })
            }
          >
            <Fingerprint className={icon} />
            Commit product
          </button>
        </Card>
      </div>
      <div className="three-grid top-section">
        <Card>
          <Heading
            icon={Activity}
            eyebrow="STATUS CONTROL"
            title="Change product status"
            detail="Only the linked manufacturer wallet can update state."
          />
          <Field label="Product ID">
            <input
              className={input}
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              placeholder="1"
            />
          </Field>
          <Field label="New status">
            <select
              className={input}
              value={String(status)}
              onChange={(e) =>
                setStatus(Number(e.target.value) as ProductStatus)
              }
            >
              {statusOptions.map(([v, label]) => (
                <option key={v} value={v}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
          <button
            className={`${secondary} wide-button top-gap`}
            disabled={!Number(productId)}
            onClick={() =>
              void run("Update product status", () =>
                api.setProductStatus(Number(productId), status),
              )
            }
          >
            <RefreshCw className={icon} />
            Update status
          </button>
        </Card>
        <Card>
          <Heading
            icon={BadgeCheck}
            eyebrow="WARRANTY CONTROL"
            title="Extend or cancel"
            detail="Warranty state is public. Purchase documents are not."
          />
          <Field label="Product ID">
            <input
              className={input}
              value={extendId}
              onChange={(e) => setExtendId(e.target.value)}
              placeholder="1"
            />
          </Field>
          <Field label="Extra months">
            <input
              className={input}
              value={extra}
              onChange={(e) => setExtra(e.target.value)}
            />
          </Field>
          <div className="button-row top-gap">
            <button
              className={`${secondary} flex-1`}
              disabled={!Number(extendId) || Number(extra) <= 0}
              onClick={() =>
                void run("Extend warranty", () =>
                  api.extendWarranty(Number(extendId), Number(extra)),
                )
              }
            >
              Extend
            </button>
            <button
              className={`${danger} flex-1`}
              disabled={!Number(extendId)}
              onClick={() =>
                void run("Cancel warranty", () =>
                  api.cancelWarranty(Number(extendId)),
                )
              }
            >
              Cancel
            </button>
          </div>
        </Card>
        <Card>
          <Heading
            icon={Boxes}
            eyebrow="YOUR CATALOG"
            title={`${mine.length} registered`}
            detail="Products linked to this manufacturer."
          />
          {mine.length ? (
            <div className="mini-list">
              {mine.map((p) => (
                <ProductLine
                  key={p.id}
                  product={p}
                  state={state}
                  commitment
                  note={p.sold ? undefined : "Unsold"}
                  onPick={() => pickProduct(p.id)}
                />
              ))}
            </div>
          ) : (
            <Empty
              icon={Boxes}
              title="Catalog is empty"
              detail="Register your first product to create a passport."
            />
          )}
        </Card>
      </div>
    </>
  );
}

function Sell({
  api,
  state,
  run,
  seller,
}: {
  api: TrustCartAPI;
  state: TrustCartDerivedState;
  run: Run;
  seller?: SellerView;
}) {
  const [store, setStore] = useState("");
  const [mfrId, setMfrId] = useState("");
  const [sellerId, setSellerId] = useState("");
  const [authMfr, setAuthMfr] = useState("");
  const [productId, setProductId] = useState("");
  const [buyer, setBuyer] = useState("");
  const [date, setDate] = useState(today());
  const buyerReady = isReceivingCode(buyer);
  const inventory = seller
    ? state.products.filter(
        (p) =>
          p.mfrId === seller.mfrId &&
          !p.sold &&
          p.status === ProductStatus.ACTIVE,
      )
    : [];
  return (
    <>
      <Intro
        eyebrow="SELLER DESK"
        title="Move products with proof."
        detail="Authorize a seller, record a purchase, and issue a warranty without learning the buyer's identity."
        action={
          seller && (
            <div className="role-chip">
              <Store className={icon} />
              <span>
                {seller.name}
                <small>
                  {seller.authorized ? "AUTHORIZED" : "PENDING AUTHORIZATION"}
                </small>
              </span>
            </div>
          )
        }
      />
      <div className="split-grid">
        <Card>
          <Heading
            icon={Store}
            eyebrow="SELLER IDENTITY"
            title="Register a store"
            detail="The seller commitment comes from this wallet."
          />
          <Field label="Store name">
            <input
              className={input}
              value={store}
              onChange={(e) => setStore(e.target.value)}
              placeholder="GadgetHub"
            />
          </Field>
          <Field label="Manufacturer ID">
            <input
              className={input}
              value={mfrId}
              onChange={(e) => setMfrId(e.target.value)}
              placeholder="1"
            />
          </Field>
          <button
            className={`${primary} wide-button top-gap`}
            disabled={!store.trim() || !Number(mfrId)}
            onClick={() =>
              void run("Register seller", () =>
                api.registerSeller({
                  name: store.trim(),
                  mfrId: Number(mfrId),
                }),
              )
            }
          >
            <Store className={icon} />
            Register store
          </button>
          {seller && (
            <div className="success-line">
              <CheckCircle2 className={icon} />
              Seller #{seller.id} detected for <strong>{seller.name}</strong>
            </div>
          )}
        </Card>
        <Card>
          <Heading
            icon={BadgeCheck}
            eyebrow="MANUFACTURER CONTROL"
            title="Manage authorization"
            detail="These actions must be signed by the manufacturer wallet."
          />
          <div className="two-fields">
            <Field label="Manufacturer ID">
              <input
                className={input}
                value={authMfr}
                onChange={(e) => setAuthMfr(e.target.value)}
                placeholder="1"
              />
            </Field>
            <Field label="Seller ID">
              <input
                className={input}
                value={sellerId}
                onChange={(e) => setSellerId(e.target.value)}
                placeholder={seller ? String(seller.id) : "1"}
              />
            </Field>
          </div>
          <div className="button-row top-gap">
            <button
              className={`${primary} flex-1`}
              disabled={!Number(authMfr) || !Number(sellerId)}
              onClick={() =>
                void run("Authorize seller", () =>
                  api.authorizeSeller(Number(authMfr), Number(sellerId)),
                )
              }
            >
              Authorize
            </button>
            <button
              className={`${danger} flex-1`}
              disabled={!Number(authMfr) || !Number(sellerId)}
              onClick={() =>
                void run("Revoke seller", () =>
                  api.revokeSellerAuthorization(
                    Number(authMfr),
                    Number(sellerId),
                  ),
                )
              }
            >
              Revoke
            </button>
          </div>
        </Card>
      </div>
      <Card className="top-section">
        <Heading
          icon={Tag}
          eyebrow="PURCHASE RECORD"
          title="Record a sale and issue warranty"
          detail="The buyer shares a receiving commitment. Their wallet, identity, and price are never needed."
        />
        <div className="three-fields">
          <Field label="Seller ID">
            <input
              className={input}
              value={sellerId}
              onChange={(e) => setSellerId(e.target.value)}
              placeholder={seller ? String(seller.id) : "1"}
            />
          </Field>
          <Field label="Product ID">
            <input
              className={input}
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              placeholder="1"
            />
          </Field>
          <Field label="Sale date">
            <input
              className={input}
              type="date"
              max={today()}
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </Field>
        </div>
        <Field
          label="Buyer receiving code"
          hint="A 32-byte owner commitment copied from the buyer's TrustCart app."
        >
          <input
            className={`${input} mono`}
            value={buyer}
            onChange={(e) => setBuyer(e.target.value)}
            placeholder="32-byte hexadecimal commitment"
          />
        </Field>
        {buyer.trim().length > 0 && !buyerReady && (
          <p className="field-hint">
            Receiving codes are exactly 64 hexadecimal characters. Ask the buyer
            to copy it again from their My ownership tab.
          </p>
        )}
        <button
          className={`${primary} wide-button top-gap`}
          disabled={
            !Number(sellerId) || !Number(productId) || !buyerReady || !date
          }
          onClick={() =>
            void run("Register sale", async () => {
              const txId = await api.registerSale({
                sellerId: Number(sellerId),
                productId: Number(productId),
                buyerReceivingCode: buyer.trim(),
                saleDate: dateToEpoch(date),
              });
              setBuyer("");
              return txId;
            })
          }
        >
          <Fingerprint className={icon} />
          Record private sale
        </button>
      </Card>
      {seller && (
        <Card className="top-section">
          <Heading
            icon={Boxes}
            eyebrow="SELLABLE INVENTORY"
            title={`${inventory.length} available for sale`}
            detail={`Unsold, active products manufactured by brand #${seller.mfrId}. Click one to fill the sale form.`}
          />
          {inventory.length ? (
            <div className="mini-list">
              {inventory.map((p) => (
                <ProductLine
                  key={p.id}
                  product={p}
                  state={state}
                  note="Ready to sell"
                  onPick={() => setProductId(String(p.id))}
                />
              ))}
            </div>
          ) : (
            <Empty
              icon={PackageCheck}
              title="No inventory for this brand"
              detail="Products appear here once the manufacturer registers them."
            />
          )}
        </Card>
      )}
      <Card className="top-section">
        <Heading
          icon={Boxes}
          eyebrow="SELLER VIEW"
          title="Current registry"
          detail="Public seller and product status. Private purchase inputs stay out of the ledger."
        />
        {state.sellers.length ? (
          <div className="registry-table">
            <div className="registry-head">
              <span>STORE</span>
              <span>BRAND ID</span>
              <span>SALES</span>
              <span>STATE</span>
            </div>
            {state.sellers.map((s) => (
              <div className="registry-row" key={s.id}>
                <strong>{s.name}</strong>
                <span>#{s.mfrId}</span>
                <span>{s.salesCount}</span>
                <span
                  className={`status-chip ${s.authorized ? "status-active" : "status-warn"}`}
                >
                  {s.authorized ? "Authorized" : "Pending"}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <Empty
            icon={Store}
            title="No sellers registered"
            detail="Create the first seller identity above."
          />
        )}
      </Card>
    </>
  );
}

function Own({
  api,
  state,
  run,
  session,
}: {
  api: TrustCartAPI;
  state: TrustCartDerivedState;
  run: Run;
  session: Session;
}) {
  const [id, setId] = useState("");
  const [newCode, setNewCode] = useState("");
  const ownerCode = api.ownerCommitment(session.secretHex);
  const mine = state.products.filter(
    (p) => p.sold && p.ownerHash === ownerCode,
  );
  const owned = mine.filter((p) => p.pendingOwnerHash === ZERO_COMMITMENT);
  const outgoing = mine.filter((p) => p.pendingOwnerHash !== ZERO_COMMITMENT);
  const incoming = state.products.filter(
    (p) => p.pendingOwnerHash === ownerCode && p.ownerHash !== ownerCode,
  );
  const codeValid = isReceivingCode(newCode);
  const pickProduct = (pid: number) => setId(String(pid));
  const warrantyNoteFor = (warrantyId: number): string | undefined => {
    const w = state.warranties.find((item) => item.id === warrantyId);
    if (!w || w.cancelled) return undefined;
    return w.expiresAt > Date.now() / 1000
      ? `Warranty until ${formatEpochDate(BigInt(w.expiresAt))}`
      : "Warranty expired";
  };
  const copy = () => {
    void navigator.clipboard
      .writeText(session.receivingCode)
      .then(() => {})
      .catch(() => undefined);
  };
  return (
    <>
      <Intro
        eyebrow="PRIVATE PASSPORT"
        title="Your ownership, your proof."
        detail="Share a receiving code to request or accept a product without exposing your identity."
        action={
          <button className={secondary} onClick={copy}>
            <Copy className={icon} />
            Copy receiving code
          </button>
        }
      />
      <div className="split-grid">
        <Card>
          <Heading
            icon={KeyRound}
            eyebrow="RECEIVING CODE"
            title="Accept private ownership"
            detail="Safe to share with a seller or new buyer."
          />
          <div className="code-block">{session.receivingCode}</div>
          <div className="code-actions">
            <button className={secondary} onClick={copy}>
              <Clipboard className={icon} />
              Copy code
            </button>
            <span>
              <LockKeyhole className={icon} />
              Never reveals your wallet
            </span>
          </div>
        </Card>
        <Card>
          <Heading
            icon={RefreshCw}
            eyebrow="RESALE"
            title="Request a transfer"
            detail="The buyer must accept before ownership changes."
          />
          <Field label="Product ID">
            <input
              className={input}
              value={id}
              onChange={(e) => setId(e.target.value)}
              placeholder="1"
            />
          </Field>
          <Field label="New owner's receiving code">
            <input
              className={`${input} mono`}
              value={newCode}
              onChange={(e) => setNewCode(e.target.value)}
              placeholder="32-byte hexadecimal commitment"
            />
          </Field>
          {newCode.trim().length > 0 && !codeValid && (
            <p className="field-hint">
              Receiving codes are exactly 64 hexadecimal characters. Copy the
              code from the buyer's My ownership tab.
            </p>
          )}
          <button
            className={`${primary} wide-button top-gap`}
            disabled={!Number(id) || !codeValid}
            onClick={() =>
              void run("Request ownership transfer", () =>
                api.transferOwnership(Number(id), newCode.trim()),
              )
            }
          >
            <ArrowRight className={icon} />
            Request transfer
          </button>
          {owned.some((p) => p.id === Number(id)) && (
            <p className="field-hint" style={{ marginTop: 12 }}>
              After requesting, ownership stays yours until the buyer accepts.
              You can cancel any pending transfer below.
            </p>
          )}
        </Card>
      </div>
      {incoming.length > 0 && (
        <Card className="top-section">
          <Heading
            icon={BadgeCheck}
            eyebrow="PENDING TRANSFERS"
            title="Accept a product transfer"
            detail="Only accept a transfer you expect to receive."
          />
          {incoming.map((p) => (
            <div className="registry-row" key={p.id}>
              <strong>{p.model}</strong>
              <span>Product #{p.id}</span>
              <button
                className={primary}
                onClick={() =>
                  void run("Accept ownership transfer", () =>
                    api.acceptOwnershipTransfer(p.id),
                  )
                }
              >
                Accept
              </button>
            </div>
          ))}
        </Card>
      )}
      {outgoing.length > 0 && (
        <Card className="top-section">
          <Heading
            icon={RefreshCw}
            eyebrow="TRANSFER IN FLIGHT"
            title="Waiting for the recipient"
            detail="Ownership stays with you until the receiving wallet accepts. You can cancel a mistake."
          />
          {outgoing.map((p) => (
            <div className="registry-row" key={p.id}>
              <strong>{p.model}</strong>
              <span>
                Product #{p.id} → {shortHex(p.pendingOwnerHash, 10)}
              </span>
              <button
                className={danger}
                onClick={() =>
                  void run("Cancel ownership transfer", () =>
                    api.cancelOwnershipTransfer(p.id),
                  )
                }
              >
                Cancel transfer
              </button>
            </div>
          ))}
        </Card>
      )}
      <Card className="top-section">
        <div className="card-topline">
          <div>
            <p className="eyebrow">OWNED PRODUCTS</p>
            <h2>
              {owned.length
                ? `${owned.length} passport record${owned.length === 1 ? "" : "s"}`
                : "No ownership records"}
            </h2>
          </div>
          <Fingerprint className="h-5 w-5 muted" />
        </div>
        {owned.length ? (
          <div className="mini-list">
            {owned.map((p) => (
              <ProductLine
                key={p.id}
                product={p}
                state={state}
                commitment
                note={warrantyNoteFor(p.warrantyId)}
                onPick={() => pickProduct(p.id)}
              />
            ))}
          </div>
        ) : (
          <Empty
            icon={KeyRound}
            title={outgoing.length ? "All shipped, for now" : "Nothing here yet"}
            detail={
              outgoing.length
                ? "Every product in your care has a transfer in flight. Cancel from the card above if that is not intended."
                : "Ask a seller to register a purchase against your receiving code."
            }
          />
        )}
      </Card>
    </>
  );
}

function Settings({
  api,
  manager,
  summary,
  joining,
  setJoining,
  join,
  toast,
}: {
  api: TrustCartAPI;
  manager: BrowserTrustCartManager;
  summary: WalletSummary;
  joining: string;
  setJoining: (value: string) => void;
  join: () => void;
  toast: ToastFn;
}) {
  const [pass, setPass] = useState("");
  const [backup, setBackup] = useState("");
  const [busy, setBusy] = useState(false);
  const exportKey = async () => {
    setBusy(true);
    try {
      setBackup(await manager.exportPrivacyKey(pass));
      toast("ok", "Encrypted private backup created.");
    } catch (e) {
      toast("err", e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  const importKey = async () => {
    setBusy(true);
    try {
      await manager.importPrivacyKey(backup, pass);
      toast("ok", "Private state restored. Reloading securely.");
      window.setTimeout(() => window.location.reload(), 300);
    } catch (e) {
      toast("err", e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <Intro
        eyebrow="SETTINGS"
        title="Keep the proof layer yours."
        detail="Manage the wallet session, contract connection, and encrypted private-state backup."
      />
      <div className="split-grid">
        <Card>
          <Heading
            icon={Wallet}
            eyebrow="WALLET SESSION"
            title={summary.name}
            detail="Connected through the Midnight DApp Connector."
          />
          <div className="settings-list">
            <Row label="Network" value={summary.networkId} />
            <Row label="API version" value={summary.apiVersion} />
            <Row
              label="Unshielded"
              value={shortHex(summary.unshieldedAddress, 12)}
              mono
            />
            <Row
              label="Proof server"
              value={summary.proofServer.replace(/^https?:\/\//, "")}
            />
          </div>
        </Card>
        <Card>
          <Heading
            icon={LockKeyhole}
            eyebrow="PRIVATE BACKUP"
            title="Export or restore"
            detail="Use at least 16 characters with upper, lower, number, and symbol."
          />
          <Field label="Passphrase">
            <input
              className={input}
              type="password"
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              placeholder="A strong recovery passphrase"
            />
          </Field>
          <div className="button-row top-gap">
            <button
              className={`${secondary} flex-1`}
              disabled={busy || !isValidPrivacyPassphrase(pass)}
              onClick={() => void exportKey()}
            >
              {busy ? <Spinner /> : <Copy className={icon} />}Export backup
            </button>
            <button
              className={`${primary} flex-1`}
              disabled={
                busy || !isValidPrivacyPassphrase(pass) || !backup.trim()
              }
              onClick={() => void importKey()}
            >
              {busy ? <Spinner /> : <RefreshCw className={icon} />}Restore
            </button>
          </div>
          <textarea
            className={`${input} backup-field`}
            value={backup}
            onChange={(e) => setBackup(e.target.value)}
            placeholder="Encrypted TrustCart recovery backup"
          />
        </Card>
      </div>
      <Card className="top-section">
        <Heading
          icon={RefreshCw}
          eyebrow="CONTRACT CONNECTION"
          title="Join another contract"
          detail={`Current contract: ${shortHex(api.deployedContractAddress, 14)}`}
        />
        <Field
          label="Contract address"
          hint="64 hexadecimal characters. Leave the registry as is unless you are an administrator joining another deployment."
        >
          <input
            className={`${input} mono`}
            value={joining}
            onChange={(e) => setJoining(e.target.value)}
            placeholder={shortHex(api.deployedContractAddress, 14)}
          />
        </Field>
        <button
          className={`${secondary} top-gap`}
          disabled={!joining.trim()}
          onClick={join}
        >
          <ChevronRight className={icon} />
          Join and reload
        </button>
      </Card>
    </>
  );
}

function App() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [api, setApi] = useState<TrustCartAPI | null>(null);
  const [state, setState] = useState<TrustCartDerivedState | null>(null);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toast = useCallback((kind: Toast["kind"], text: string, options?: { href?: string }) => {
    const id = Date.now() + Math.random();
    setToasts((old) => [
      ...old.slice(-3),
      { id, kind, text, href: options?.href },
    ]);
    window.setTimeout(
      () => setToasts((old) => old.filter((item) => item.id !== id)),
      options?.href ? 9000 : 5000,
    );
  }, []);
  const connect = async (walletId?: string) => {
    setBusy(true);
    setError(null);
    try {
      const attempt = beginWalletConnection(
        readInjectedWallets(),
        NETWORK_ID,
        walletId,
      );
      const manager = new BrowserTrustCartManager(
        attempt.wallet,
        attempt.connectedAPI,
      );
      const [summary, secretHex, receivingCode] = await Promise.all([
        manager.getWalletSummary(),
        manager.getSecretHex(),
        manager.getReceivingCode(),
      ]);
      const next = { manager, summary, secretHex, receivingCode };
      const configuredAddress =
        DEFAULT_CONTRACT_ADDRESS ||
        localStorage.getItem(CONTRACT_ADDRESS_KEY)?.trim();
      if (configuredAddress) {
        const connectedApi = await manager.join(configuredAddress);
        localStorage.setItem(
          CONTRACT_ADDRESS_KEY,
          connectedApi.deployedContractAddress,
        );
        setSession(next);
        setApi(connectedApi);
        toast("ok", "Connected to the live TrustCart registry.");
      } else {
        setSession(next);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    if (!api) {
      setState(null);
      return;
    }
    const sub = api.state$.subscribe({
      next: (next) => {
        setState(next);
        setLastSync(new Date());
      },
      error: (e) => toast("err", e instanceof Error ? e.message : String(e)),
    });
    return () => sub.unsubscribe();
  }, [api, toast]);
  if (!session)
    return (
      <>
        <ConnectScreen
          onConnect={(id) => void connect(id)}
          busy={busy}
          error={error}
        />
        <Toasts toasts={toasts} />
      </>
    );
  if (!api)
    return (
      <>
        <Setup session={session} ready={setApi} toast={toast} />
        <Toasts toasts={toasts} />
      </>
    );
  if (!state)
    return (
      <div className="loading-page">
        <div className="loading-mark">
          <Spinner />
        </div>
        <p>Reading the latest private registry state...</p>
      </div>
    );
  return (
    <>
      <Dashboard
        api={api}
        session={session}
        state={state}
        lastSync={lastSync}
        toast={toast}
      />
      <Toasts toasts={toasts} />
    </>
  );
}
export default App;
