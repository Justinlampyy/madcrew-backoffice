"use client";

import React, { useMemo, useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import {
  addDoc,
  collection,
  getDocs,
  query,
  where,
  serverTimestamp,
  limit,
} from "firebase/firestore";

/* ==========================
   MadCrew Webshop Page (clean)
   - Uses start/end regions for easy patching
   - Only webshop logic (no admin code)
   - Firestore: creates order (status: pending) if a round is open
   ========================== */

// START region: CONTACT config
const CONTACT = {
  // WhatsApp number in international format, digits only (no '+'). Example: 31612345678 (for +31 6 ...)
  whatsappNumber: "31645355131",
  // Fallback order email
  email: "madcrewbikers@gmail.com",
  // Business name shown in messages
  businessName: "MadCrew Bikers",
};
// END region: CONTACT config

// START region: types & catalog
type Product = { id: string; name: string; price: number; image: string };
type Round = { id: string; name?: string; status?: string };
export type CartItem = { id: string; name: string; price: number; qty: number };

const PRODUCTS: Product[] = [
  { id: "hoodie", name: "Hoodie", price: 55, image: "https://placehold.co/600x600?text=Hoodie" },
  { id: "pullover", name: "Pull-over", price: 50, image: "https://placehold.co/600x600?text=Pull-over" },
  { id: "tshirt-unisex", name: "T-shirt (unisex/dames)", price: 30, image: "https://placehold.co/600x600?text=T-shirt" },
  { id: "tshirt-kids", name: "Kinder T-shirt", price: 20, image: "https://placehold.co/600x600?text=Kinder+T-shirt" },
  { id: "softshell", name: "Softshell jas", price: 65, image: "https://placehold.co/600x600?text=Softshell" },
  { id: "paraplu", name: "Paraplu", price: 20, image: "https://placehold.co/600x600?text=Paraplu" },
  { id: "slippers", name: "Slippers", price: 15, image: "https://placehold.co/600x600?text=Slippers" },
];
// END region: types & catalog

// START region: helpers
function formatEUR(n: number) {
  return new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(n);
}
// robust newline joiner (avoids accidental broken string literals)
function joinLines(lines: string[]) {
  return lines.join(String.fromCharCode(10));
}
const digitsOnly = (s: string) => (s || "").replace(/\D/g, "");
// END region: helpers

// START region: message builders
function toWhatsAppOwnerText(args: {
  items: CartItem[];
  total: number;
  orderId: string;
  round: Round | null;
  customer: { name: string; phone: string; deliveryMethod: string; address?: string; notes?: string };
}) {
  const { items, total, orderId, round, customer } = args;
  const lines = [
    `Nieuwe webshop-bestelling — ${CONTACT.businessName}`,
    `Order: ${orderId}`,
    round?.name ? `Bestelronde: ${round.name}` : undefined,
    "",
    ...items.map((i) => `• ${i.name} × ${i.qty} — ${formatEUR(i.price * i.qty)}`),
    "",
    `Totaal: ${formatEUR(total)}`,
    "",
    `Klant: ${customer.name}`,
    `Tel: ${customer.phone}`,
    `Levering: ${customer.deliveryMethod}${customer.address ? ` — ${customer.address}` : ""}`,
    customer.notes ? `Opmerkingen: ${customer.notes}` : undefined,
    "",
    "Graag Tikkie sturen en order bevestigen.",
  ].filter(Boolean) as string[];
  return encodeURIComponent(joinLines(lines));
}

function toEmailBody(items: CartItem[], total: number) {
  const lines = [
    `Bestelling voor ${CONTACT.businessName}`,
    "",
    ...items.map((i) => `- ${i.name} x ${i.qty} — ${formatEUR(i.price * i.qty)}`),
    "",
    `Totaal: ${formatEUR(total)}`,
    "",
    "Naam: ",
    "Bezorgadres of afhalen: ",
    "Speciale wensen (maat/kleur): ",
  ];
  return encodeURIComponent(joinLines(lines));
}
// END region: message builders

// START region: component
const CART_KEY = "madcrew-cart-v1";

export default function WebshopPage() {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);

  // bestelronde
  const [activeRound, setActiveRound] = useState<Round | null>(null);
  const [roundLoading, setRoundLoading] = useState(true);

  // klantgegevens (client-side)
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [deliveryMethod, setDeliveryMethod] = useState<"afhalen" | "bezorgen">("afhalen");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");

  // START region: hydrate local storage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(CART_KEY);
      if (raw) setCart(JSON.parse(raw));
      const infoRaw = localStorage.getItem("madcrew-customer-v1");
      if (infoRaw) {
        const i = JSON.parse(infoRaw);
        setCustomerName(i.name || "");
        setCustomerPhone(i.phone || "");
        setDeliveryMethod(i.delivery || "afhalen");
        setAddress(i.address || "");
        setNotes(i.notes || "");
      }
    } catch {}
  }, []);
  useEffect(() => {
    try { localStorage.setItem(CART_KEY, JSON.stringify(cart)); } catch {}
  }, [cart]);
  useEffect(() => {
    try {
      localStorage.setItem(
        "madcrew-customer-v1",
        JSON.stringify({ name: customerName, phone: customerPhone, delivery: deliveryMethod, address, notes })
      );
    } catch {}
  }, [customerName, customerPhone, deliveryMethod, address, notes]);
  // END region: hydrate local storage

  // START region: fetch open round
  useEffect(() => {
    (async () => {
      try {
        const q = query(collection(db, "rounds"), where("status", "==", "open"), limit(1));
        const snap = await getDocs(q);
        setActiveRound(!snap.empty ? ({ id: snap.docs[0].id, ...(snap.docs[0].data() as any) }) : null);
      } catch (e) {
        console.error(e);
        setActiveRound(null);
      } finally {
        setRoundLoading(false);
      }
    })();
  }, []);
  // END region: fetch open round

  const total = useMemo(() => cart.reduce((s, i) => s + i.price * i.qty, 0), [cart]);

  // START region: cart ops
  function addToCart(p: Product) {
    setCart((prev) => {
      const ex = prev.find((i) => i.id === p.id);
      if (ex) return prev.map((i) => (i.id === p.id ? { ...i, qty: i.qty + 1 } : i));
      return [...prev, { id: p.id, name: p.name, price: p.price, qty: 1 }];
    });
  }
  function updateQty(id: string, qty: number) {
    setCart((prev) => prev.map((i) => (i.id === id ? { ...i, qty } : i)).filter((i) => i.qty > 0));
  }
  function clearCart() { setCart([]); }
  // END region: cart ops

  // START region: checkout actions
  async function openWhatsAppCheckout() {
    if (!cart.length || !activeRound) return;
    if (!customerName.trim() || !customerPhone.trim()) {
      alert("Vul je naam en telefoonnummer in om te bestellen.");
      return;
    }

    // Save order in Firestore (status: pending)
    let orderId = "";
    try {
      const payload = {
        createdAt: serverTimestamp(),
        roundId: activeRound.id,
        roundName: activeRound.name || null,
        status: "pending",
        items: cart.map((i) => ({ id: i.id, name: i.name, price: i.price, qty: i.qty })),
        total,
        customerName,
        customerPhone,
        deliveryMethod,
        address: address || null,
        notes: notes || null,
        source: "webshop",
      };
      const ref = await addDoc(collection(db, "orders"), payload);
      orderId = ref.id;
    } catch (e) {
      console.error("Order save failed", e);
      alert("Opslaan van bestelling is mislukt. Probeer het opnieuw.");
      return;
    }

    // Open WhatsApp to OWNER with order details
    const ownerMsg = toWhatsAppOwnerText({
      items: cart,
      total,
      orderId,
      round: activeRound,
      customer: { name: customerName, phone: customerPhone, deliveryMethod, address, notes },
    });
    const phone = digitsOnly(CONTACT.whatsappNumber);
    window.open(`https://wa.me/${phone}?text=${ownerMsg}`, "_blank");
  }

  function openEmailCheckout() {
    if (!cart.length) return;
    const subject = encodeURIComponent(`Bestelling ${CONTACT.businessName}`);
    const body = toEmailBody(cart, total);
    window.location.href = `mailto:${CONTACT.email}?subject=${subject}&body=${body}`;
  }
  // END region: checkout actions

  // START region: UI
  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900">
      {/* Header */}
      <header className="sticky top-0 z-30 backdrop-blur supports-[backdrop-filter]:bg-white/70 bg-white/90 border-b">
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-black text-white font-bold">MC</span>
            <div>
              <h1 className="text-lg font-semibold leading-tight">{CONTACT.businessName}</h1>
              <p className="text-sm text-neutral-600">Webshop</p>
            </div>
          </div>

          <button
            onClick={() => setCartOpen(true)}
            className="relative inline-flex items-center gap-2 rounded-2xl border px-4 py-2 text-sm shadow-sm hover:shadow-md transition"
            aria-label="Open winkelwagen"
          >
            <CartIcon />
            Winkelwagen
            {cart.length > 0 && (
              <span className="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-black px-1 text-xs font-semibold text-white">
                {cart.reduce((s, i) => s + i.qty, 0)}
              </span>
            )}
          </button>
        </div>
        {!roundLoading && !activeRound && (
          <div className="bg-amber-100 text-amber-900 border-t px-4 py-2 text-sm">
            Bestelronde is momenteel <strong>gesloten</strong>. Bestellen is tijdelijk niet mogelijk.
          </div>
        )}
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-4 pt-8 pb-2">
        <div className="grid md:grid-cols-2 gap-6 items-center">
          <div>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Support the crew. Rijd in stijl.</h2>
            <p className="mt-3 text-neutral-700">
              Kies je items, voeg toe aan de winkelwagen en reken af via WhatsApp of e‑mail.
              Wij sturen je een Tikkie en bevestigen je bestelling.
            </p>
          </div>
          <div className="aspect-[16/10] rounded-3xl border shadow-sm bg-[url('https://placehold.co/1200x750?text=MadCrew+Bikers')] bg-cover bg-center" />
        </div>
      </section>

      {/* Product grid */}
      <main className="mx-auto max-w-6xl px-4 pb-20">
        <div className="mt-6 grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
          {PRODUCTS.map((p) => (
            <article key={p.id} className="group rounded-3xl border bg-white shadow-sm overflow-hidden">
              <div className="aspect-square bg-neutral-100">
                <img src={p.image} alt={p.name} className="h-full w-full object-cover" />
              </div>
              <div className="p-4 flex items-center justify-between gap-3">
                <div>
                  <h3 className="font-semibold leading-tight">{p.name}</h3>
                  <p className="text-neutral-600 text-sm">{formatEUR(p.price)}</p>
                </div>
                <button
                  onClick={() => addToCart(p)}
                  disabled={!activeRound}
                  title={!activeRound ? "Bestelronde gesloten" : ""}
                  className="rounded-xl bg-black text-white px-4 py-2 text-sm font-medium shadow hover:shadow-md active:translate-y-[1px] disabled:opacity-40"
                >
                  + In mandje
                </button>
              </div>
            </article>
          ))}
        </div>
      </main>

      {/* Cart Drawer */}
      {cartOpen && (
        <div className="fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/40" onClick={() => setCartOpen(false)} />
          <aside className="absolute right-0 top-0 h-full w-full sm:w-[440px] bg-white shadow-2xl p-4 md:p-6 flex flex-col">
            <div className="flex items-center justify-between">
              <h4 className="text-lg font-semibold">Winkelwagen</h4>
              <button onClick={() => setCartOpen(false)} className="p-2 rounded-xl hover:bg-neutral-100" aria-label="Sluiten">
                <CloseIcon />
              </button>
            </div>

            <div className="mt-4 grow overflow-auto">
              {cart.length === 0 ? (
                <p className="text-neutral-600">Je mandje is nog leeg.</p>
              ) : (
                <ul className="space-y-3">
                  {cart.map((i) => (
                    <li key={i.id} className="flex items-center justify-between gap-3 rounded-2xl border p-3">
                      <div>
                        <p className="font-medium leading-tight">{i.name}</p>
                        <p className="text-sm text-neutral-600">{formatEUR(i.price)}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <QtyButton onClick={() => updateQty(i.id, Math.max(0, i.qty - 1))}>−</QtyButton>
                        <span className="min-w-[2ch] text-center font-medium">{i.qty}</span>
                        <QtyButton onClick={() => updateQty(i.id, i.qty + 1)}>+</QtyButton>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="border-t pt-4 space-y-4">
              <div className="grid grid-cols-1 gap-3">
                <label className="text-sm">
                  Naam
                  <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2" placeholder="Voor- en achternaam" />
                </label>
                <label className="text-sm">
                  Telefoonnummer
                  <input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2" placeholder="06..." />
                </label>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <label className="flex items-center gap-2 border rounded-xl px-3 py-2">
                    <input type="radio" name="delivery" checked={deliveryMethod==='afhalen'} onChange={() => setDeliveryMethod('afhalen')} /> Afhalen
                  </label>
                  <label className="flex items-center gap-2 border rounded-xl px-3 py-2">
                    <input type="radio" name="delivery" checked={deliveryMethod==='bezorgen'} onChange={() => setDeliveryMethod('bezorgen')} /> Bezorgen
                  </label>
                </div>
                {deliveryMethod === 'bezorgen' && (
                  <label className="text-sm">
                    Adres
                    <input value={address} onChange={(e) => setAddress(e.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2" placeholder="Straat + nr, postcode, plaats" />
                  </label>
                )}
                <label className="text-sm">
                  Opmerkingen (maat/kleur/wensen)
                  <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2" rows={3} />
                </label>
              </div>

              <div className="flex items-center justify-between text-base">
                <span className="font-medium">Totaal</span>
                <span className="font-semibold">{formatEUR(total)}</span>
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  onClick={openWhatsAppCheckout}
                  disabled={!cart.length || !activeRound}
                  className="w-full rounded-xl bg-black text-white px-4 py-2 text-sm font-medium shadow hover:shadow-md disabled:opacity-50"
                >
                  Bestellen (WhatsApp)
                </button>
                <button
                  onClick={openEmailCheckout}
                  disabled={!cart.length || !activeRound}
                  className="w-full rounded-xl border px-4 py-2 text-sm font-medium shadow hover:shadow-md disabled:opacity-50"
                >
                  Alternatief: e‑mail
                </button>
              </div>
              <button onClick={clearCart} disabled={!cart.length} className="text-sm text-neutral-600 underline disabled:opacity-50">
                Mandje leegmaken
              </button>
            </div>
          </aside>
        </div>
      )}
      {/* END region: UI */}
    </div>
  );
}
// END region: UI & component

// START region: UI helpers
function QtyButton({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="h-9 w-9 rounded-xl border inline-flex items-center justify-center text-lg font-semibold hover:shadow-sm"
      aria-label={`Change quantity: ${children}`}
    >
      {children}
    </button>
  );
}
function CartIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
      <path d="M7.2 6h13.1c.6 0 1 .5.9 1l-1.6 7.7a2 2 0 0 1-2 1.6H9a2 2 0 0 1-2-1.6L5.3 4.9A1 1 0 0 0 4.3 4H2" stroke="currentColor" strokeWidth="1.5" fill="none"/>
      <circle cx="9" cy="20" r="1.5" />
      <circle cx="17" cy="20" r="1.5" />
    </svg>
  );
}
function CloseIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" className="h-5 w-5">
      <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
// END region: UI helpers
