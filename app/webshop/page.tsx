"use client";
import React, { useState } from "react";

type Product = { id: string; name: string; price: number; image?: string };

export type CartItem = { id: string; name: string; price: number; qty: number };

const CONTACT = {
  whatsappNumber: "+31645355131",
  email: "madcrewbikers@gmail.com",
  businessName: "MadCrew Bikers",
};

const PRODUCTS: Product[] = [
  { id: "hoodie", name: "Hoodie", price: 55 },
  { id: "pullover", name: "Pull-over", price: 50 },
  { id: "tshirt-unisex", name: "T-shirt (unisex/dames)", price: 30 },
  { id: "tshirt-kids", name: "Kinder T-shirt", price: 20 },
  { id: "softshell", name: "Softshell jas", price: 65 },
  { id: "paraplu", name: "Paraplu", price: 20 },
  { id: "slippers", name: "Slippers", price: 15 },
];

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
  return encodeURIComponent(lines.join("\n"));
}

export default function WebshopPage() {
  const [cart, setCart] = useState<CartItem[]>([]);

  function addToCart(p: Product) {
    setCart((c) => {
      const found = c.find((x) => x.id === p.id);
      if (found) return c.map((x) => (x.id === p.id ? { ...x, qty: x.qty + 1 } : x));
      return [...c, { id: p.id, name: p.name, price: p.price, qty: 1 }];
    });
  }

  function changeQty(id: string, qty: number) {
    setCart((c) => c.map((x) => (x.id === id ? { ...x, qty } : x)).filter((x) => x.qty > 0));
  }

  const total = cart.reduce((s, i) => s + i.price * i.qty, 0);

  return (
    <div className="mx-auto max-w-4xl p-6">
      <h1 className="text-2xl font-semibold mb-4">Webshop</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {PRODUCTS.map((p) => (
          <div key={p.id} className="border rounded-lg p-4 flex flex-col">
            <div className="flex-1">
              <div className="font-medium">{p.name}</div>
              <div className="text-sm text-neutral-600">{formatEUR(p.price)}</div>
            </div>
            <div className="mt-4">
              <button onClick={() => addToCart(p)} className="rounded-xl bg-black text-white px-3 py-2">Voeg toe</button>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 border rounded-xl p-4">
        <h2 className="font-semibold">Winkelwagen</h2>
        {cart.length === 0 ? (
          <div className="text-neutral-600 mt-2">Winkelwagen is leeg.</div>
        ) : (
          <div className="mt-2">
            <ul className="divide-y">
              {cart.map((i) => (
                <li key={i.id} className="py-2 flex items-center justify-between">
                  <div>
                    <div className="font-medium">{i.name}</div>
                    <div className="text-sm text-neutral-600">{formatEUR(i.price)} × {i.qty}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="number" min={1} value={i.qty} onChange={(e) => changeQty(i.id, Number(e.target.value) || 1)} className="w-20 rounded border px-2 py-1" />
                    <div className="font-semibold">{formatEUR(i.price * i.qty)}</div>
                  </div>
                </li>
              ))}
            </ul>

            <div className="mt-4 flex items-center justify-between">
              <div className="font-semibold">Totaal</div>
              <div className="font-bold text-lg">{formatEUR(total)}</div>
            </div>

            <div className="mt-4 flex gap-2">
              <a className="rounded-xl bg-green-600 text-white px-4 py-2" href={`https://wa.me/${CONTACT.whatsappNumber.replace(/\+/g, '')}?text=${toWhatsAppText(cart, total)}`} target="_blank" rel="noreferrer">Bestel via WhatsApp</a>
              <a className="rounded-xl border px-4 py-2" href={`mailto:${CONTACT.email}?subject=Nieuwe bestelling&body=${encodeURIComponent('Totaal: ' + formatEUR(total))}`}>Bestel via e-mail</a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
"use client";
import React, { useState } from "react";

type Product = { id: string; name: string; price: number; image?: string };

export type CartItem = { id: string; name: string; price: number; qty: number };

const CONTACT = {
  whatsappNumber: "+31645355131",
  email: "madcrewbikers@gmail.com",
  businessName: "MadCrew Bikers",
};

const PRODUCTS: Product[] = [
  { id: "hoodie", name: "Hoodie", price: 55 },
  { id: "pullover", name: "Pull-over", price: 50 },
  { id: "tshirt-unisex", name: "T-shirt (unisex/dames)", price: 30 },
  { id: "tshirt-kids", name: "Kinder T-shirt", price: 20 },
  { id: "softshell", name: "Softshell jas", price: 65 },
  { id: "paraplu", name: "Paraplu", price: 20 },
  { id: "slippers", name: "Slippers", price: 15 },
];

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
  return encodeURIComponent(lines.join("\n"));
}

export default function WebshopPage() {
  const [cart, setCart] = useState<CartItem[]>([]);

  function addToCart(p: Product) {
    setCart((c) => {
      const found = c.find((x) => x.id === p.id);
      if (found) return c.map((x) => (x.id === p.id ? { ...x, qty: x.qty + 1 } : x));
      return [...c, { id: p.id, name: p.name, price: p.price, qty: 1 }];
    });
  }

  function changeQty(id: string, qty: number) {
    setCart((c) => c.map((x) => (x.id === id ? { ...x, qty } : x)).filter((x) => x.qty > 0));
  }

  const total = cart.reduce((s, i) => s + i.price * i.qty, 0);

  return (
    <div className="mx-auto max-w-4xl p-6">
      <h1 className="text-2xl font-semibold mb-4">Webshop</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {PRODUCTS.map((p) => (
          <div key={p.id} className="border rounded-lg p-4 flex flex-col">
            <div className="flex-1">
              <div className="font-medium">{p.name}</div>
              <div className="text-sm text-neutral-600">{formatEUR(p.price)}</div>
            </div>
            <div className="mt-4">
              <button onClick={() => addToCart(p)} className="rounded-xl bg-black text-white px-3 py-2">Voeg toe</button>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 border rounded-xl p-4">
        <h2 className="font-semibold">Winkelwagen</h2>
        {cart.length === 0 ? (
          <div className="text-neutral-600 mt-2">Winkelwagen is leeg.</div>
        ) : (
          <div className="mt-2">
            <ul className="divide-y">
              {cart.map((i) => (
                <li key={i.id} className="py-2 flex items-center justify-between">
                  <div>
                    <div className="font-medium">{i.name}</div>
                    <div className="text-sm text-neutral-600">{formatEUR(i.price)} × {i.qty}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="number" min={1} value={i.qty} onChange={(e) => changeQty(i.id, Number(e.target.value) || 1)} className="w-20 rounded border px-2 py-1" />
                    <div className="font-semibold">{formatEUR(i.price * i.qty)}</div>
                  </div>
                </li>
              ))}
            </ul>

            <div className="mt-4 flex items-center justify-between">
              <div className="font-semibold">Totaal</div>
              <div className="font-bold text-lg">{formatEUR(total)}</div>
            </div>

            <div className="mt-4 flex gap-2">
              <a className="rounded-xl bg-green-600 text-white px-4 py-2" href={`https://wa.me/${CONTACT.whatsappNumber.replace(/\+/g, '')}?text=${toWhatsAppText(cart, total)}`} target="_blank" rel="noreferrer">Bestel via WhatsApp</a>
              <a className="rounded-xl border px-4 py-2" href={`mailto:${CONTACT.email}?subject=Nieuwe bestelling&body=${encodeURIComponent('Totaal: ' + formatEUR(total))}`}>Bestel via e-mail</a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
"use client";
import React, { useState } from "react";

type Product = {
  id: string;
  name: string;
  price: number;
  image?: string;
};
"use client";
import React, { useState } from "react";

type Product = { id: string; name: string; price: number; image?: string };

export type CartItem = { id: string; name: string; price: number; qty: number };

const CONTACT = {
  whatsappNumber: "+31645355131",
  email: "madcrewbikers@gmail.com",
  businessName: "MadCrew Bikers",

              <div className="font-bold text-lg">{formatEUR(total)}</div>
            </div>

            <div className="mt-4 flex gap-2">
              <a className="rounded-xl bg-green-600 text-white px-4 py-2" href={`https://wa.me/${CONTACT.whatsappNumber.replace(/\+/g, '')}?text=${toWhatsAppText(cart, total)}`} target="_blank" rel="noreferrer">Bestel via WhatsApp</a>
              <a className="rounded-xl border px-4 py-2" href={`mailto:${CONTACT.email}?subject=Nieuwe bestelling&body=${encodeURIComponent('Totaal: ' + formatEUR(total))}`}>Bestel via e-mail</a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
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

