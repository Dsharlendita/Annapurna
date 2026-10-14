(function () {
  if (window.Admin.blocked) return;
  const { DB, Rules, D, rupiah } = Ann;
  const { $, esc, asset, modal, pill } = UI;
  Admin.init('kalender', 'Kalender Ketersediaan');
  const DAYS = 14; const T = D.today(); const { Svc } = Ann;
  $('#from').value = T;
  $('#fCat').innerHTML += DB.categories().map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join('');
  const rows = () => {
    const q = $('#q').value.trim().toLowerCase(), c = $('#fCat').value; const out = [];
    DB.products(true).filter((p) => p.rent && p.active !== false && (!c || p.cat === c) && (!q || p.name.toLowerCase().includes(q))).forEach((p) => {
      out.push({ p, size: null, label: p.name, total: p.units ? DB.rentableUnits(p).length : p.stock, parent: DB.hasVariant(p) });
      if (DB.hasVariant(p)) p.variant.options.forEach((o) => out.push({ p, size: o.name, label: o.name.replace(/\s*\(.*\)/, ''), total: p.units ? DB.rentableUnits(p, o.name).length : o.stock, child: true }));
    });
    return out;
  };
  /* Jadwal antar & jemput staff (layanan antar / jasa tenda) pada rentang kalender */
  const tbl = $('#cal'); const host = tbl.closest('.table-wrap') || tbl.parentElement;
  host.insertAdjacentHTML('beforebegin', '<div id="schedAlert"></div><div class="card" id="schedCard" style="margin-bottom:16px"><div class="card-title"><i class="fa-solid fa-truck-fast"></i> Jadwal antar &amp; jemput <small class="muted" id="schedCnt" style="font-weight:500;font-size:13px"></small></div><div class="sched-list" id="sched"></div></div>');
  function drawSched(f) {
    const to = D.addDays(f, DAYS - 1); const ev = Admin.svcSchedule(f, to);
    /* Pengingat di atas: antar / jemput hari ini & besok */
    const near = Admin.svcSchedule(T, D.addDays(T, 1)); const tod = near.filter((e) => e.date === T), tom = near.filter((e) => e.date !== T);
    const cnt = (L, k) => L.filter((e) => e.type === k).length;
    $('#schedAlert').innerHTML = near.length ? `<div class="sched-alert ${tod.length ? 'now' : ''}"><i class="fa-solid fa-bell"></i><div>
      ${tod.length ? `<b>Hari ini: ${[cnt(tod, 'antar') && cnt(tod, 'antar') + ' antar', cnt(tod, 'jemput') && cnt(tod, 'jemput') + ' jemput'].filter(Boolean).join(' & ')}</b> · ${tod.map((e) => `${Svc.fmtT(e.time) || '—'} ${esc(e.kind.toLowerCase())} ${NO(e.b)} (${esc(e.b.customer.name)})`).join(' · ')}` : ''}
      ${tod.length && tom.length ? '<br>' : ''}${tom.length ? `<span>Besok: ${[cnt(tom, 'antar') && cnt(tom, 'antar') + ' antar', cnt(tom, 'jemput') && cnt(tom, 'jemput') + ' jemput'].filter(Boolean).join(' & ')} — siapkan barang &amp; kendaraan.</span>` : ''}
    </div></div>` : '';
    $('#schedCnt').textContent = ev.length ? `· ${ev.length} jadwal, ${D.fmtDate(f)} – ${D.fmtDate(to)}` : '';
    $('#sched').innerHTML = ev.length ? ev.map((e) => { const x = new Date(e.date + 'T00:00:00'); const wa = UI.waLink(`Halo ${e.b.customer.name}, kami dari Annapurna Adventure ingin mengonfirmasi jadwal ${e.kind.toLowerCase()} untuk ${NO(e.b)} pada ${D.fmtDate(e.date, true)}${e.time ? ' pukul ' + Svc.fmtT(e.time) : ''} di ${(e.b.deliv || {}).address || '-'}. Terima kasih.`, e.b.customer.phone);
      return `<div class="sched-it ${e.date === T ? 'today' : e.date === D.addDays(T, 1) ? 'tomorrow' : ''}"><div class="when">${e.date === T ? '<em>Hari ini</em>' : e.date === D.addDays(T, 1) ? '<em>Besok</em>' : ''}${D.HARI[x.getDay()]}, ${D.fmtDate(e.date)}<b>${e.time ? Svc.fmtT(e.time) : '—'}</b></div>
      <div class="nm"><strong><i class="fa-solid ${e.ic}" style="color:var(--g600)"></i> ${e.kind}${Svc.isTent(e.b) ? ` (${esc(Svc.short(e.b).toLowerCase())}${e.b.deliv.tents ? ', ' + e.b.deliv.tents + ' tenda' : ''})` : ''} · ${NO(e.b)}</strong><small>${esc(e.b.customer.name)} · ${esc((e.b.deliv || {}).address || '-')}</small><small>${esc(Admin.itemsText(e.b))}</small></div>
      <div class="acts"><a class="btn btn-wa btn-xs" href="${wa}" target="_blank" rel="noopener"><i class="fa-brands fa-whatsapp"></i> Konfirmasi</a><a class="btn btn-light btn-xs" href="booking?id=${e.b.id}">Buka</a></div></div>`; }).join('') : '<p class="muted" style="font-size:13.5px">Tidak ada jadwal antar atau jemput di rentang tanggal ini.</p>';
  }
  function draw() {
    const f = $('#from').value || T;
    drawSched(f); const days = [...Array(DAYS)].map((_, i) => D.addDays(f, i));
    const R = rows();
    $('#cal').innerHTML = `<thead><tr><th class="cal-name">Barang</th>${days.map((d) => { const x = new Date(d + 'T00:00:00'); const we = x.getDay() === 0 || x.getDay() === 6; return `<th class="${d === T ? 'today' : ''} ${we ? 'we' : ''}"><small>${D.HARI[x.getDay()]}</small>${x.getDate()}</th>`; }).join('')}</tr></thead>
      <tbody>${R.length ? R.map((r) => `<tr class="${r.child ? 'child' : ''}"><td class="cal-name">${r.child ? `<span class="cal-size">${esc(r.label)}</span>` : `<div class="prod"><img loading="lazy" decoding="async" src="${asset(r.p.img)}" alt=""><div><strong>${esc(r.label)}</strong><small>${r.total} unit siap sewa</small></div></div>`}</td>
        ${days.map((d) => { const a = Rules.availableOn(r.p.id, d, null, r.size); const pct = r.total ? a / r.total : 0; const cls = a <= 0 ? 'full' : pct <= .34 ? 'mid' : 'ok';
          return `<td><button class="cal-c ${cls}" data-p="${r.p.id}" data-s="${esc(r.size || '')}" data-d="${d}" title="${esc(r.label)} · ${D.fmtDate(d)}: ${a} tersedia">${a}<small>/${r.total}</small></button></td>`; }).join('')}</tr>`).join('') : `<tr><td colspan="${DAYS + 1}" class="muted" style="text-align:center;padding:24px">Tidak ada barang.</td></tr>`}</tbody>`;
  }
  $('#cal').addEventListener('click', (e) => {
    const c = e.target.closest('.cal-c'); if (!c) return; const p = DB.product(c.dataset.p); const d = c.dataset.d; const size = c.dataset.s || null;
    const L = DB.staffBookings().filter((b) => ['menunggu_pembayaran', 'menunggu_konfirmasi', 'dikonfirmasi', 'disewa'].includes(b.status) && ((b.start <= d && d <= b.end) || (b.status === 'disewa' && b.end < T && d >= T)))
      .map((b) => ({ b, n: b.items.reduce((t, it) => t + it.components.filter((x) => x.productId === p.id && (!size || x.size === size)).reduce((u, x) => u + x.qty * it.qty, 0), 0) })).filter((x) => x.n);
    modal({ title: `${esc(DB.variantName(p, size))} · ${D.fmtDate(d, true)}`, body: `<div class="kv"><span>Tersedia</span><strong>${Rules.availableOn(p.id, d, null, size)} unit</strong></div>
      <div class="mini-sec"><h4>Dipakai booking</h4>${L.length ? L.map(({ b, n }) => `<div class="list-row"><div class="nm"><strong>${NO(b)} · ${esc(b.customer.name)}</strong><small>${n} unit · ${D.fmtRange(b.start, b.end)}${b.status === 'disewa' && b.end < T ? ' · <b style="color:var(--red)">terlambat</b>' : ''}</small></div>${pill('rental', b.status)}<a class="btn btn-light btn-xs" href="booking?id=${b.id}">Buka</a></div>`).join('') : '<p class="muted">Tidak ada booking di tanggal ini.</p>'}</div>` });
  });
  ['#q', '#fCat', '#from'].forEach((s) => $(s).addEventListener('input', draw));
  $('#prev').addEventListener('click', () => { $('#from').value = D.addDays($('#from').value || T, -7); draw(); });
  $('#next').addEventListener('click', () => { $('#from').value = D.addDays($('#from').value || T, 7); draw(); });
  $('#today').addEventListener('click', () => { $('#from').value = T; draw(); });
  draw();
})();
