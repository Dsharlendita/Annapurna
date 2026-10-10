(function () {
  const { DB, D, rupiah } = window.Ann;
  const { $, $$, esc, asset, url, toast, Cart, waLink } = window.UI;
  const page = document.body.dataset.page || '';

  const MTN = {
    line: `<svg viewBox="0 0 200 80" fill="none" aria-hidden="true"><path d="M4 76 L52 34 L66 46 L98 10 L120 32 L132 24 L196 76" stroke="currentColor" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/><path d="M98 10 L90 30 L100 24 L106 34 M52 34 L48 48 L56 44" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"/></svg>`,
    solid: `<svg viewBox="0 0 240 90" aria-hidden="true"><path d="M0 88 C30 80 48 64 70 50 L92 62 L128 18 C134 12 140 12 146 20 L170 50 L184 42 L240 88 Z" fill="currentColor"/><path d="M128 18 L118 44 L132 34 L138 50 L146 20 Z M70 50 L64 70 L76 60 Z" fill="#fff" opacity=".85"/></svg>`,
    hand: `<svg viewBox="0 0 64 40" fill="none" aria-hidden="true"><path d="M3 36 L22 12 L30 20 L42 4 L61 36" stroke="#fff" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round"/><path d="M42 4 L38 16 L45 12 L48 20" stroke="#fff" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/></svg>`,
    swoosh: `<svg viewBox="0 0 120 16" fill="none" aria-hidden="true"><path d="M3 12 C35 2 80 1 117 6" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><path d="M14 14 C40 8 70 7 96 9" stroke="currentColor" stroke-width="2" stroke-linecap="round" opacity=".7"/></svg>`,
  };
  window.MTN = MTN;

  const LINKS = [
    { href: './', label: 'Beranda', key: 'home', icon: 'fa-house' },
    { href: 'katalog', label: 'Sewa Alat', key: 'katalog', icon: 'fa-campground' },
    { href: 'belanja', label: 'Beli Alat', key: 'belanja', icon: 'fa-bag-shopping' },
    { href: 'paket', label: 'Paket', key: 'paket', icon: 'fa-box-open' },
    { href: 'tentang', label: 'Tentang Kami', key: 'tentang', icon: 'fa-mountain-sun' },
    { href: 'kontak', label: 'Kontak', key: 'kontak', icon: 'fa-phone' },
  ];

  function renderHeader() {
    const el = $('#site-header'); if (!el) return;
    const s = DB.session();
    const notif = s ? DB.notifications(s.email) : [];
    const unread = notif.filter((n) => !n.read).length;
    const initials = s ? s.name.split(' ').map((x) => x[0]).slice(0, 2).join('').toUpperCase() : '';
    el.outerHTML = `<header class="nav" id="nav">
      <div class="wrap nav-inner">
        <a class="brand" href="${url('./')}" aria-label="Annapurna Adventure — Beranda"><img src="${asset('assets/img/logo.png')}" alt="Annapurna Adventure"></a>
        <nav class="nav-links" aria-label="Menu utama">${LINKS.map((l) => `<a href="${url(l.href)}" class="${page === l.key ? 'active' : ''}">${l.label}</a>`).join('')}</nav>
        <div class="nav-actions">
          <button class="trip-chip ${DB.trip() ? 'set' : ''}" id="tripChip" title="Tanggal sewa"><i class="fa-regular fa-calendar"></i><span>${DB.trip() ? D.fmtRange(DB.trip().start, DB.trip().end) : 'Pilih tanggal'}</span></button>
          <button class="icon-btn" id="openSearch" aria-label="Cari produk"><i class="fa-solid fa-magnifying-glass"></i></button>
          <a class="icon-btn" href="${url('keranjang')}" aria-label="Keranjang"><i class="fa-solid fa-cart-shopping"></i><span class="dot" id="cartDot">0</span></a>
          ${s ? `
          <div class="dropdown" id="notifDd">
            <button class="icon-btn" data-dd aria-label="Notifikasi"><i class="fa-regular fa-bell"></i>${unread ? `<span class="dot" style="background:var(--orange)">${unread > 99 ? "99+" : unread}</span>` : ''}</button>
            <div class="dropdown-menu notif-menu nx-menu" id="nxBox"></div>
          </div>
          <div class="dropdown" id="userDd">
            <button class="user-chip" data-dd aria-label="Menu akun"><span class="av">${esc(initials)}</span><span class="nm">${esc(s.name.split(' ')[0])}</span><i class="fa-solid fa-chevron-down" style="font-size:10px"></i></button>
            <div class="dropdown-menu">
              <div class="dropdown-head"><strong>${esc(s.name)}</strong><small>${esc(s.email)}</small></div><hr>
              ${DB.isStaff(s) ? `<a href="${url(DB.panelHome(s))}"><i class="fa-solid ${s.role === 'owner' ? 'fa-crown' : 'fa-gauge'}"></i> ${s.role === 'owner' ? 'Panel Owner' : 'Panel Admin'}</a>` : ''}
              <a href="${url('pesanan')}"><i class="fa-solid fa-receipt"></i> Pesanan Saya</a><a href="#" id="allNotif"><i class="fa-regular fa-bell"></i> Semua notifikasi</a>
              <a href="${url('pesanan?tab=riwayat')}"><i class="fa-solid fa-clock-rotate-left"></i> Riwayat Rental</a>
              <a href="${url('profil')}"><i class="fa-regular fa-user"></i> Profil & Alamat</a><hr>
              <button class="item" id="logoutBtn"><i class="fa-solid fa-arrow-right-from-bracket"></i> Keluar</button>
            </div>
          </div>` : `<a class="btn btn-primary btn-sm btn-auth" href="${url('masuk')}">Masuk / Daftar</a>`}
          <button class="icon-btn nav-toggle" id="openDrawer" aria-label="Buka menu"><i class="fa-solid fa-bars"></i></button>
        </div>
      </div>
    </header>
    <div class="drawer" id="drawer" aria-hidden="true">
      <div class="drawer-bg" data-close-drawer></div>
      <aside class="drawer-panel" aria-label="Menu">
        <div class="dh"><img src="${asset('assets/img/logo.png')}" alt="Annapurna Adventure"><button class="icon-btn" data-close-drawer aria-label="Tutup menu"><i class="fa-solid fa-xmark"></i></button></div>
        ${LINKS.map((l) => `<a class="dl ${page === l.key ? 'active' : ''}" href="${url(l.href)}"><i class="fa-solid ${l.icon}"></i>${l.label}</a>`).join('')}
        <a class="dl ${page === 'belanja' ? 'active' : ''}" href="${url('belanja')}"><i class="fa-solid fa-bag-shopping"></i>Belanja Alat</a>
        <a class="dl" href="${url('keranjang')}"><i class="fa-solid fa-cart-shopping"></i>Keranjang</a>
        ${s ? `<a class="dl" href="${url('pesanan')}"><i class="fa-solid fa-receipt"></i>Pesanan Saya</a>
               <a class="dl" href="${url('profil')}"><i class="fa-regular fa-user"></i>Profil</a>
               ${DB.isStaff(s) ? `<a class="dl" href="${url(DB.panelHome(s))}"><i class="fa-solid ${s.role === 'owner' ? 'fa-crown' : 'fa-gauge'}"></i>${s.role === 'owner' ? 'Panel Owner' : 'Panel Admin'}</a>` : ''}
               <button class="btn btn-light btn-block" id="logoutBtn2">Keluar</button>`
             : `<a class="btn btn-primary btn-block" href="${url('masuk')}">Masuk</a><a class="btn btn-outline btn-block" style="margin-top:4px" href="${url('daftar')}">Daftar akun baru</a>`}
      </aside>
    </div>
    <div class="search-pop" id="searchPop" role="dialog" aria-label="Cari produk">
      <div class="box">
        <div class="row"><i class="fa-solid fa-magnifying-glass"></i><input id="searchInput" placeholder="Cari tenda, carrier, sleeping bag…" autocomplete="off"><button class="icon-btn" id="closeSearch" aria-label="Tutup pencarian"><i class="fa-solid fa-xmark"></i></button></div>
        <div class="res" id="searchRes"></div>
      </div>
    </div>`;
    bindHeader();
  }

  function bindHeader() {
    const nav = $('#nav');
    const onScroll = () => { nav.classList.toggle('is-scrolled', scrollY > 10); const t = $('#toTop'); t && t.classList.toggle('show', scrollY > 500); };
    addEventListener('scroll', onScroll, { passive: true }); onScroll();
    updateCartDot();
    document.addEventListener('cart:change', updateCartDot);

    const drawer = $('#drawer');
    $('#openDrawer').addEventListener('click', () => { drawer.classList.add('open'); drawer.setAttribute('aria-hidden', 'false'); });
    $$('[data-close-drawer]').forEach((b) => b.addEventListener('click', () => { drawer.classList.remove('open'); drawer.setAttribute('aria-hidden', 'true'); }));

    $$('.dropdown').forEach((dd) => {
      dd.querySelector('[data-dd]').addEventListener('click', (e) => { e.stopPropagation(); $$('.dropdown.open').forEach((o) => o !== dd && o.classList.remove('open')); dd.classList.toggle('open'); });
    });
    document.addEventListener('click', (e) => { if (!e.target.closest('.dropdown')) $$('.dropdown.open').forEach((o) => o.classList.remove('open')); });

    const s = DB.session();
    const logout = () => { toast('Kamu sudah keluar.'); UI.serverLogout(url('./')); };
    $('#logoutBtn') && $('#logoutBtn').addEventListener('click', logout);
    $('#logoutBtn2') && $('#logoutBtn2').addEventListener('click', logout);
    if ($('#nxBox')) UI.notifMenu($('#nxBox'), s.email, renderHeader);
    $('#allNotif') && $('#allNotif').addEventListener('click', (e) => { e.preventDefault(); UI.notifCenter(s.email, () => {}); });
    $('#tripChip') && $('#tripChip').addEventListener('click', () => UI.tripModal(() => location.reload()));
    bottomNav(s); remindCustomer(s);
    setTimeout(() => pwCard(s), 0);

    const pop = $('#searchPop'), inp = $('#searchInput'), res = $('#searchRes');
    const open = (q) => { pop.classList.add('open'); inp.value = q || ''; draw(); setTimeout(() => inp.focus(), 30); };
    const close = () => pop.classList.remove('open');
    const draw = () => {
      const q = inp.value.trim().toLowerCase();
      const cats = DB.categories();
      const list = DB.products().filter((p) => !q || p.name.toLowerCase().includes(q) || (cats.find((c) => c.id === p.cat) || {}).name.toLowerCase().includes(q)).slice(0, 8);
      res.innerHTML = list.length ? list.map((p) => `<a href="${url('produk?id=' + p.id)}"><img src="${asset(p.img)}" alt=""><div><strong>${esc(p.name)}</strong><small>${p.rent ? rupiah(p.rent) + ' / malam' : 'Beli ' + rupiah(p.price)}</small></div></a>`).join('')
        + (q ? `<a href="${url('katalog?q=' + encodeURIComponent(q))}" style="justify-content:center;color:var(--g700);font-weight:600">Lihat semua hasil untuk “${esc(q)}”</a>` : '')
        : `<div class="empty">Tidak ada alat yang cocok dengan “${esc(q)}”. Coba kata lain, misalnya “tenda” atau “matras”.</div>`;
    };
    $('#openSearch').addEventListener('click', () => open());
    $('#closeSearch').addEventListener('click', close);
    pop.addEventListener('click', (e) => { if (e.target === pop) close(); });
    inp.addEventListener('input', draw);
    inp.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') close();
      if (e.key === 'Enter') location.href = url('katalog?q=' + encodeURIComponent(inp.value.trim()));
    });
    window.openSearch = open;
  }

  function updateCartDot() { const d = $('#cartDot'); if (d) { const n = Cart.count(); d.textContent = n; } }

  function renderFooter() {
    const el = $('#site-footer'); if (!el) return;
    const st = DB.settings();
    el.outerHTML = `<footer class="footer">
      <div class="wrap footer-grid">
        <div>
          <img class="flogo" src="${asset('assets/img/logo-white.png')}" alt="Annapurna Adventure">
          <p>Annapurna Adventure Shop &amp; Rental. Sewa mudah, harga bersahabat, kenangan tak terlupakan. Teman terbaik setiap petualanganmu!</p>
        </div>
        <div>
          <h5>Menu</h5>
          <ul>${LINKS.map((l) => `<li><a href="${url(l.href)}">${l.label}</a></li>`).join('')}<li><a href="${url('kontak#cek-pesanan')}">Cek Status Pesanan</a></li></ul>
        </div>
        <div>
          <h5>Kontak</h5>
          <ul class="kontak">
            <li><i class="fa-solid fa-wand-magic-sparkles"></i><button type="button" class="link-btn f-ai" data-ai-open>Tanya Asisten Trip (instan, 24 jam)</button></li>
            <li><i class="fa-brands fa-whatsapp"></i><a href="${waLink()}" target="_blank" rel="noopener">${esc(st.phone)}</a></li>
            <li><i class="fa-brands fa-instagram"></i><a href="https://instagram.com/${st.instagram.replace('@', '')}" target="_blank" rel="noopener">${esc(st.instagram)}</a></li>
            <li><i class="fa-brands fa-tiktok"></i><a href="https://www.tiktok.com/${(st.tiktok || st.instagram).replace(/^@?/, '@')}" target="_blank" rel="noopener">${esc(st.tiktok || st.instagram)}</a></li>
            <li><i class="fa-solid fa-envelope"></i><a href="mailto:${st.email}">${esc(st.email)}</a></li>
            <li><i class="fa-solid fa-location-dot"></i><a href="${url('kontak#lokasi')}">${esc(st.address)}</a></li>
          </ul>
        </div>
        <div>
          <h5>Ikuti Kami</h5>
          <div class="soc">
            <a href="https://instagram.com/${st.instagram.replace('@', '')}" target="_blank" rel="noopener" aria-label="Instagram"><i class="fa-brands fa-instagram"></i></a>
            <a href="https://www.tiktok.com/${(st.tiktok || st.instagram).replace(/^@?/, '@')}" target="_blank" rel="noopener" aria-label="TikTok"><i class="fa-brands fa-tiktok"></i></a>
          </div>
          <div class="f-deco"><span style="color:#b9d3a6">${MTN.line}</span><span class="script">Jangan Cuma Mimpi,<br>Rasakan Petualangannya!</span></div>
        </div>
      </div>
      <div class="wrap footer-bottom"><span>Annapurna Adventure</span><span><a href="${url('tentang#ketentuan')}">Ketentuan Sewa</a> &nbsp;·&nbsp; <a href="${url('tentang#faq')}">FAQ</a></span></div>
    </footer>
    <button class="to-top" id="toTop" aria-label="Kembali ke atas"><i class="fa-solid fa-arrow-up"></i></button>`;
    $('#toTop').addEventListener('click', () => scrollTo({ top: 0, behavior: 'smooth' }));
  }

  /* Akun dibuat otomatis saat checkout → tawarkan buat kata sandi (opsional) */
  function pwCard(s) {
    if (!s || !s.needsPassword || !['pembayaran', 'pesanan', 'profil'].includes(page)) return;
    let skip = false; try { skip = sessionStorage.getItem('ann-pw-skip') === '1'; } catch (e) { skip = false; }
    const root = document.getElementById('root') || document.getElementById('list');
    if (skip || !root || document.getElementById('pwCard')) return;
    root.insertAdjacentHTML('beforebegin', `<div class="card pw-card" id="pwCard"><span class="pw-ic"><i class="fa-solid fa-user-check"></i></span><div class="pw-t"><strong>Akunmu sudah dibuat otomatis</strong><small>Kamu bisa masuk lagi kapan saja dengan kode verifikasi ke ${esc(s.email)}. Mau lebih cepat? Buat kata sandi (opsional).</small></div>
      <form class="pw-f" id="pwF"><input class="input" type="password" id="pwNew" placeholder="Kata sandi baru (min. 6 karakter)" autocomplete="new-password"><button class="btn btn-primary btn-sm">Simpan</button><button type="button" class="btn btn-ghost btn-sm" id="pwSkip">Nanti saja</button></form></div>`);
    $('#pwF').addEventListener('submit', (e) => { e.preventDefault(); const v = $('#pwNew').value; if (v.length < 6) { $('#pwNew').classList.add('err'); toast('Kata sandi minimal 6 karakter.', 'err'); return; } DB.setOwnPassword(v); $('#pwCard').remove(); toast('Kata sandi tersimpan.'); });
    $('#pwSkip').addEventListener('click', () => { $('#pwCard').remove(); try { sessionStorage.setItem('ann-pw-skip', '1'); } catch (e) { /* abaikan */ } });
  }
  /* Menu bawah untuk HP */
  function bottomNav(s) {
    if (document.getElementById('bnav')) return;
    const cart = DB.cart().reduce((a, c) => a + c.qty, 0);
    const items = [['./', 'Beranda', 'fa-house', 'home'], ['katalog', 'Sewa', 'fa-campground', 'katalog'], ['belanja', 'Beli', 'fa-bag-shopping', 'belanja'], ['keranjang', 'Keranjang', 'fa-cart-shopping', 'keranjang'], ['pesanan', 'Pesanan', 'fa-receipt', 'pesanan'], [s ? 'profil' : 'masuk', s ? 'Akun' : 'Masuk', s ? 'fa-user' : 'fa-right-to-bracket', s ? 'profil' : 'masuk']];
    document.body.insertAdjacentHTML('beforeend', `<nav class="bnav" id="bnav" aria-label="Menu bawah">${items.map(([h, l, ic, k]) => `<a href="${url(h)}" class="${page === k || (k === 'katalog' && page === 'produk') ? 'on' : ''}"><i class="fa-solid ${ic}"></i>${k === 'keranjang' && cart ? `<b>${cart}</b>` : ''}<span>${l}</span></a>`).join('')}</nav>`);
    document.body.classList.add('has-bnav');
    document.addEventListener('cart:change', () => { const n = DB.cart().reduce((a, c) => a + c.qty, 0); const a = document.querySelector('#bnav a:nth-child(4)'); if (!a) return; const b = a.querySelector('b'); if (n) { if (b) b.textContent = n; else a.insertAdjacentHTML('beforeend', `<b>${n}</b>`); } else if (b) b.remove(); });
  }
  /* Pengingat otomatis untuk customer: H-1 & hari-H ambil, H-1 & hari-H kembali, terlambat */
  function remindCustomer(s) {
    if (!s || DB.isStaff(s)) return;
    const T = D.today(), TM = D.addDays(T, 1); const st = DB.settings(); const sent = DB.get('custNotices');
    const mine = DB.bookings().filter((b) => b.customer.email === s.email || b.userEmail === s.email);
    const urgent = [];
    const push = (key, title, text, link, bar) => { if (!sent.includes(key)) { DB.notify(s.email, title, text, link); sent.push(key); } if (bar) urgent.push(bar); };
    mine.forEach((b) => {
      if (b.status === 'dikonfirmasi' && b.start === TM) push(`${b.id}|ambil-1|${T}`, 'Besok jadwal ambil barang', `${b.id}: ambil barang besok ${D.fmtDate(b.start, true)} di toko (${st.hours}). Bawa kartu identitas asli.`, `pesanan?id=${b.id}`);
      if (b.status === 'dikonfirmasi' && b.start === T) push(`${b.id}|ambil|${T}`, 'Hari ini jadwal ambil barang', `${b.id}: barang siap diambil hari ini di toko (${st.hours}). Tunjukkan nota & kartu identitas.`, `invoice?id=${b.id}`, { ic: 'fa-store', t: `<b>Hari ini jadwal ambil ${b.id}.</b> Toko buka ${esc(st.hours)} — bawa kartu identitas & tunjukkan nota.`, a: [`invoice?id=${b.id}`, 'Lihat nota'] });
      if (b.status === 'disewa' && b.end === TM) push(`${b.id}|kembali-1|${T}`, 'Besok jadwal pengembalian', `${b.id}: kembalikan barang besok ${D.fmtDate(b.end, true)}${st.lateAfterReturnTime ? `, paling lambat pukul ${st.returnTime}` : ''}. Butuh lebih lama? Ajukan perpanjangan.`, `pesanan?id=${b.id}`);
      if (b.status === 'disewa' && b.end === T) push(`${b.id}|kembali|${T}`, 'Hari ini jadwal pengembalian', `${b.id}: kembalikan barang hari ini${st.lateAfterReturnTime ? ` paling lambat pukul ${st.returnTime}` : ''} agar tidak kena denda.`, `pesanan?id=${b.id}`, { ic: 'fa-rotate-left', t: `<b>Hari ini jadwal pengembalian ${b.id}${st.lateAfterReturnTime ? `, paling lambat pukul ${esc(st.returnTime)}` : ''}.</b> Butuh lebih lama? Ajukan perpanjangan.`, a: [`pesanan?id=${b.id}`, 'Perpanjang / lihat pesanan'] });
      if (b.status === 'disewa' && b.end < T) push(`${b.id}|telat|${T}`, 'Pengembalian terlambat', `${b.id} sudah lewat ${D.diffDays(b.end, T)} hari dari jadwal kembali. Segera kembalikan agar denda tidak bertambah.`, `pesanan?id=${b.id}`, { ic: 'fa-triangle-exclamation', bad: true, t: `<b>${b.id} terlambat ${D.diffDays(b.end, T)} hari.</b> Segera kembalikan ke toko agar denda tidak bertambah.`, a: [waLink(`Halo Annapurna, saya mau mengembalikan ${b.id}`), 'Hubungi toko'] });
    });
    DB.set('custNotices', sent.slice(-300));
    const hideKey = 'ann-bar-' + T;
    let hidden = false; try { hidden = sessionStorage.getItem(hideKey) === '1'; } catch (e) { hidden = false; }
    if (urgent.length && !hidden && !document.getElementById('remBar')) {
      const u = urgent[0];
      const nav = document.getElementById('nav');
      nav && nav.insertAdjacentHTML('afterend', `<div class="rem-bar ${u.bad ? 'bad' : ''}" id="remBar"><div class="wrap"><i class="fa-solid ${u.ic}"></i><span>${u.t}${urgent.length > 1 ? ` <small>(+${urgent.length - 1} pengingat lain)</small>` : ''}</span><a class="btn btn-sm ${u.bad ? 'btn-light' : 'btn-primary'}" href="${/^https?:/.test(u.a[0]) ? u.a[0] : url(u.a[0])}" ${/^https?:/.test(u.a[0]) ? 'target="_blank" rel="noopener noreferrer"' : ''}>${u.a[1]}</a><button class="icon-btn" id="remX" aria-label="Tutup"><i class="fa-solid fa-xmark"></i></button></div></div>`);
      document.getElementById('remX').addEventListener('click', () => { document.getElementById('remBar').remove(); try { sessionStorage.setItem(hideKey, '1'); } catch (e) { /* abaikan */ } });
    }
  }

  function requireLogin() {
    if (DB.session()) return DB.session();
    location.replace(url('masuk?next=' + encodeURIComponent(location.pathname.split('/').pop() + location.search)));
    return null;
  }

  const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!reduce && 'IntersectionObserver' in window) document.documentElement.classList.add('motion');
  let io;
  function reveal(root) {
    root = root || document;
    const els = [...root.querySelectorAll('[data-reveal]:not(.in), [data-reveal-group]:not(.in)')];
    if (!document.documentElement.classList.contains('motion')) { els.forEach((e) => e.classList.add('in')); return; }
    io = io || new IntersectionObserver((entries) => entries.forEach((en) => {
      if (!en.isIntersecting) return;
      const el = en.target;
      if (el.hasAttribute('data-reveal-group')) [...el.children].forEach((c, i) => c.style.setProperty('--i', Math.min(i, 8)));
      el.classList.add('in'); io.unobserve(el);
    }), { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    els.forEach((e) => io.observe(e));
  }
  function parallax() {
    const layers = [...document.querySelectorAll('.hero-bg')];
    if (!layers.length || reduce) return;
    let ticking = false;
    const run = () => {
      const vh = innerHeight;
      layers.forEach((l) => {
        const box = l.parentElement.getBoundingClientRect();
        if (box.bottom < 0 || box.top > vh) return;
        const k = l.classList.contains('hero-bg') ? 0.28 : 0.12;
        const y = l.classList.contains('hero-bg') ? -box.top * k : (box.top + box.height / 2 - vh / 2) * -k;
        l.style.transform = `translate3d(0, ${y.toFixed(1)}px, 0)`;
      });
      ticking = false;
    };
    addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(run); } }, { passive: true });
    addEventListener('resize', run); run();
  }
  const startMotion = () => setTimeout(() => { reveal(); parallax(); document.documentElement.classList.add('ready'); }, 0);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', startMotion); else startMotion();

  window.Site = { renderHeader, renderFooter, requireLogin, reveal, MTN };
  renderHeader();
  renderFooter();
})();
