Halo {{ $staff->name }},

Akun staff Anda di Annapurna Adventure telah dibuat oleh Owner ({{ $owner->name }}).

Nama toko: Annapurna Adventure
Nama akun: {{ $staff->name }}
Email akun: {{ $staff->email }}
@if ($temporaryPassword)
Kata sandi sementara: {{ $temporaryPassword }}
@else
Kata sandi: diberikan langsung oleh Owner
@endif
Link website: {{ $loginUrl }}

Cara masuk:
1. Buka link website di atas.
2. Masuk dengan email akun dan kata sandi {{ $temporaryPassword ? 'sementara' : 'yang diberikan Owner' }}.
@if ($temporaryPassword || $mustChange)
3. Buat kata sandi baru saat pertama login.
@endif
- Jangan bagikan kata sandi kepada siapa pun.

Akun ini dibuat oleh Owner Annapurna Adventure. Semua aktivitas di panel admin tercatat otomatis di histori sistem.

Salam,
Annapurna Adventure
{{ url('/') }}
