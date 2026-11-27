Halo {{ $staff->name }},

Akun staff Anda di Annapurna Adventure telah dibuat oleh Owner ({{ $owner->name }}).

Nama toko: Annapurna Adventure
Nama akun: {{ $staff->name }}
Email akun: {{ $staff->email }}
@if ($temporaryPassword)
{{ $mustChange ? 'Kata sandi sementara' : 'Kata sandi' }}: {{ $temporaryPassword }}
@else
Kata sandi: diberikan langsung oleh Owner
@endif
Link website: {{ $loginUrl }}

Cara masuk:
1. Buka link website di atas.
2. Masuk dengan email akun dan kata sandi {{ $temporaryPassword ? 'di atas' : 'yang diberikan Owner' }}.
@if ($mustChange)
3. Buat kata sandi baru saat pertama login.
@endif
- Jangan bagikan kata sandi kepada siapa pun.
@if ($temporaryPassword)
- Setelah berhasil masuk, sebaiknya hapus email ini.
@endif

Akun ini dibuat oleh Owner Annapurna Adventure. Semua aktivitas di panel admin tercatat otomatis di histori sistem.

Salam,
Annapurna Adventure
{{ url('/') }}
