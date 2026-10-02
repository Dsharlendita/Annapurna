<?php

namespace App\Http\Controllers\Annapurna;

use App\Http\Controllers\Controller;
use Illuminate\Contracts\View\View;

class AdminController extends Controller
{
    public function dashboard(): View { return view('annapurna.admin.dashboard'); }
    public function booking(): View { return view('annapurna.admin.booking'); }
    public function pengembalian(): View { return view('annapurna.admin.pengembalian'); }
    public function permintaan(): View { return view('annapurna.admin.permintaan'); }
    public function barang(): View { return view('annapurna.admin.barang'); }
    public function penjualan(): View { return view('annapurna.admin.penjualan'); }
    public function keuangan(): View { return view('annapurna.admin.keuangan'); }
    public function laporan(): View { return view('annapurna.admin.laporan'); }
    public function ulasan(): View { return view('annapurna.admin.ulasan'); }
    public function pengaturan(): View { return view('annapurna.admin.pengaturan'); }
    public function sop(): View { return view('annapurna.admin.sop'); }
    public function perawatan(): View { return view('annapurna.admin.perawatan'); }
    public function kalender(): View { return view('annapurna.admin.kalender'); }
}
