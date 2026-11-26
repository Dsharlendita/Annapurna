Halo {{ $user->name }},

@if ($purpose === 'reset')
Kami menerima permintaan untuk mengatur ulang kata sandi akun Annapurna Adventure kamu. Masukkan kode verifikasi berikut di halaman yang sedang kamu buka:
@else
Masukkan kode verifikasi berikut untuk masuk ke akun Annapurna Adventure kamu:
@endif

Kode verifikasi: {{ $code }}

Kode berlaku {{ $minutes }} menit dan hanya bisa dipakai sekali.

Jangan berikan kode ini kepada siapa pun, termasuk yang mengaku dari Annapurna. Kalau kamu tidak merasa meminta kode ini, abaikan email ini. Akunmu tetap aman.

Salam,
Annapurna Adventure
Sewa & jual perlengkapan outdoor
{{ url('/') }}

Email ini dikirim otomatis oleh sistem website Annapurna Adventure.
