(function () {
  const st = Ann.DB.settings(); const { $, esc, waLink, validate, isPhone, toast } = UI;
  const s = Ann.DB.session();
  if (s) { $('#cName').value = s.name; $('#cPhone').value = s.phone || ''; }
  $('#cInfo').innerHTML = [
    ['fa-brands fa-whatsapp', 'WhatsApp', `<a href="${waLink()}" target="_blank" rel="noopener">${esc(st.phone)}</a>`],
    ['fa-solid fa-envelope', 'Email', `<a href="mailto:${st.email}">${esc(st.email)}</a>`],
    ['fa-brands fa-instagram', 'Instagram', `<a href="https://instagram.com/${st.instagram.replace('@', '')}" target="_blank" rel="noopener">${esc(st.instagram)}</a>`],
    ['fa-solid fa-location-dot', 'Alamat', esc(st.address)],
    ['fa-regular fa-clock', 'Jam buka', esc(st.hours)],
  ].map(([i, l, v]) => `<div class="c-item"><span class="ic"><i class="${i}"></i></span><div><small>${l}</small><strong style="font-weight:600">${v}</strong></div></div>`).join('');
  const q = encodeURIComponent(st.address);
  $('#mapFrame').src = `https://maps.google.com/maps?q=${q}&z=15&output=embed`;
  $('#mapLink').href = `https://www.google.com/maps/search/?api=1&query=${q}`;
  const form = $('#cForm');
  const check = () => validate(form, {
    name: (v) => (!v ? 'Isi nama kamu.' : ''),
    phone: (v) => (!v ? 'Isi nomor WhatsApp.' : !isPhone(v) ? 'Nomor tidak valid. Contoh: 081234567890.' : ''),
    msg: (v) => (v.length < 5 ? 'Tulis pesanmu, minimal 5 karakter.' : ''),
  });
  const text = () => `Halo Annapurna Adventure, saya ${form.elements.name.value} (${form.phone.value}).\nKeperluan: ${form.topic.value}\n\n${form.msg.value}`;
  form.addEventListener('submit', (e) => { e.preventDefault(); if (!check()) return; window.open(waLink(text()), '_blank'); toast('WhatsApp dibuka di tab baru. Tinggal tekan kirim.'); });
  $('#cEmail').addEventListener('click', () => { if (!check()) return; location.href = `mailto:${st.email}?subject=${encodeURIComponent(form.topic.value)}&body=${encodeURIComponent(text())}`; });
})();

