<!DOCTYPE html>
<html lang="id">
<body style="margin:0;background:#f6f4ee;font-family:Arial,Helvetica,sans-serif;color:#17261c">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:24px 0"><tr><td align="center">
    <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #e4dfd4;border-radius:12px;padding:28px">
      <tr><td style="border-bottom:2px solid #1f4d2f;padding-bottom:14px"><strong style="font-size:18px;color:#1f4d2f">Annapurna Adventure</strong></td></tr>
      <tr><td style="padding-top:18px;font-size:14px;line-height:1.6">
        <p>Halo <strong>{{ $staff->name }}</strong>,</p>
        <p>Akun staff Anda di <strong>Annapurna Adventure</strong> telah dibuat oleh Owner (<strong>{{ $owner->name }}</strong>).</p>
        <table width="100%" cellpadding="8" cellspacing="0" style="border-collapse:collapse;font-size:14px">
          <tr><td style="color:#6b766e;border-bottom:1px solid #e4dfd4">Nama toko</td><td style="border-bottom:1px solid #e4dfd4">Annapurna Adventure</td></tr>
          <tr><td style="color:#6b766e;border-bottom:1px solid #e4dfd4">Nama akun</td><td style="border-bottom:1px solid #e4dfd4">{{ $staff->name }}</td></tr>
          <tr><td style="color:#6b766e;border-bottom:1px solid #e4dfd4">Email akun</td><td style="border-bottom:1px solid #e4dfd4">{{ $staff->email }}</td></tr>
          <tr><td style="color:#6b766e;border-bottom:1px solid #e4dfd4">Kata sandi sementara</td><td style="border-bottom:1px solid #e4dfd4"><code>{{ $temporaryPassword }}</code></td></tr>
          <tr><td style="color:#6b766e;border-bottom:1px solid #e4dfd4">Link website</td><td style="border-bottom:1px solid #e4dfd4"><a href="{{ $loginUrl }}">{{ $loginUrl }}</a></td></tr>
        </table>
        <p><strong>Cara masuk:</strong></p>
        <ol><li>Buka link website di atas.</li><li>Masuk dengan email akun dan kata sandi sementara.</li><li>Buat kata sandi baru saat pertama login.</li><li>Jangan bagikan kata sandi kepada siapa pun.</li></ol>
        <p style="font-size:12.5px;color:#6b766e">Akun ini dibuat oleh Owner Annapurna Adventure. Semua aktivitas di panel admin tercatat otomatis di histori sistem.</p>
        <p><a href="{{ $loginUrl }}" style="display:inline-block;background:#1f4d2f;color:#ffffff;padding:10px 18px;border-radius:10px;text-decoration:none;font-weight:bold">Masuk ke panel</a></p>
      </td></tr>
    </table>
  </td></tr></table>
</body>
</html>
