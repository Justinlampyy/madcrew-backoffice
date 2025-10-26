"use client";
import RequireAdmin from "@/components/RequireAdmin";
import Link from "next/link";
import { db } from "@/lib/firebase";
import { addDoc, collection, getDocs, onSnapshot, query, updateDoc, doc } from "firebase/firestore";
import { useEffect, useState } from "react";

export default function RoundsAdminPage() {
  const [name, setName] = useState("");
  const [rounds, setRounds] = useState<any[]>([]);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "rounds"), (snap) =>
      setRounds(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })))
    );
    return () => unsub();
  }, []);

  async function createRound() {
    if (!name.trim()) return;
    await addDoc(collection(db, "rounds"), { name, status: "closed", createdAt: new Date() as any });
    setName("");
  }

  async function setOpen(r: any) {
    const all = await getDocs(query(collection(db, "rounds")));
    await Promise.all(
      all.docs.map((d) =>
        updateDoc(doc(db, "rounds", d.id), { status: d.id === r.id ? "open" : "closed" })
      )
    );
  }

  async function setClosed(r: any) {
    await updateDoc(doc(db, "rounds", r.id), { status: "closed" });
  }

  return (
    <RequireAdmin>
      <div className="mx-auto max-w-4xl p-4">
        <h1 className="text-2xl font-semibold">Bestelrondes</h1>

        <div className="mt-4 rounded-2xl border p-3 flex gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Naam (bijv. Najaar 2025)"
            className="flex-1 rounded-xl border px-3 py-2"
          />
          <button onClick={createRound} className="rounded-xl bg-black text-white px-4">
            Nieuwe ronde
          </button>
        </div>

        <div className="mt-4 border rounded-3xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-neutral-600">
              <tr>
                <th className="text-left p-3">Naam</th>
                <th className="text-left p-3">Status</th>
                <th className="text-left p-3">Drukker</th>
                <th className="text-right p-3">Acties</th>
              </tr>
            </thead>
            <tbody>
              {rounds.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="p-3">{r.name || r.id}</td>
                  <td className="p-3">{r.status}</td>

                  {/* <<< HIER STAAT JE OUDE LINK WEER >>> */}
                  <td className="p-3">
                    <Link
                      className="inline-flex items-center rounded-xl border px-3 py-2 hover:bg-neutral-50"
                      href={`/admin/rounds/${r.id}/drukker`}
                    >
                      Overzicht voor drukker
                    </Link>
                  </td>

                  <td className="p-3 text-right space-x-2">
                    {r.status !== "open" ? (
                      <button
                        onClick={() => setOpen(r)}
                        className="rounded-xl bg-black text-white px-3 py-2"
                      >
                        Zet open
                      </button>
                    ) : (
                      <button
                        onClick={() => setClosed(r)}
                        className="rounded-xl border px-3 py-2"
                      >
                        Sluit
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {rounds.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-6 text-center text-neutral-600">
                    Nog geen rondes.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </RequireAdmin>
  );
}