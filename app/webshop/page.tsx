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

// ==========================
// Quick setup
// 1) Drop this file into your Next.js app under app/webshop/page.tsx (or pages/webshop.tsx)
// 2) Ensure Tailwind CSS is set up.
// 3) Edit CONTACT settings below so checkout creates a WhatsApp or email message to you.
// ==========================

// --- Contact settings ---
const CONTACT = {
  // WhatsApp number in international format, digits only. Example: 31612345678 (for +31 6 ...)
  whatsappNumber: "31645355131", // TODO: replace with Justin's number
  // Email address for fallback/order email
  email: "madcrewbikers@gmail.com", // TODO: replace with your email
  // Optional: Business name shown in messages
  businessName: "MadCrew Bikers",
};

// --- Product catalog ---
// Prices include the €5 buffer as agreed (e.g., hoodie €55). Adjust as needed.
const PRODUCTS: Product[] = [
  {
    id: "hoodie",
    name: "Hoodie",
    price: 55,
    image: "https://placehold.co/600x600?text=Hoodie",
  },
  {
    id: "pullover",
    name: "Pull-over",
    price: 50,
    image: "https://placehold.co/600x600?text=Pull-over",
  },
  {
    id: "tshirt-unisex",
    name: "T-shirt (unisex/dames)",
    price: 30,
    image: "https://placehold.co/600x600?text=T-shirt",
  },
  {
    id: "tshirt-kids",
    name: "Kinder T-shirt",
    price: 20,
    image: "https://placehold.co/600x600?text=Kinder+T-shirt",
  },
  {
    id: "softshell",
    name: "Softshell jas",
    price: 65,
    image: "https://placehold.co/600x600?text=Softshell",
  },
  {
    id: "paraplu",
    name: "Paraplu",
    price: 20,
    image: "https://placehold.co/600x600?text=Paraplu",
  },
  {
    id: "slippers",
    name: "Slippers",
    price: 15,
    image: "https://placehold.co/600x600?text=Slippers",
  },
];

// --- Types ---
type Product = {
  id: string;
  name: string;
  price: number; // EUR
  image: string;
};

type Round = {
  id: string;
  name?: string;
  status?: string; // e.g. "open" | "closed"
};

export type CartItem = {
  id: string;
  name: string;
  price: number;
  qty: number;
};

// --- Utils ---
function formatEUR(n: number) {
  return new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(n);
}

function toWhatsAppText(items: CartItem[], total: number) {
  const lines = [
    `Bestelling voor ${CONTACT.businessName}`,
    "",
    ...items.map((i) => `• ${i.name} × ${i.qty} — ${formatEUR(i.price * i.qty)}`),
    "",
    `Totaal: ${formatEUR(total)}`,
    "",
    "Naam: ",
    "Bezorgadres of afhalen: ",
    "Speciale wensen (maat/kleur): ",
  ];
  return encodeURIComponent(lines.join("
"));
}

// Message that goes to the OWNER (shop) so you can reply with a Tikkie
function toWhatsAppOwnerText({
  items,
  total,
  orderId,
  round,
  customer,
}: {
  items: CartItem[];
  total: number;
  orderId: string;
  round: Round | null;
  customer: { name: string; phone: string; deliveryMethod: string; address?: string; notes?: string };
}) {
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
  return encodeURIComponent(lines.join("
"));
}`,
    "",
    ...items.map((i) => `• ${i.name} × ${i.qty} — ${formatEUR(i.price * i.qty)}`),
    "",
    `Totaal: ${formatEUR(total)}`,
    "",
    "Naam: ",
    "Bezorgadres of afhalen: ",
    "Speciale wensen (maat/kleur): ",
  ];
  return encodeURIComponent(lines.join("\n"));
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
  return encodeURIComponent(lines.join("\n"));
}

// Persist cart in localStorage
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

  useEffect(() => {
    const q = query(collection(db, "orders"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
      setOrders(list);
      setTikkie((prev) => {
        const next = { ...prev } as Record<string, string>;
        for (const o of list) {
          if (next[o.id] === undefined) next[o.id] = o.tikkieUrl || "";
        }
        return next;
      });
    });
    return () => unsub();
  }, []);

  const filtered = useMemo(() => {
    if (tab === "all") return orders;
    return orders.filter((o) => (
      tab === "pending" ? o.status === "pending" :
      tab === "accepted" ? o.status === "accepted" :
      o.status === "paid"
    ));
  }, [orders, tab]);

  async function acceptOrder(o: any) {
    try {
      await updateDoc(doc(db, "orders", o.id), { status: "accepted", acceptedAt: new Date() as any });
      const txt = customerAcceptText(o);
      sendWhatsAppToCustomer(o, txt);
    } catch (e) {
      console.error(e);
      alert("Akkoord zetten mislukt. Probeer het opnieuw.");
    }
  }

  async function markPaid(o: any) {
    try {
      await updateDoc(doc(db, "orders", o.id), { status: "paid", paidAt: new Date() as any });
    } catch (e) {
      console.error(e);
      alert("Markeren als betaald mislukt.");
    }
  }

  async function saveTikkie(o: any) {
    try {
      await updateDoc(doc(db, "orders", o.id), { tikkieUrl: tikkie[o.id] || "" });
      alert("Tikkie-link opgeslagen.");
    } catch (e) {
      console.error(e);
      alert("Opslaan van Tikkie-link mislukt.");
    }
  }

  function sendTikkie(o: any) {
    const url = (tikkie[o.id] || o.tikkieUrl || "").trim();
    if (!url) {
      alert("Vul eerst de Tikkie-link in.");
      return;
    }
    const name = o.customerName || "";
    const msg = `Hoi ${name}, hierbij de Tikkie voor je MadCrew bestelling: ${url} Thanks! 🤘`;
    sendWhatsAppToCustomer(o, msg);
  }

  function sendWhatsAppToCustomer(o: any, message: string) {
    const phone = normalizePhone(o.customerPhone || "");
    if (!phone) {
      alert("Geen geldig telefoonnummer gevonden bij deze bestelling.");
      return;
    }
    const href = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
    window.open(href, "_blank");
  }

  function normalizePhone(p: string) {
    const digits = (p || "").replace(/[^0-9]/g, "");
    if (!digits) return "";
    if (digits.startsWith("06")) return "31" + digits.slice(1);
    if (digits.startsWith("6") && digits.length === 9) return "31" + digits;
    if (digits.startsWith("31")) return digits;
    if (digits.startsWith("+31")) return digits.replace("+", "");
    return digits;
  }

  function customerAcceptText(o: any) {
    const name = o.customerName || "";
    return (
      `Hoi ${name}! Je bestelling is geaccepteerd. ` +
      `Je krijgt zo een Tikkie om te betalen. ` +
      `Groet, MadCrew 🤘`
    );
  }
    } catch (e) {
      console.error(e);
      alert("Akkoord zetten mislukt. Probeer het opnieuw.");
    }
  }

  function normalizePhone(p: string) {
    const digits = (p || "").replace(/[^0-9]/g, "");
    if (!digits) return "";
    // If user types 06..., convert to 316...
    if (digits.startsWith("06")) return "31" + digits.slice(1);
    if (digits.startsWith("6") && digits.length === 9) return "31" + digits; // 6xxxxxxxx
    if (digits.startsWith("31")) return digits;
    if (digits.startsWith("+31")) return digits.replace("+", "");
    return digits; // fallback
  }

  function customerAcceptText(o: any) {
    const name = o.customerName || "";
    return (
      `Hoi ${name}! Je bestelling is geaccepteerd. ` +
      `Je krijgt zo een Tikkie om te betalen. ` +
      `Groet, MadCrew 🤘`
    );
  }

  return (
    // <RequireAdmin>
    <div className="mx-auto max-w-5xl p-4">
      <h1 className="text-2xl font-semibold">Bestellingen</h1>
      <div className="mt-4 inline-flex rounded-2xl border p-1 text-sm">
        {["pending", "accepted", "paid", "all"].map((t) => (
          <button
            key={t}
            onClick={() => setTab(t as any)}
            className={`px-3 py-1 rounded-xl ${tab === t ? "bg-black text-white" : "hover:bg-neutral-100"}`}
          >
            {t === "pending" ? "Wacht op akkoord" : t === "accepted" ? "Geaccepteerd" : "Alles"}
          </button>
        ))}
      </div>

      <div className="mt-4 border rounded-3xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-neutral-600">
            <tr>
              <th className="text-left p-3">Datum</th>
              <th className="text-left p-3">Klant</th>
              <th className="text-left p-3">Items</th>
              <th className="text-right p-3">Totaal</th>
              <th className="text-left p-3">Ronde</th>
              <th className="text-left p-3">Tikkie</th>
              <th className="text-right p-3">Actie</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((o) => (
              <tr key={o.id} className="border-t">
                <td className="p-3 align-top">{o.createdAt?.toDate ? o.createdAt.toDate().toLocaleString("nl-NL") : "—"}</td>
                <td className="p-3 align-top">
                  <div className="font-medium">{o.customerName}</div>
                  <div className="text-neutral-600">{o.customerPhone}</div>
                  {o.deliveryMethod && (
                    <div className="text-neutral-600">{o.deliveryMethod}{o.address ? ` — ${o.address}` : ""}</div>
                  )}
                </td>
                <td className="p-3 align-top">
                  <ul className="list-disc pl-4">
                    {(o.items || []).map((i: any, idx: number) => (
                      <li key={idx}>{i.name} × {i.qty}</li>
                    ))}
                  </ul>
                  {o.notes && <div className="text-neutral-600 mt-1">Opmerkingen: {o.notes}</div>}
                </td>
                <td className="p-3 text-right align-top font-semibold">{formatEUR(o.total || 0)}</td>
                <td className="p-3 align-top">{o.roundName || o.roundId || "—"}</td>
                <td className="p-3 align-top min-w-[260px]">
                  <div className="flex gap-2">
                    <input
                      value={tikkie[o.id] ?? ""}
                      onChange={(e) => setTikkie((m) => ({ ...m, [o.id]: e.target.value }))}
                      placeholder="https://tikkie.me/..."
                      className="flex-1 rounded-xl border px-3 py-2 text-sm"
                    />
                    <button onClick={() => saveTikkie(o)} className="rounded-xl border px-3 py-2 text-sm">Opslaan</button>
                  </div>
                  <div className="mt-2 flex gap-2">
                    <button onClick={() => sendTikkie(o)} className="rounded-xl bg-black text-white px-3 py-2 text-sm">Stuur Tikkie</button>
                    {o.status !== 'paid' && (
                      <button onClick={() => markPaid(o)} className="rounded-xl border px-3 py-2 text-sm">Markeer betaald</button>
                    )}
                  </div>
                </td>
                <td className="p-3 text-right align-top">
                  {o.status === "pending" ? (
                    <button onClick={() => acceptOrder(o)} className="rounded-xl bg-black text-white px-3 py-2 shadow hover:shadow-md">Accepteren</button>
                  ) : (
                    <span className="inline-flex items-center rounded-xl border px-2 py-1">Geaccepteerd</span>
                  )}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="p-6 text-center text-neutral-600">Geen bestellingen in deze weergave.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
    // </RequireAdmin>
  );
}


// ==============================
// Admin: Rounds Page (beheer bestelrondes)
// File: app/backoffice/rounds/page.tsx
// ==============================
"use client";
import React, { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import {
  addDoc,
  collection,
  getDocs,
  onSnapshot,
  query,
  updateDoc,
  doc,
} from "firebase/firestore";

export function RoundsAdminPage() {
  const [name, setName] = useState("");
  const [rounds, setRounds] = useState<any[]>([]);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "rounds"), (snap) => {
      setRounds(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));
    });
    return () => unsub();
  }, []);

  async function createRound() {
    if (!name.trim()) return;
    await addDoc(collection(db, "rounds"), { name, status: "closed", createdAt: new Date() as any });
    setName("");
  }

  async function setOpen(r: any) {
    // Mark this round open and close others
    const all = await getDocs(query(collection(db, "rounds")));
    await Promise.all(
      all.docs.map((d) => updateDoc(doc(db, "rounds", d.id), { status: d.id === r.id ? "open" : "closed" }))
    );
  }

  async function setClosed(r: any) {
    await updateDoc(doc(db, "rounds", r.id), { status: "closed" });
  }

  return (
    <div className="mx-auto max-w-3xl p-4">
      <h1 className="text-2xl font-semibold">Bestelrondes</h1>

      <div className="mt-4 rounded-2xl border p-3 flex gap-2">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Naam van ronde (bijv. Najaar 2025)" className="flex-1 rounded-xl border px-3 py-2" />
        <button onClick={createRound} className="rounded-xl bg-black text-white px-4">Nieuwe ronde</button>
      </div>

      <div className="mt-4 border rounded-3xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-neutral-600">
            <tr>
              <th className="text-left p-3">Naam</th>
              <th className="text-left p-3">Status</th>
              <th className="text-right p-3">Acties</th>
            </tr>
          </thead>
          <tbody>
            {rounds.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="p-3">{r.name || r.id}</td>
                <td className="p-3">{r.status}</td>
                <td className="p-3 text-right space-x-2">
                  {r.status !== "open" ? (
                    <button onClick={() => setOpen(r)} className="rounded-xl bg-black text-white px-3 py-2">Zet open</button>
                  ) : (
                    <button onClick={() => setClosed(r)} className="rounded-xl border px-3 py-2">Sluit</button>
                  )}
                </td>
              </tr>
            ))}
            {rounds.length === 0 && (
              <tr><td colSpan={3} className="p-6 text-center text-neutral-600">Nog geen rondes.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}