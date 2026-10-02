(function () {
  if (window.Admin.blocked) return;
  const { DB, D, rupiah } = Ann;
  const { $, esc, param, bindExport } = UI;
  Admin.init('laporan', 'Laporan');
  const T = D.today();
  $('#type').innerHTML = Reports.TYPES.filter(([, , ownerOnly]) => !ownerOnly || Admin.isOwner).map(([k, l, o]) => `<option value="${k}">${l}${o ? ' (Owner)' : ''}</option>`).join('');
  $('#from').value = T.slice(0, 8) + '01'; $('#to').value = T;
  if (param('type') && $(`#type option[value="${param('type')}"]`)) $('#type').value = param('type');
  let cur;
  function draw() {
    let f = $('#from').value || T, t = $('#to').value || T; if (f > t) { t = f; $('#to').value = f; }
    cur = Reports.build($('#type').value, f, t);
    $('#aiSum').innerHTML = window.AI && !['aktivitas', 'login'].includes($('#type').value) ? AI.insightCard(AI.reportInsights(f, t), `Periode ${D.fmtDate(f)} – ${D.fmtDate(t)}`) : '';
    const money = cur.money || cur.num;
    const fmt = (v, i) => (money.includes(i) && typeof v === 'number' ? rupiah(v) : esc(v));
    $('#title').textContent = cur.title; $('#rhTitle').textContent = cur.title;
    $('#range').textContent = `Periode ${D.fmtDate(f, true)} – ${D.fmtDate(t, true)} · ${cur.note}`; $('#rhRange').textContent = `${D.fmtDate(f, true)} – ${D.fmtDate(t, true)}`;
    $('#sum').innerHTML = cur.sum.map(([l, v]) => `<div class="sum-card"><small>${l}</small><strong>${v}</strong></div>`).join('');
    $('#th').innerHTML = `<tr>${cur.cols.map((c, i) => `<th class="${cur.num.includes(i) ? 'num' : ''}">${c}</th>`).join('')}</tr>`;
    $('#rows').innerHTML = cur.rows.length ? cur.rows.map((r) => `<tr>${r.map((v, i) => `<td class="${cur.num.includes(i) ? 'num' : ''}">${fmt(v, i)}</td>`).join('')}</tr>`).join('') : `<tr><td colspan="${cur.cols.length}" class="muted" style="text-align:center;padding:26px">Tidak ada data pada periode ini.</td></tr>`;
    $('#tf').innerHTML = cur.foot && cur.rows.length ? `<tr>${cur.foot.map((v, i) => `<td class="${cur.num.includes(i) ? 'num' : ''}">${fmt(v, i)}</td>`).join('')}</tr>` : '';
  }
  ['#type', '#from', '#to'].forEach((s) => $(s).addEventListener('change', draw));
  bindExport($('#exp'), () => Reports.toSpec(cur, `${$('#type').value}-${$('#from').value}_${$('#to').value}`, $('#range').textContent));
  draw();
})();
