<?php

namespace Tests\Feature;

use App\Mail\LoginCodeMail;
use App\Mail\StaffAccountCreated;
use App\Mail\StaffPasswordReset;
use App\Models\User;
use Tests\TestCase;

/** Email transaksional punya versi teks (bukan HTML saja) dan subjek yang jelas, agar tidak ditahan filter spam hosting. */
class EmailTemplateTest extends TestCase
{
    public function test_email_punya_versi_teks_dan_subjek_jelas(): void
    {
        $staff = new User(['name' => 'Febi', 'email' => 'feb@mail.com', 'role' => 'admin']);
        $owner = new User(['name' => 'Pak Ikun', 'email' => 'owner@annapurna.id', 'role' => 'owner']);

        $kode = new LoginCodeMail($staff, '482913', 'reset', 10);
        $kode->assertHasSubject('Kode verifikasi atur ulang kata sandi akun Annapurna Adventure');
        $kode->assertSeeInText('Kode verifikasi: 482913');
        $kode->assertSeeInText('berlaku 10 menit');
        $kode->assertSeeInHtml('482913');
        (new LoginCodeMail($staff, '111222', 'login', 10))->assertHasSubject('Kode verifikasi masuk akun Annapurna Adventure');

        $baru = new StaffAccountCreated($staff, $owner, null, true);
        $baru->assertSeeInText('Akun staff Anda di Annapurna Adventure telah dibuat oleh Owner (Pak Ikun).');
        $baru->assertSeeInText('Kata sandi: diberikan langsung oleh Owner');

        $reset = new StaffPasswordReset($staff, $owner, 'Sem3ntara9', true);
        $reset->assertSeeInText('Kata sandi sementara baru: Sem3ntara9');
    }

    public function test_reply_to_global_dari_env(): void
    {
        config(['mail.reply_to.address' => 'toko@mail.com']);
        \Illuminate\Support\Facades\Mail::purge();
        $sent = null;
        \Illuminate\Support\Facades\Event::listen(\Illuminate\Mail\Events\MessageSending::class, function ($e) use (&$sent) { $sent = $e->message; });
        \Illuminate\Support\Facades\Mail::to('a@mail.com')->send(new LoginCodeMail(new User(['name' => 'A', 'email' => 'a@mail.com']), '123456', 'login', 10));
        $this->assertSame('toko@mail.com', $sent->getReplyTo()[0]->getAddress());
        $this->assertNotEmpty($sent->getTextBody());
    }
}
