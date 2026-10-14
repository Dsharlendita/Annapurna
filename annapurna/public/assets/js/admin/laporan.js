(function () {
  if (window.Admin.blocked) return;
  const { DB, D, rupiah } = Ann;
  const { $, esc, param, bindExport } = UI;
  Admin.init('laporan', 'Laporan');
  const T = D.today();
  $('#type').innerHTML = Reports.TYPES.filter(([, , ownerOnly]) => !ownerOnly || Admin.isOwner).map(([k, l, o]) => `<option value="${k}">${l}${o ? ' (Owner)' : ''}</option>`).join('');
  $('#from').value = T.slice(0, 8) + '01'; $('#to').value = T;
  /* Nilai ?type= dicocokkan dengan daftar yang ada, tidak dipakai langsung sebagai selector */
  if ([...$('#type').options].some((o) => o.value === param('type'))) $('#type').value = param('type');
  let cur;
  function draw() {
    let f = $('#from').value || T, t = $('#to').value || T; if (f > t) { t = f; $('#to').value = f; }
    cur = Reports.build($('#type').value, f, t);
    /* Default terbaru di atas; pilihan "Terlama di atas" membalik urutan baris (kecuali laporan stok) */
    if ($('#order').value === 'asc' && $('#type').value !== 'stok') cur = cur.sections ? Object.assign({}, cur, { sections: cur.sections.map((x) => (x.sortable ? Object.assign({}, x, { rows: x.rows.slice().reverse() }) : x)) }) : Object.assign({}, cur, { rows: cur.rows.slice().reverse() });
    /* Laporan berbagian (mis. Penjualan): beberapa tabel dengan pembatas & judul masing-masing */
    $('#mainTbl').hidden = !!cur.sections;
    if (cur.sections) {
      $('#title').textContent = cur.title; $('#rhTitle').textContent = cur.title;
      $('#range').textContent = `Periode ${D.fmtDate(f, true)} – ${D.fmtDate(t, true)} · ${cur.note}`; $('#rhRange').textContent = `${D.fmtDate(f, true)} – ${D.fmtDate(t, true)}`;
      $('#sum').innerHTML = cur.sum.map(([l, v]) => `<div class="sum-card"><small>${l}</small><strong>${v}</strong></div>`).join('');
      $('#secs').innerHTML = cur.sections.map((x, si) => { const mny = x.money || x.num; const fm = (v, i) => (mny.includes(i) && typeof v === 'number' ? rupiah(v) : esc(v));
        return `<section class="rep-sec" id="sec-${esc(x.key || si)}"><div class="rep-sec-h"><span class="n">${si + 1}</span><div><h4>${esc(x.title)}</h4><p>${esc(x.note || '')}</p></div></div>
          <div class="table-wrap" data-no-paginate><table class="table"><thead><tr>${x.cols.map((c, i) => `<th class="${x.num.includes(i) ? 'num' : ''}">${c}</th>`).join('')}</tr></thead>
          <tbody>${x.rows.length ? x.rows.map((r) => `<tr>${r.map((v, i) => `<td class="${x.num.includes(i) ? 'num' : ''}">${fm(v, i)}</td>`).join('')}</tr>`).join('') : `<tr><td colspan="${x.cols.length}" class="muted" style="text-align:center;padding:20px">Tidak ada data pada periode ini.</td></tr>`}</tbody>
          ${x.foot && x.rows.length ? `<tfoot><tr>${x.foot.map((v, i) => `<td class="${x.num.includes(i) ? 'num' : ''}">${fm(v, i)}</td>`).join('')}</tr></tfoot>` : ''}</table></div></section>`; }).join('');
      return;
    }
    $('#secs').innerHTML = '';
    const money = cur.money || cur.num;
    const fmt = (v, i) => (money.includes(i) && typeof v === 'number' ? rupiah(v) : esc(v));
    $('#title').textContent = cur.title; $('#rhTitle').textContent = cur.title;
    $('#range').textContent = `Periode ${D.fmtDate(f, true)} – ${D.fmtDate(t, true)} · ${cur.note}`; $('#rhRange').textContent = `${D.fmtDate(f, true)} – ${D.fmtDate(t, true)}`;
    $('#sum').innerHTML = cur.sum.map(([l, v]) => `<div class="sum-card"><small>${l}</small><strong>${v}</strong></div>`).join('');
    $('#th').innerHTML = `<tr>${cur.cols.map((c, i) => `<th class="${cur.num.includes(i) ? 'num' : ''}">${c}</th>`).join('')}</tr>`;
    $('#rows').innerHTML = cur.rows.length ? cur.rows.map((r) => `<tr>${r.map((v, i) => `<td class="${cur.num.includes(i) ? 'num' : ''}">${fmt(v, i)}</td>`).join('')}</tr>`).join('') : `<tr><td colspan="${cur.cols.length}" class="muted" style="text-align:center;padding:26px">Tidak ada data pada periode ini.</td></tr>`;
    $('#tf').innerHTML = cur.foot && cur.rows.length ? `<tr>${cur.foot.map((v, i) => `<td class="${cur.num.includes(i) ? 'num' : ''}">${fmt(v, i)}</td>`).join('')}</tr>` : '';
  }
  ['#type', '#from', '#to', '#order'].forEach((s) => $(s).addEventListener('change', draw));
  bindExport($('#exp'), () => Reports.toSpec(cur, `${$('#type').value}-${$('#from').value}_${$('#to').value}`, $('#range').textContent));
  draw();
  /* Tautan langsung ke bagian tertentu (mis. #sec-restock dari Dashboard) */
  if (/^#sec-[\w-]+$/.test(location.hash)) setTimeout(() => { const el = document.getElementById(location.hash.slice(1)); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 300);
})();
