"use client";
import React, { useState, useEffect } from "react";
import { Search, RotateCcw, Phone, MessageCircle, MapPin, Star, CheckSquare, Square, PlusCircle, Upload, X } from "lucide-react";

export default function Home() {
  const [transports, setTransports] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [isSuggestOpen, setIsSuggestOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState("");

  const [suggest, setSuggest] = useState({ name: "", address: "", placesServed: "", contact1: "", caption1: "", suggestedBy: "" });

  const loadData = async (term = "") => {
    setLoading(true);
    try {
      const res = await fetch(`/api?query=${encodeURIComponent(term)}`);
      const data = await res.json();
      setTransports(data.records || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const toggleSelect = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter((x) => x !== id));
    } else {
      if (selectedIds.length >= 5) {
        alert("You can share a maximum of 5 transport details at a time.");
        return;
      }
      setSelectedIds([...selectedIds, id]);
    }
  };

  const handleShare = async () => {
    const res = await fetch("/api", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "share", transportIds: selectedIds })
    });
    const d = await res.json();
    if (d.url) window.open(d.url, "_blank");
  };

  const handleExcelUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    setStatus("Uploading & Merging Records...");
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api", { method: "POST", body: fd });
    const d = await res.json();
    setStatus(d.message || "Done!");
    loadData();
  };

  const handleSuggest = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch("/api", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "suggest", ...suggest })
    });
    alert("Thank you! Suggestion submitted.");
    setIsSuggestOpen(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between">
      <header className="bg-[#0f2b5c] text-white py-3 px-4 sticky top-0 z-40 shadow">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl sm:text-2xl font-black">TRANSPORT DIRECTORY</h1>
            <p className="text-xs text-blue-200">Find Transport Services Starting from HUBLI</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setIsSuggestOpen(true)} className="text-xs bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded font-semibold flex items-center gap-1">
              <PlusCircle size={14} /> Suggest
            </button>
            <button onClick={() => setIsAdminOpen(true)} className="text-xs bg-emerald-600 hover:bg-emerald-500 px-3 py-1.5 rounded font-semibold flex items-center gap-1">
              <Upload size={14} /> Import Excel
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 w-full flex-1 pb-24">
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 my-4 flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by Transport Name, Destination City (Pune, Bangalore) or Phone..."
            className="flex-1 p-2.5 border rounded-lg text-sm"
          />
          <button onClick={() => loadData(search)} className="bg-[#0f2b5c] text-white px-6 py-2.5 rounded-lg text-sm font-bold">Search</button>
          {search && <button onClick={() => { setSearch(""); loadData(""); }} className="bg-gray-100 px-4 py-2.5 rounded-lg text-sm font-semibold">Clear</button>}
        </div>

        {loading ? (
          <div className="py-20 text-center text-gray-400">Loading Transports...</div>
        ) : transports.length === 0 ? (
          <div className="py-20 text-center bg-white rounded-xl border border-dashed text-gray-500">
            No transport companies found. Click "Import Excel" above to upload your records!
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {transports.map((t) => (
              <div key={t.id} className={`border rounded-xl p-4 bg-white shadow-sm ${selectedIds.includes(t.id) ? "border-[#0f2b5c] ring-2 ring-blue-100" : ""}`}>
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-2.5">
                    <button onClick={() => toggleSelect(t.id)} className="mt-1 text-[#0f2b5c]">
                      {selectedIds.includes(t.id) ? <CheckSquare size={22} className="fill-blue-50" /> : <Square size={22} className="text-gray-300" />}
                    </button>
                    <div>
                      <h3 className="text-base font-bold text-[#0f2b5c] uppercase">{t.name}</h3>
                      <div className="flex items-center gap-1 text-xs text-gray-500"><MapPin size={12} className="text-red-500" /> Hubli to multiple cities</div>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 flex items-center gap-1">
                    <Star size={12} className="fill-amber-400 text-amber-400" /> {t.averageRating > 0 ? t.averageRating : "New"}
                  </span>
                </div>

                {t.address && <p className="text-xs text-gray-600 mt-2 pl-8">{t.address}</p>}

                <div className="mt-3 pl-8">
                  <span className="text-[11px] font-bold text-gray-400 block mb-1">PLACES SERVED ({t.servedCities.length}):</span>
                  <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto">
                    {t.servedCities.map((c: string, idx: number) => (
                      <span key={idx} className="bg-slate-100 text-slate-800 text-[11px] px-2 py-0.5 rounded font-medium">{c}</span>
                    ))}
                  </div>
                </div>

                <div className="mt-3 pt-2.5 border-t border-gray-100 pl-8 space-y-1">
                  {t.contacts.map((c: any, i: number) => (
                    <div key={i} className="flex items-center justify-between bg-gray-50 p-1.5 rounded text-xs">
                      <span><strong>{c.phone}</strong> {c.caption && <span className="bg-blue-100 text-blue-900 px-1 py-0.5 rounded text-[10px]">{c.caption}</span>}</span>
                      <div className="flex gap-1">
                        <a href={`tel:+91${c.phone}`} className="bg-[#0f2b5c] text-white px-2 py-1 rounded text-[11px] font-bold">Call</a>
                        <a href={`https://wa.me/91${c.phone}`} target="_blank" className="bg-[#25D366] text-white px-2 py-1 rounded text-[11px] font-bold">WhatsApp</a>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {selectedIds.length > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 w-[90%] max-w-md bg-[#0f2b5c] text-white p-3 rounded-2xl shadow-xl flex items-center justify-between z-50">
          <span className="text-xs font-bold">{selectedIds.length} of 5 selected</span>
          <button onClick={handleShare} className="bg-[#25D366] text-white font-bold text-xs px-4 py-2 rounded-xl flex items-center gap-1.5">
            <MessageCircle size={15} /> Share on WhatsApp
          </button>
        </div>
      )}

      {isAdminOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full relative">
            <button onClick={() => setIsAdminOpen(false)} className="absolute top-4 right-4 text-gray-400"><X size={20} /></button>
            <h3 className="font-bold text-lg text-[#0f2b5c] mb-1">Import Excel Sheet</h3>
            <p className="text-xs text-gray-500 mb-4">Upload your .xlsx file with Place, Transport Name, Address, and Contacts.</p>
            <form onSubmit={handleExcelUpload} className="space-y-3 text-xs">
              <input type="file" accept=".xlsx,.xls" onChange={(e) => setFile(e.target.files?.[0] || null)} className="w-full text-xs" />
              <button type="submit" className="w-full bg-[#25D366] text-white font-bold py-2 rounded-lg">Upload & Merge Transports</button>
            </form>
            {status && <p className="mt-3 text-xs font-bold text-blue-900 bg-blue-50 p-2 rounded">{status}</p>}
          </div>
        </div>
      )}

      {isSuggestOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full relative">
            <button onClick={() => setIsSuggestOpen(false)} className="absolute top-4 right-4 text-gray-400"><X size={20} /></button>
            <h3 className="font-bold text-lg text-[#0f2b5c] mb-3">Suggest a Transport</h3>
            <form onSubmit={handleSuggest} className="space-y-2 text-xs">
              <input required placeholder="Transport Name" value={suggest.name} onChange={(e) => setSuggest({ ...suggest, name: e.target.value })} className="w-full p-2 border rounded" />
              <input placeholder="Hubli Address" value={suggest.address} onChange={(e) => setSuggest({ ...suggest, address: e.target.value })} className="w-full p-2 border rounded" />
              <input placeholder="Places Served (comma-separated)" value={suggest.placesServed} onChange={(e) => setSuggest({ ...suggest, placesServed: e.target.value })} className="w-full p-2 border rounded" />
              <input placeholder="Contact Phone" value={suggest.contact1} onChange={(e) => setSuggest({ ...suggest, contact1: e.target.value })} className="w-full p-2 border rounded" />
              <input placeholder="Your Name" required value={suggest.suggestedBy} onChange={(e) => setSuggest({ ...suggest, suggestedBy: e.target.value })} className="w-full p-2 border rounded" />
              <button type="submit" className="w-full bg-[#0f2b5c] text-white font-bold py-2 rounded mt-2">Submit</button>
            </form>
          </div>
        </div>
      )}

      <footer className="bg-white border-t py-4 text-center text-xs text-gray-500">
        <p className="font-bold text-gray-800">Transport Directory — Jain Computers, Hubli</p>
        <p>Visit Jain Computers, Hubli for all your IT & Printers Needs.</p>
      </footer>
    </div>
  );
}
