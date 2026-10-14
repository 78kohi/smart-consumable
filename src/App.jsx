import { useEffect, useMemo, useState } from "react";
import { initialInventory } from "./data/inventory";
import {
  calculate_priority,
  getExpiryAlert,
  get_expiry_status,
  get_priority_label,
  sortInventory,
  calculate_health_rating,
} from "./utils/scoring";
import "./App.css";

const emptyForm = {
  name: "",
  sugar: "",
  carbs: "",
  fat: "",
  protein: "",
  expiry: "",
};

const formatDate = (value) => {
  if (!value) return "No date";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
};

const slug = (value = "") => value.toLowerCase().replace(/\s+/g, "-");

function App() {
  const [inventory, setInventory] = useState(() => {
    const savedInventory = localStorage.getItem("smartconsume-inventory");
    if (!savedInventory) return initialInventory;

    try {
      return JSON.parse(savedInventory);
    } catch {
      return initialInventory;
    }
  });
  const [formData, setFormData] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeView, setActiveView] = useState("overview");
  const [toast, setToast] = useState("");

  useEffect(() => {
    localStorage.setItem("smartconsume-inventory", JSON.stringify(inventory));
  }, [inventory]);

  const sortedInventory = useMemo(() => sortInventory(inventory), [inventory]);
  const filteredInventory = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    const list = query
      ? sortedInventory.filter((item) => item.name.toLowerCase().includes(query))
      : sortedInventory;
    if (activeView === "priority") {
      return list.filter((item) => {
        const status = get_expiry_status(item.expiry);
        return ["Segera", "Kedaluwarsa hari ini", "Kedaluwarsa"].includes(status);
      });
    }
    return list;
  }, [activeView, searchTerm, sortedInventory]);

  const totalItems = inventory.length;
  const urgentItems = inventory.filter((item) =>
    ["Segera", "Kedaluwarsa hari ini", "Kedaluwarsa"].includes(get_expiry_status(item.expiry))
  ).length;
  const avgPriority = totalItems
    ? Math.round(
        inventory.reduce((sum, item) => sum + (calculate_priority(item).priority || 0), 0) /
          totalItems
      )
    : 0;

  function showToast(message) {
    setToast(message);
    window.clearTimeout(showToast.timeout);
    showToast.timeout = window.setTimeout(() => setToast(""), 2800);
  }

  function resetForm() {
    setFormData(emptyForm);
    setEditingId(null);
  }

  function handleChange(event) {
    const { name, value } = event.target;
    setFormData((current) => ({ ...current, [name]: value }));
  }

  function handleSubmit(event) {
    event.preventDefault();
    const name = formData.name.trim();
    if (!name || !formData.expiry) {
      showToast("Tambahkan nama produk dan tanggal kedaluwarsa terlebih dahulu.");
      return;
    }

    const numericFields = ["sugar", "carbs", "fat", "protein"];
    const values = Object.fromEntries(
      numericFields.map((key) => [key, formData[key] === "" ? NaN : Number(formData[key])])
    );
    if (numericFields.some((key) => !Number.isFinite(values[key]) || values[key] < 0)) {
      showToast("Masukkan nilai nutrisi yang valid dan tidak negatif.");
      return;
    }

    const itemData = { name, ...values, expiry: formData.expiry };
    if (editingId !== null) {
      setInventory((current) =>
        current.map((item) => (item.id === editingId ? { ...item, ...itemData } : item))
      );
      showToast(`${name} berhasil diperbarui.`);
    } else {
      setInventory((current) => [{ id: Date.now(), ...itemData }, ...current]);
      showToast(`${name} ditambahkan ke stok.`);
    }
    resetForm();
  }

  function handleEdit(item) {
    setEditingId(item.id);
    setFormData({
      name: item.name,
      sugar: String(item.sugar ?? ""),
      carbs: String(item.carbs ?? ""),
      fat: String(item.fat ?? ""),
      protein: String(item.protein ?? ""),
      expiry: item.expiry ?? "",
    });
    document.getElementById("product-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function handleDelete(id) {
    const item = inventory.find((entry) => entry.id === id);
    setInventory((current) => current.filter((entry) => entry.id !== id));
    if (editingId === id) resetForm();
    showToast(`${item?.name ?? "Produk"} dihapus dari stok.`);
  }

  function exportInventory() {
    const headers = ["Nama", "Gula (g)", "Karbohidrat (g)", "Lemak (g)", "Protein (g)", "Kedaluwarsa", "Prioritas", "Kesehatan"];
    const rows = inventory.map((item) => {
      const score = calculate_priority(item);
      return [item.name, item.sugar, item.carbs, item.fat, item.protein, item.expiry, score.priority, score.health];
    });
    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "smartconsume-inventory.csv";
    link.click();
    URL.revokeObjectURL(url);
    showToast("Stok berhasil diekspor sebagai CSV.");
  }

  function navigate(view) {
    setActiveView(view);
    if (view === "add") {
      resetForm();
      document.getElementById("product-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
    } else if (view === "inventory" || view === "priority" || view === "overview") {
      document.getElementById("inventory-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#top" onClick={() => setActiveView("overview")}>
          <span className="brand-mark" aria-hidden="true"><span>SC</span></span>
          <span className="brand-copy"><strong>SmartConsume</strong><small>STOK CERDAS</small></span>
        </a>

        <div className="side-label">RUANG KERJA</div>
        <nav className="nav-list" aria-label="Main navigation">
          <button className={`nav-item ${activeView === "overview" ? "is-active" : ""}`} onClick={() => navigate("overview")}>
            <span className="nav-icon">◫</span> Ringkasan
          </button>
          <button className={`nav-item ${activeView === "inventory" ? "is-active" : ""}`} onClick={() => navigate("inventory")}>
            <span className="nav-icon">▤</span> Stok <span className="nav-count">{totalItems}</span>
          </button>
          <button className={`nav-item ${activeView === "priority" ? "is-active" : ""}`} onClick={() => navigate("priority")}>
            <span className="nav-icon">↗</span> Prioritas {urgentItems > 0 && <span className="nav-dot" />}
          </button>
          <button className={`nav-item ${activeView === "add" ? "is-active" : ""}`} onClick={() => navigate("add")}>
            <span className="nav-icon">＋</span> Tambah produk
          </button>
        </nav>

        <div className="sidebar-bottom">
          <div className="attention-card">
            <div className="attention-icon">!</div>
            <div><strong>{urgentItems} item perlu perhatian</strong><p>Cek daftar prioritas untuk mengurangi pemborosan.</p></div>
            <button aria-label="View priority queue" onClick={() => navigate("priority")}>→</button>
          </div>
          <div className="sidebar-footer"><span className="status-indicator" /> Stok sudah diperbarui</div>
        </div>
      </aside>

      <section className="main-area" id="top">
        <header className="topbar">
          <div className="breadcrumbs"><span>Ruang kerja</span><span className="crumb-slash">/</span><strong>{activeView === "priority" ? "Prioritas" : activeView === "add" ? "Tambah produk" : activeView === "inventory" ? "Stok" : "Ringkasan"}</strong></div>
          <div className="topbar-right">
            <span className="today-label">RINGKASAN STOK</span>
            <div className="avatar" aria-label="SmartConsume workspace">SC</div>
          </div>
        </header>

        <div className="page-content">
          <section className="page-heading">
            <div>
              <p className="eyebrow"><span className="eyebrow-line" /> STOK ANDA, SEKILAS LIHAT</p>
              <h1>{activeView === "priority" ? "Prioritas" : activeView === "add" ? (editingId !== null ? "Edit produk" : "Tambah produk") : activeView === "inventory" ? "Stok" : "Ringkasan"}</h1>
              <p className="page-subtitle">{activeView === "priority" ? "Produk yang harus di lebih dulu berdasarkan status kedaluwarsanya." : "Gambaran yang lebih jelas tentang produk, nutrisi, dan tanggal kedaluwarsa Anda."}</p>
            </div>
            <div className="heading-actions">
              <button className="button button-secondary" type="button" onClick={exportInventory}><span>↓</span> Ekspor CSV</button>
              <button className="button button-primary" type="button" onClick={() => navigate("add")}><span>＋</span> Tambah produk</button>
            </div>
          </section>

          <section className="stats-grid" aria-label="Inventory summary">
            <article className="stat-card">
              <div className="stat-top"><span className="stat-icon icon-blue">▤</span><span className="stat-caption">SEMUA PRODUK</span></div>
              <div className="stat-value">{totalItems}<span className="stat-unit">item</span></div>
              <p className="stat-foot">Produk yang sedang dipantau</p>
              <div className="stat-progress"><span style={{ width: `${Math.min(totalItems * 5, 100)}%` }} /></div>
            </article>
            <article className="stat-card">
              <div className="stat-top"><span className="stat-icon icon-orange">!</span><span className="stat-caption">PERLU PERHATIAN</span></div>
              <div className="stat-value">{urgentItems}<span className="stat-unit">item</span></div>
              <p className="stat-foot">Kedaluwarsa atau akan segera kadaluarsa</p>
              <div className="stat-progress progress-orange"><span style={{ width: `${totalItems ? (urgentItems / totalItems) * 100 : 0}%` }} /></div>
            </article>
            <article className="stat-card">
              <div className="stat-top"><span className="stat-icon icon-indigo">↗</span><span className="stat-caption">RATA-RATA PRIORITAS</span></div>
              <div className="stat-value">{avgPriority}<span className="stat-unit">/ 100</span></div>
              <p className="stat-foot">Skor prioritas gabungan stok</p>
              <div className="stat-progress progress-indigo"><span style={{ width: `${Math.min(avgPriority, 100)}%` }} /></div>
            </article>
          </section>

          <div className="content-grid">
            <section className="panel editor-panel" id="product-form">
              <div className="panel-heading">
                <div className="panel-title-wrap"><span className="panel-kicker">DETAIL PRODUK</span><h2>{editingId !== null ? "Edit produk" : "Tambah produk baru"}</h2></div>
                <span className="panel-step">01 <span>/ 01</span></span>
              </div>
              <p className="panel-description">Masukkan nutrisi dan tanggal kedaluwarsa agar data stok Anda akurat.</p>
              <form className="product-form" onSubmit={handleSubmit}>
                <label className="field full-field"><span>Nama produk <b>*</b></span><input autoComplete="off" name="name" value={formData.name} onChange={handleChange} placeholder="mis. Yogurt Yunani" required /></label>
                <div className="section-divider"><span>NUTRISI PER PORSI</span><span>gram (g)</span></div>
                <div className="nutrition-grid">
                  <label className="field"><span>Gula</span><div className="input-with-unit"><input type="number" name="sugar" min="0" step="0.1" value={formData.sugar} onChange={handleChange} placeholder="0.0" required /><span>g</span></div></label>
                  <label className="field"><span>Karbohidrat</span><div className="input-with-unit"><input type="number" name="carbs" min="0" step="0.1" value={formData.carbs} onChange={handleChange} placeholder="0.0" required /><span>g</span></div></label>
                  <label className="field"><span>Lemak total</span><div className="input-with-unit"><input type="number" name="fat" min="0" step="0.1" value={formData.fat} onChange={handleChange} placeholder="0.0" required /><span>g</span></div></label>
                  <label className="field"><span>Protein</span><div className="input-with-unit"><input type="number" name="protein" min="0" step="0.1" value={formData.protein} onChange={handleChange} placeholder="0.0" required /><span>g</span></div></label>
                </div>
                <label className="field full-field"><span>Tanggal kedaluwarsa <b>*</b></span><input type="date" name="expiry" value={formData.expiry} onChange={handleChange} required /></label>
                <div className="form-note"><span className="note-icon">i</span><p>Prioritas dan status kedaluwarsa dihitung otomatis saat Anda menyimpan.</p></div>
                <div className="form-actions">
                  <button className="button button-primary submit-button" type="submit">{editingId !== null ? "Simpan perubahan" : "Tambah ke stok"}<span>→</span></button>
                  {editingId !== null && <button className="button button-secondary cancel-button" type="button" onClick={resetForm}>Batal edit</button>}
                </div>
              </form>
            </section>

            <section className="panel inventory-panel" id="inventory-section">
              <div className="inventory-heading">
                <div className="panel-title-wrap"><span className="panel-kicker">MANAJEMEN STOK</span><h2>{activeView === "priority" ? "Konsumsi dulu" : "Stok Anda"}</h2></div>
                <span className="item-count">{filteredInventory.length} <span>{filteredInventory.length === 1 ? "produk" : "produk"}</span></span>
              </div>
              <div className="inventory-toolbar">
                <label className="search-box"><span className="search-icon">⌕</span><input type="search" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Cari produk Anda..." aria-label="Search products" /><kbd>/</kbd></label>
                <button className={`filter-button ${activeView === "priority" ? "filter-active" : ""}`} type="button" onClick={() => setActiveView(activeView === "priority" ? "inventory" : "priority")}><span>☷</span> {activeView === "priority" ? "Prioritas saja" : "Semua produk"}</button>
              </div>

              {filteredInventory.length === 0 ? (
                <div className="empty-state"><div className="empty-illustration">⌕</div><h3>{searchTerm ? "Produk tidak ditemukan" : activeView === "priority" ? "Tidak ada yang mendesak saat ini" : "Stok Anda masih kosong"}</h3><p>{searchTerm ? "Coba nama produk lain." : activeView === "priority" ? "Produk yang Anda pantau tidak membutuhkan perhatian segera." : "Tambahkan produk pertama Anda untuk memantau kedaluwarsa dan nutrisi."}</p>{!searchTerm && activeView !== "priority" && <button className="button button-primary" onClick={() => navigate("add")} type="button">＋ Tambahkan produk pertama</button>}</div>
              ) : (
                <div className="inventory-list">
                  {filteredInventory.map((item, index) => {
                    const scoring = item.scoring ?? calculate_priority(item);
                    const expiryStatus = get_expiry_status(item.expiry);
                    const priorityLabel = get_priority_label(scoring.priority, item.expiry);
                    const alert = getExpiryAlert(expiryStatus, item.name);
                    return (
                      <article key={item.id} className="product-row">
                        <div className="product-symbol">{item.name.trim().charAt(0).toUpperCase()}</div>
                        <div className="product-main">
                          <div className="product-name-line"><span className="product-rank">#{String(index + 1).padStart(2, "0")}</span><h3>{item.name}</h3></div>
                          <div className="product-meta"><span className={`status-pill ${slug(expiryStatus)}`}><span className="status-dot" />{expiryStatus}</span><span className="expiry-date">Kedaluwarsa {formatDate(item.expiry)}</span></div>
                          {alert && <p className="product-alert">{alert}</p>}
                          <div className="nutrition-chips"><span>Gula <b>{item.sugar}g</b></span><span>Karbohidrat <b>{item.carbs}g</b></span><span>Lemak <b>{item.fat}g</b></span><span>Protein <b>{item.protein}g</b></span></div>
                        </div>
                        <div className="product-score"><span>PRIORITAS</span><strong>{scoring.priority ?? 0}<small>/100</small></strong><div className="score-track"><span style={{ width: `${Math.max(0, Math.min(Number(scoring.priority) || 0, 100))}%` }} /></div><span className={`priority-label ${slug(priorityLabel)}`}>{priorityLabel}</span><div className="product-actions"><button type="button" onClick={() => handleEdit(item)} aria-label={`Edit ${item.name}`}>Edit</button><button type="button" className="delete-action" onClick={() => handleDelete(item.id)} aria-label={`Delete ${item.name}`}>Hapus</button></div></div>
                      </article>
                    );
                  })}
                </div>
              )}
              <footer className="inventory-footer"><span>Diurutkan berdasarkan skor prioritas</span><span><i /> Perhitungan real-time</span></footer>
            </section>
          </div>
          <footer className="page-footer"><span>SmartConsume <b>·</b> Stok cerdas, lebih sedikit limbah.</span><span>Dibuat untuk keputusan stok yang lebih baik.</span></footer>
        </div>
      </section>
      {toast && <div className="toast" role="status"><span className="toast-check">✓</span>{toast}<button onClick={() => setToast("")} aria-label="Dismiss notification">×</button></div>}
    </main>
  );
}

export default App;
