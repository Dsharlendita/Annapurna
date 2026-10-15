<!DOCTYPE html>
<html lang="id">
<body style="margin:0;background:#f6f4ee;font-family:Arial,Helvetica,sans-serif;color:#17261c">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:24px 0"><tr><td align="center">
    <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #e4dfd4;border-radius:12px;padding:28px">
      <tr><td style="border-bottom:2px solid #1f4d2f;padding-bottom:14px"><strong style="font-size:18px;color:#1f4d2f">Annapurna Adventure</strong></td></tr>
      <tr><td style="padding-top:18px;font-size:14px;line-height:1.6">
        <p>Halo <strong>{{ $staff->name }}</strong>,</p>
        <p>Kata sandi akun staff Anda di <strong>Annapurna Adventure</strong> telah diatur ulang oleh Owner (<strong>{{ $owner->name }}</strong>).</p>
        <table width="100%" cellpadding="8" cellspacing="0" style="border-collapse:collapse;font-size:14px">
          <tr><td style="color:#6b766e;border-bottom:1px solid #e4dfd4">Nama akun</td><td style="border-bottom:1px solid #e4dfd4">{{ $staff->name }}</td></tr>
          <tr><td style="color:#6b766e;border-bottom:1px solid #e4dfd4">Email akun</td><td style="border-bottom:1px solid #e4dfd4">{{ $staff->email }}</td></tr>
          <tr><td style="color:#6b766e;border-bottom:1px solid #e4dfd4">Role</td><td style="border-bottom:1px solid #e4dfd4">{{ ucfirst($staff->role) }}</td></tr>
          <tr><td style="color:#6b766e;border-bottom:1px solid #e4dfd4">Kata sandi sementara baru</td><td style="border-bottom:1px solid #e4dfd4"><code style="font-size:15px;background:#eef6f0;padding:2px 8px;border-radius:4px;color:#1f4d2f;font-weight:bold">{{ $temporaryPassword }}</code></td></tr>
          <tr><td style="color:#6b766e;border-bottom:1px solid #e4dfd4">Link login</td><td style="border-bottom:1px solid #e4dfd4"><a href="{{ $loginUrl }}">{{ $loginUrl }}</a></td></tr>
        </table>
        <p><strong>Penting:</strong></p>
        <ol>
          <li>Kata sandi lama Anda sudah <strong>tidak berlaku</strong> dan seluruh sesi login sebelumnya telah dinonaktifkan.</li>
          <li>Masuk ke sistem menggunakan email dan kata sandi sementara baru di atas.</li>
          <li>Anda <strong>wajib membuat kata sandi baru</strong> saat pertama kali berhasil masuk.</li>
          <li>Jangan bagikan kata sandi sementara ini kepada siapa pun.</li>
        </ol>
        <p style="font-size:12.5px;color:#6b766e">Aktivitas ini dicatat otomatis pada sistem audit Annapurna Adventure demi keamanan akun.</p>
        <p><a href="{{ $loginUrl }}" style="display:inline-block;background:#1f4d2f;color:#ffffff;padding:10px 18px;border-radius:10px;text-decoration:none;font-weight:bold">Masuk ke Panel</a></p>
      </td></tr>
    </table>
  </td></tr></table>
</body>
</html>
