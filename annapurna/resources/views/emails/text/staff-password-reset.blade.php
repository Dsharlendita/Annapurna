Halo {{ $staff->name }},

Kata sandi akun staff Anda di Annapurna Adventure telah diatur ulang oleh Owner ({{ $owner->name }}).

Nama akun: {{ $staff->name }}
Email akun: {{ $staff->email }}
Role: {{ ucfirst($staff->role) }}
@if ($temporaryPassword)
Kata sandi sementara baru: {{ $temporaryPassword }}
@else
Kata sandi baru: diberikan langsung oleh Owner
@endif
Link login: {{ $loginUrl }}

Penting:
- Kata sandi lama Anda sudah tidak berlaku dan seluruh sesi login sebelumnya telah dinonaktifkan.
- Masuk menggunakan email dan kata sandi {{ $temporaryPassword ? 'sementara baru di atas' : 'baru yang diberikan Owner' }}.
- Anda wajib membuat kata sandi baru saat pertama kali berhasil masuk.
- Jangan bagikan kata sandi ini kepada siapa pun.

Aktivitas ini dicatat otomatis pada sistem audit Annapurna Adventure demi keamanan akun.

Salam,
Annapurna Adventure
{{ url('/') }}
