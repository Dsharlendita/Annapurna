<!DOCTYPE html>
<html lang="id">
<body style="margin:0;background:#f6f4ee;font-family:Arial,Helvetica,sans-serif;color:#17261c">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:24px 0"><tr><td align="center">
    <table width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #e4dfd4;border-radius:12px;padding:28px">
      <tr><td style="border-bottom:2px solid #1f4d2f;padding-bottom:14px"><strong style="font-size:18px;color:#1f4d2f">Annapurna Adventure</strong></td></tr>
      <tr><td style="padding-top:18px;font-size:14px;line-height:1.6">
        <p>Halo <strong>{{ $user->name }}</strong>,</p>
        <p>
          @if ($purpose === 'reset')
            Kami menerima permintaan untuk mengatur ulang kata sandi akun Annapurna Adventure kamu. Masukkan kode berikut di halaman yang sedang kamu buka:
          @else
            Masukkan kode berikut untuk masuk ke akun Annapurna Adventure kamu:
          @endif
        </p>
        <p style="text-align:center;margin:22px 0">
          <span style="display:inline-block;font-size:30px;letter-spacing:8px;font-weight:bold;color:#1f4d2f;background:#eef6f0;padding:12px 22px;border-radius:10px">{{ $code }}</span>
        </p>
        <p>Kode berlaku <strong>{{ $minutes }} menit</strong> dan hanya bisa dipakai sekali.</p>
        <p style="font-size:13px;color:#6b766e">Jangan berikan kode ini kepada siapa pun, termasuk yang mengaku dari Annapurna. Kalau kamu tidak merasa meminta kode ini, abaikan email ini. Akunmu tetap aman.</p>
      </td></tr>
    </table>
  </td></tr></table>
</body>
</html>
