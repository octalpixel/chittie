import { useMemo, useState } from 'react';
import {
  Printer,
  Text,
  Row,
  Line,
  Cut,
  Cashdraw,
  render,
  PRINTER_PROFILES,
  formatMoney,
  type TextRasterizer,
} from '@angadie/chittie';
import { renderReceipt, type PreviewCanvas } from '@angadie/chittie-preview';
import { print } from '@angadie/chittie-transport';
import { createWebSerialTransport } from '@angadie/chittie-transport-web';

// Browser <canvas> factory for chittie-preview (Node uses @napi-rs/canvas instead).
const createCanvas = (w: number, h: number): PreviewCanvas => {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c as unknown as PreviewCanvas;
};

// Browser rasterizer — shapes Sinhala/Tamil/etc. via the OS fonts. This is the
// differentiator: no other ESC/POS lib prints these; chittie rasters them.
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

interface Item {
  name: string;
  qty: number;
  price: number;
}

export default function App() {
  const [biz, setBiz] = useState('Artisan Haus');
  const [profile, setProfile] = useState<'58mm' | '80mm'>('80mm');
  const [greeting, setGreeting] = useState('ආයුබෝවන්'); // Sinhala — try Tamil வணக்கம் too
  const [items, setItems] = useState<Item[]>([
    { name: 'Flat White', qty: 2, price: 850 },
    { name: 'Croissant', qty: 1, price: 650 },
  ]);
  const [error, setError] = useState('');

  const { columns, dotWidth } = PRINTER_PROFILES[profile];
  const total = items.reduce((s, i) => s + i.qty * i.price, 0);

  const bytes = useMemo(() => {
    const receipt = (
      <Printer width={columns}>
        <Text align="center" bold size={{ width: 2, height: 2 }}>
          {biz}
        </Text>
        {greeting ? <Text align="center">{greeting}</Text> : null}
        <Line />
        {items.map((it, i) => (
          <Row
            key={i}
            left={`${it.qty}× ${it.name}`}
            right={formatMoney(it.qty * it.price, { currency: 'Rs.', decimals: 0 })}
          />
        ))}
        <Line />
        <Row left="TOTAL" right={formatMoney(total, { currency: 'Rs.', decimals: 0 })} />
        <Text align="center">Thank you!</Text>
        <Cashdraw />
        <Cut />
      </Printer>
    );
    try {
      setError('');
      return render(receipt, { dotWidth, rasterizer });
    } catch (e) {
      setError((e as Error).message);
      return new Uint8Array();
    }
  }, [biz, greeting, items, total, columns, dotWidth]);

  const pngSrc = useMemo(() => {
    if (!bytes.length) return '';
    const canvas = renderReceipt(bytes, { createCanvas, columns }) as unknown as HTMLCanvasElement;
    return canvas.toDataURL('image/png');
  }, [bytes, columns]);

  async function handlePrint() {
    try {
      const transport = createWebSerialTransport();
      await print(transport, bytes);
    } catch (e) {
      alert('Print cancelled / failed: ' + (e as Error).message);
    }
  }

  const setItem = (i: number, patch: Partial<Item>) =>
    setItems((xs) => xs.map((it, j) => (j === i ? { ...it, ...patch } : it)));

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', maxWidth: 880, margin: '2rem auto', padding: '0 1rem' }}>
      <h1>chittie playground</h1>
      <p style={{ color: '#555' }}>
        Author a receipt → ESC/POS bytes → live preview. Non-Latin scripts (Sinhala/Tamil) are
        auto-rasterized — the thing other ESC/POS libraries can't do.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
        <div>
          <label>
            Business name{' '}
            <input value={biz} onChange={(e) => setBiz(e.target.value)} />
          </label>
          <p>
            <label>
              Greeting (try ආයුබෝවන් / வணக்கம்){' '}
              <input value={greeting} onChange={(e) => setGreeting(e.target.value)} />
            </label>
          </p>
          <p>
            Paper:{' '}
            <select value={profile} onChange={(e) => setProfile(e.target.value as '58mm' | '80mm')}>
              <option value="58mm">58mm (32 col)</option>
              <option value="80mm">80mm (48 col)</option>
            </select>
          </p>
          <h3>Items</h3>
          {items.map((it, i) => (
            <div key={i} style={{ marginBottom: 6 }}>
              <input value={it.name} onChange={(e) => setItem(i, { name: e.target.value })} style={{ width: 140 }} />
              <input
                type="number"
                value={it.qty}
                onChange={(e) => setItem(i, { qty: Number(e.target.value) })}
                style={{ width: 50 }}
              />
              <input
                type="number"
                value={it.price}
                onChange={(e) => setItem(i, { price: Number(e.target.value) })}
                style={{ width: 80 }}
              />
            </div>
          ))}
          <button onClick={() => setItems((xs) => [...xs, { name: 'Item', qty: 1, price: 100 }])}>+ item</button>
          <p>
            <button onClick={handlePrint} disabled={!bytes.length} style={{ padding: '0.5rem 1rem' }}>
              Print via Web Serial
            </button>{' '}
            <span style={{ color: '#888' }}>{bytes.length} bytes</span>
          </p>
          {error && <p style={{ color: 'crimson' }}>render error: {error}</p>}
        </div>
        <div>
          <h3>Preview</h3>
          {pngSrc ? (
            <img src={pngSrc} alt="receipt preview" style={{ width: '100%', border: '1px solid #ddd' }} />
          ) : (
            <p>—</p>
          )}
        </div>
      </div>
    </div>
  );
}
