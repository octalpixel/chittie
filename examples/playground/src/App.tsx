import { useEffect, useMemo, useState } from 'react';
import {
  Printer,
  Text,
  Row,
  Line,
  Cut,
  Cashdraw,
  render as renderReceiptTree,
  PRINTER_PROFILES,
  formatMoney,
  type TextRasterizer,
} from '@angadie/chittie';
import {
  Label,
  LText,
  LBarcode,
  LQR,
  LBox,
  render as renderLabelTree,
  LABEL_PROFILES,
  mmToDots,
} from '@angadie/chittie-label-react';
import { renderReceipt, renderLabel, type PreviewCanvas } from '@angadie/chittie-preview';
import { createCompanionClient, type PrinterInfo } from '@angadie/chittie-companion';

// Print through the running Chittie Companion (localhost:8930) — works for USB
// printer-class devices (like the N32G43x) that Web Serial can't reach.
const companion = createCompanionClient({ url: 'http://localhost:8930' });

const createCanvas = (w: number, h: number): PreviewCanvas => {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c as unknown as PreviewCanvas;
};

// Browser rasterizer — shapes Sinhala/Tamil/etc. via OS fonts (the differentiator).
const rasterizer: TextRasterizer = {
  rasterize(text, { fontSize = 30, maxWidth = 576 } = {}) {
    const probe = document.createElement('canvas').getContext('2d')!;
    const font = `${fontSize}px "Noto Sans Sinhala","Noto Sans Tamil",sans-serif`;
    probe.font = font;
    const w = Math.min(Math.ceil(probe.measureText(text).width) + 4, maxWidth);
    const h = Math.ceil(fontSize * 1.5);
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#000';
    ctx.font = font;
    ctx.textBaseline = 'top';
    ctx.fillText(text, 2, 2);
    return ctx.getImageData(0, 0, w, h);
  },
};

const targetOf = (p: PrinterInfo) => (p.transport === 'usb' ? 'usb' : p.systemName);

async function printBytes(bytes: Uint8Array, target: string) {
  const res = await companion.print(bytes, target ? { target } : {});
  if (res.printed) alert(`✓ Printed → ${res.target}`);
  else alert(`✗ ${res.reason}`);
}

const I = { width: 140 } as const;

function ReceiptTab({ target }: { target: string }) {
  const [biz, setBiz] = useState('Artisan Haus');
  const [greeting, setGreeting] = useState('ආයුබෝවන්');
  const [profile, setProfile] = useState<'58mm' | '80mm'>('80mm');
  const [items, setItems] = useState([
    { name: 'Flat White', qty: 2, price: 850 },
    { name: 'Croissant', qty: 1, price: 650 },
  ]);
  const { columns, dotWidth } = PRINTER_PROFILES[profile];
  const total = items.reduce((s, i) => s + i.qty * i.price, 0);

  const bytes = useMemo(() => {
    const tree = (
      <Printer width={columns}>
        <Text align="center" bold size={{ width: 2, height: 2 }}>{biz}</Text>
        {greeting ? <Text align="center">{greeting}</Text> : null}
        <Line />
        {items.map((it, i) => (
          <Row key={i} left={`${it.qty}× ${it.name}`} right={formatMoney(it.qty * it.price, { currency: 'Rs.', decimals: 0 })} />
        ))}
        <Line />
        <Row left="TOTAL" right={formatMoney(total, { currency: 'Rs.', decimals: 0 })} />
        <Text align="center">Thank you!</Text>
        <Cashdraw />
        <Cut />
      </Printer>
    );
    try {
      return renderReceiptTree(tree, { dotWidth, rasterizer });
    } catch {
      return new Uint8Array();
    }
  }, [biz, greeting, items, total, columns, dotWidth]);

  const png = useMemo(() => {
    if (!bytes.length) return '';
    return (renderReceipt(bytes, { createCanvas, columns }) as unknown as HTMLCanvasElement).toDataURL();
  }, [bytes, columns]);

  const setItem = (i: number, patch: Partial<(typeof items)[number]>) =>
    setItems((xs) => xs.map((it, j) => (j === i ? { ...it, ...patch } : it)));

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
      <div>
        <p><label>Business <input value={biz} onChange={(e) => setBiz(e.target.value)} /></label></p>
        <p><label>Greeting (try ආයුබෝවන් / வணக்கம்) <input value={greeting} onChange={(e) => setGreeting(e.target.value)} /></label></p>
        <p>Paper <select value={profile} onChange={(e) => setProfile(e.target.value as '58mm' | '80mm')}><option>58mm</option><option>80mm</option></select></p>
        {items.map((it, i) => (
          <div key={i} style={{ marginBottom: 6 }}>
            <input value={it.name} onChange={(e) => setItem(i, { name: e.target.value })} style={I} />
            <input type="number" value={it.qty} onChange={(e) => setItem(i, { qty: +e.target.value })} style={{ width: 50 }} />
            <input type="number" value={it.price} onChange={(e) => setItem(i, { price: +e.target.value })} style={{ width: 80 }} />
          </div>
        ))}
        <button onClick={() => setItems((xs) => [...xs, { name: 'Item', qty: 1, price: 100 }])}>+ item</button>
        <p><button onClick={() => printBytes(bytes, target)} disabled={!target} style={{ padding: '0.5rem 1rem' }}>Print receipt</button> <span style={{ color: '#888' }}>{bytes.length} bytes</span></p>
      </div>
      <div>{png ? <img src={png} alt="receipt" style={{ width: '100%', border: '1px solid #ddd' }} /> : '—'}</div>
    </div>
  );
}

function LabelTab({ target }: { target: string }) {
  const [name, setName] = useState('Silk Saree');
  const [price, setPrice] = useState(8500);
  const [gtin, setGtin] = useState('4791234567890');
  const [size, setSize] = useState<'40x30' | '50x30' | '60x40'>('40x30');
  const profile = { ...LABEL_PROFILES[size], density: 8 };
  const widthDots = mmToDots(profile.widthMm);
  const heightDots = mmToDots(profile.heightMm);
  const d = (mm: number) => mmToDots(mm);

  const bytes = useMemo(() => {
    const tree = (
      <Label profile={profile} rasterizer={rasterizer} print={{ copies: 1 }}>
        <LBox x={2} y={2} w={widthDots - 4} h={heightDots - 4} thickness={2} />
        <LText x={d(2)} y={d(2)} font="3">{name}</LText>
        <LText x={d(2)} y={d(9)} font="4" xMul={2} yMul={2}>{formatMoney(price, { currency: 'Rs.', decimals: 0 })}</LText>
        <LBarcode x={d(2)} y={heightDots - d(9)} data={gtin} type="ean13" height={d(7)} />
        <LQR x={widthDots - d(11)} y={d(2)} data={`https://shop.lk/p/${gtin}`} cell={3} />
      </Label>
    );
    try {
      return renderLabelTree(tree);
    } catch {
      return new Uint8Array();
    }
  }, [name, price, gtin, size, widthDots, heightDots]);

  const png = useMemo(() => {
    if (!bytes.length) return '';
    return (renderLabel(bytes, { createCanvas, dpi: 203 }) as unknown as HTMLCanvasElement).toDataURL();
  }, [bytes]);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
      <div>
        <p><label>Product <input value={name} onChange={(e) => setName(e.target.value)} style={I} /></label></p>
        <p><label>Price <input type="number" value={price} onChange={(e) => setPrice(+e.target.value)} style={{ width: 90 }} /></label></p>
        <p><label>GTIN/EAN-13 <input value={gtin} onChange={(e) => setGtin(e.target.value)} style={I} /></label></p>
        <p>Tag size <select value={size} onChange={(e) => setSize(e.target.value as typeof size)}><option>40x30</option><option>50x30</option><option>60x40</option></select> mm</p>
        <p><button onClick={() => printBytes(bytes, target)} disabled={!target} style={{ padding: '0.5rem 1rem' }}>Print label (TSPL)</button> <span style={{ color: '#888' }}>{bytes.length} bytes</span></p>
        <p style={{ color: '#888', fontSize: 13 }}>Barcode/QR shown as a representative preview; the bytes are real TSPL — scan-accurate on the printer.</p>
      </div>
      <div>{png ? <img src={png} alt="label" style={{ width: widthDots, maxWidth: '100%', border: '1px solid #ddd', imageRendering: 'pixelated' }} /> : '—'}</div>
    </div>
  );
}

export default function App() {
  const [tab, setTab] = useState<'receipt' | 'label'>('receipt');
  const [up, setUp] = useState<boolean | null>(null);
  const [printers, setPrinters] = useState<PrinterInfo[]>([]);
  const [target, setTarget] = useState('');

  useEffect(() => {
    (async () => {
      const ok = await companion.available();
      setUp(ok);
      if (!ok) return;
      const ps = await companion.printers();
      setPrinters(ps);
      if (ps[0]) setTarget(targetOf(ps[0]));
    })();
  }, []);

  const tabBtn = (id: 'receipt' | 'label', text: string) => (
    <button onClick={() => setTab(id)} style={{ padding: '0.5rem 1rem', fontWeight: tab === id ? 700 : 400, borderBottom: tab === id ? '2px solid #000' : 'none' }}>
      {text}
    </button>
  );

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', maxWidth: 900, margin: '2rem auto', padding: '0 1rem' }}>
      <h1>chittie playground</h1>
      <p style={{ color: '#555' }}>
        Author → bytes → live preview → print through the Chittie Companion. Receipts speak ESC/POS;
        labels speak TSPL. Non-Latin scripts (Sinhala/Tamil) auto-rasterize.
      </p>

      <div style={{ display: 'flex', alignItems: 'center', gap: '.75rem', margin: '0 0 1.25rem', fontSize: 14 }}>
        <span style={{ color: up ? '#137333' : '#b91c1c' }}>
          {up === null ? 'Connecting to companion…' : up ? '● Companion connected' : '● Companion not found'}
        </span>
        {up && printers.length > 0 && (
          <label>Printer <select value={target} onChange={(e) => setTarget(e.target.value)}>
            {printers.map((p, i) => <option key={i} value={targetOf(p)}>{p.name}</option>)}
          </select></label>
        )}
        {up === false && <span style={{ color: '#888' }}>Start the Chittie Companion app, then reload.</span>}
        {up && printers.length === 0 && <span style={{ color: '#888' }}>No printer detected — plug one in and reload.</span>}
      </div>

      <div style={{ marginBottom: '1.5rem', borderBottom: '1px solid #eee' }}>
        {tabBtn('receipt', 'Receipt')}
        {tabBtn('label', 'Label / Tag')}
      </div>
      {tab === 'receipt' ? <ReceiptTab target={target} /> : <LabelTab target={target} />}
    </div>
  );
}
