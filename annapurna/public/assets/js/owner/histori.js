(function () {
  if (window.Admin.blocked) return;
  const { DB, AUDIT_TYPES, D } = Ann;
  const { $, $$, esc, param, modal, bindExport } = UI;
  Admin.init('owner-histori', 'Histori Sistem');
  const T = D.today();
  const PAGE = 60;
  const TABS = [
    ['aktivitas', 'Aktivitas Staff', (a) => !['akses', 'login', 'logout', 'login_gagal'].includes(a.type)],
    ['login', 'Login & Logout', (a) => ['login', 'logout', 'login_gagal'].includes(a.type)],
    ['data', 'Perubahan Data', (a) => (AUDIT_TYPES[a.type] || {}).group === 'data'],
    ['transaksi', 'Transaksi', (a) => (AUDIT_TYPES[a.type] || {}).group === 'transaksi'],
    ['audit', 'Audit Trail Lengkap', () => true],
  ];
  let tab = param('tab') || 'aktivitas', limit = PAGE;
  const ty = (k) => AUDIT_TYPES[k] || { label: k, tone: 'gray', icon: 'fa-circle' };

  const people = [...new Map(DB.audits().map((a) => [a.userId, a.userName])).entries()];
  DB.staff().forEach((u) => { if (!people.some(([id]) => id === u.id)) people.push([u.id, u.name]); });
  $('#fStaff').innerHTML = '<option value="">Semua staff</option>' + people.sort((a, b) => a[1].localeCompare(b[1])).map(([id, n]) => `<option value="${id}">${esc(n)}</option>`).join('');
  if (param('staff')) $('#fStaff').value = param('staff');

  function fillTypes() {
    const fn = TABS.find((x) => x[0] === tab)[2]; const cur = $('#fType').value;
    const keys = Object.keys(AUDIT_TYPES).filter((k) => fn({ type: k }));
    $('#fType').innerHTML = '<option value="">Semua jenis</option>' + keys.map((k) => `<option value="${k}">${AUDIT_TYPES[k].label}</option>`).join('');
    if (keys.includes(cur)) $('#fType').value = cur;
  }
  function range() {
    const r = $('#fRange').value;
    if (r === 'today') return [T, T];
    if (r === 'week') { const d = new Date(T + 'T00:00:00'); const off = (d.getDay() + 6) % 7; return [D.rel(-off), T]; }
    if (r === 'month') return [T.slice(0, 8) + '01', T];
    if (r === 'custom') return [$('#from').value || '0000-00-00', $('#to').value || '9999-12-31'];
    return ['0000-00-00', '9999-12-31'];
  }
  function list() {
    const fn = TABS.find((x) => x[0] === tab)[2];
    const q = $('#q').value.trim().toLowerCase(), st = $('#fStaff').value, tp = $('#fType').value; const [f, t] = range();
    return DB.audits().filter((a) => fn(a) && (!st || a.userId === st) && (!tp || a.type === tp) && D.day(a.at) >= f && D.day(a.at) <= t
      && (!q || [a.action, a.ref, Reports.refNo(a.ref), a.userName, a.id, ...(a.changes || []).map((c) => `${c.field} ${c.from} ${c.to}`)].join(' ').toLowerCase().includes(q))).reverse();
  }
  const chgHtml = (a) => (a.changes || []).length ? `<ul class="chg">${a.changes.map((c) => `<li><span>${esc(c.field)}</span>${c.from ? `<s>${esc(c.from)}</s><i class="fa-solid fa-arrow-right"></i>` : ''}<b>${esc(c.to || '—')}</b></li>`).join('')}</ul>` : '<span class="muted">—</span>';
  const who = (a) => `${esc(a.userName)}<small>${a.role === 'system' ? 'Otomatis' : esc(DB.ROLE_LABEL[a.role] || a.role)}</small>`;

  function drawIntegrity() {
    const v = DB.verifyAudit();
    $('#integrity').innerHTML = v.ok
      ? `<div class="notice green integrity"><i class="fa-solid fa-lock"></i><div>Histori tercatat otomatis dan <strong>tidak bisa diubah atau dihapus</strong> oleh siapa pun, termasuk Owner. Total ${v.count.toLocaleString('id-ID')} catatan.</div></div>`
      : `<div class="notice red integrity"><i class="fa-solid fa-triangle-exclamation"></i><div><strong>Peringatan:</strong> ada catatan histori yang berubah di luar sistem (mulai ${esc(v.brokenAt)}). Unduh histori sebagai arsip dan periksa siapa saja yang punya akses ke perangkat / database.</div></div>`;
  }

  function draw() {
    const all = DB.audits();
    $('#tabs').innerHTML = TABS.map(([k, l, fn]) => `<button class="tab ${k === tab ? 'active' : ''}" data-tab="${k}">${l} <span class="cnt">${all.filter(fn).length}</span></button>`).join('');
    const L = list(); const V = L.slice(0, limit);
    $('#count').textContent = `${L.length.toLocaleString('id-ID')} catatan${L.length > V.length ? ` · menampilkan ${V.length} terbaru` : ''}.`;
    $('#rows').innerHTML = V.length ? V.map((a) => { const t = ty(a.type); return `<tr data-id="${a.id}">
      <td class="nw">${D.fmtDate(a.at)}<small>${D.fmtDateTime(a.at).split(', ')[1]} · ${Admin.relTime(a.at)}</small></td>
      <td class="nw">${who(a)}</td>
      <td><span class="pill ${t.tone} plain"><i class="fa-solid ${t.icon}"></i> ${t.label}</span></td>
      <td style="min-width:220px">${esc(Reports.refText(a.action))}${a.ref ? `<small>No. referensi: ${esc(Reports.refNo(a.ref))}</small>` : ''}</td>
      <td style="min-width:200px">${chgHtml(a)}</td>
      <td class="num"><button class="btn btn-light btn-xs" data-open="${a.id}">Detail</button></td></tr>`; }).join('')
      : '<tr><td colspan="6"><div class="empty-state" style="padding:28px"><div class="ic"><i class="fa-solid fa-clock-rotate-left"></i></div><h3>Tidak ada catatan</h3><p>Coba ubah filter atau periode.</p></div></td></tr>';
    $('#more').innerHTML = L.length > V.length ? `<button class="btn btn-light btn-sm" id="moreBtn">Tampilkan ${Math.min(PAGE, L.length - V.length)} lagi</button>` : '';
    const mb = $('#moreBtn'); if (mb) mb.addEventListener('click', () => { limit += PAGE; draw(); });
  }

  const refLink = (ref) => {
    if (!ref) return '';
    if (/^RNT-/.test(ref)) return Admin.A('booking?id=' + ref);
    if (/^ORD-/.test(ref)) return Admin.A('penjualan?id=' + ref);
    if (/^(EXP|INC)-/.test(ref)) return Admin.A('keuangan');
    if (/^p\d+$/.test(ref)) return Admin.A('barang');
    if (/^REV-/.test(ref)) return Admin.A('ulasan');
    if (/^u\d+$/.test(ref)) return Admin.O('histori?staff=' + ref);
    if (/^\d{4}-\d{2}$/.test(ref)) return Admin.O('integrasi?folder=' + ref);
    return '';
  };
  function detail(id) {
    const a = DB.audits().find((x) => x.id === id); if (!a) return; const t = ty(a.type); const link = refLink(a.ref);
    modal({ title: 'Detail aktivitas', size: 'lg', body: `
      <div style="margin-bottom:12px"><span class="pill ${t.tone} plain"><i class="fa-solid ${t.icon}"></i> ${t.label}</span></div>
      <p style="font-size:15px;font-weight:600;margin-bottom:12px">${esc(a.action)}</p>
      <div class="kv-grid">
        <div class="kv"><span>Waktu</span><span>${D.HARI[new Date(a.at).getDay()]}, ${D.fmtDateTime(a.at)}</span></div>
        <div class="kv"><span>Dilakukan oleh</span><strong>${esc(a.userName)}</strong></div>
        <div class="kv"><span>Role</span><span>${a.role === 'system' ? 'Sistem (otomatis)' : esc(DB.ROLE_LABEL[a.role] || a.role)}</span></div>
        <div class="kv"><span>No. referensi</span><span>${a.ref ? (link ? `<a href="${link}" style="color:var(--g700);font-weight:700">${esc(Reports.refNo(a.ref))}</a>` : esc(Reports.refNo(a.ref))) : '-'}</span></div>
      </div>
      <div class="mini-sec"><h4>Perubahan data</h4>${(a.changes || []).length ? `<div class="table-wrap"><table class="table"><thead><tr><th>Kolom</th><th>Sebelum</th><th>Sesudah</th></tr></thead><tbody>${a.changes.map((c) => `<tr><td>${esc(c.field)}</td><td>${esc(c.from || '—')}</td><td><strong>${esc(c.to || '—')}</strong></td></tr>`).join('')}</tbody></table></div>` : '<p class="muted" style="font-size:13.5px">Tidak ada perubahan nilai yang dicatat untuk aktivitas ini.</p>'}</div>
      <p class="muted" style="font-size:12.5px;margin-top:14px"><i class="fa-solid fa-lock"></i> Catatan ini tidak bisa diedit atau dihapus.</p>`,
      foot: '<button class="btn btn-primary" data-close>Tutup</button>' });
  }

  $('#tabs').addEventListener('click', (e) => { const b = e.target.closest('.tab'); if (!b) return; tab = b.dataset.tab; limit = PAGE; fillTypes(); draw(); });
  ['#q', '#fStaff', '#fType', '#from', '#to'].forEach((s) => $(s).addEventListener('input', () => { limit = PAGE; draw(); }));
  $('#fRange').addEventListener('change', () => { $('#custom').hidden = $('#fRange').value !== 'custom'; if ($('#fRange').value === 'custom' && !$('#from').value) { $('#from').value = T.slice(0, 8) + '01'; $('#to').value = T; } limit = PAGE; draw(); });
  $('#rows').addEventListener('click', (e) => { const b = e.target.closest('[data-open]') || e.target.closest('tr[data-id]'); if (b) detail(b.dataset.open || b.dataset.id); });
  bindExport($('#exp'), () => {
    const L = list().slice().reverse(); const [f, t] = range();
    const staffName = $('#fStaff').value ? $('#fStaff').selectedOptions[0].textContent : 'Semua staff';
    return { filename: `histori-sistem-${T}`, title: `Histori Sistem — ${TABS.find((x) => x[0] === tab)[1]}`,
      subtitle: `${staffName} · ${$('#fType').value ? ty($('#fType').value).label : 'Semua jenis'} · ${f === '0000-00-00' ? 'Semua tanggal' : `${D.fmtDate(f, true)} – ${D.fmtDate(t, true)}`}`,
      summary: [['Jumlah catatan', String(L.length)], ['Staff terlibat', String(new Set(L.map((a) => a.userId)).size)]],
      columns: [{ header: 'Waktu' }, { header: 'Staff' }, { header: 'Role' }, { header: 'Jenis' }, { header: 'Aktivitas', width: 42 }, { header: 'No. Referensi' }, { header: 'Perubahan', width: 44 }],
      rows: L.map((a) => [D.fmtDateTime(a.at), a.userName, a.role === 'system' ? 'Sistem' : DB.ROLE_LABEL[a.role] || a.role, ty(a.type).label, Reports.refText(a.action), Reports.refNo(a.ref), (a.changes || []).map((c) => `${c.field}: ${c.from || '—'} → ${c.to || '—'}`).join('; ') || '-']) };
  });
  if (param('type') && AUDIT_TYPES[param('type')]) { const g = TABS.find(([, , fn]) => fn({ type: param('type') })); tab = g[0]; }
  fillTypes(); if (param('type')) $('#fType').value = param('type');
  drawIntegrity(); draw();
})();
