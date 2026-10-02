<?php

namespace App\Http\Controllers\Annapurna;

use App\Http\Controllers\Controller;
use Illuminate\Contracts\View\View;

class OwnerController extends Controller
{
    public function dashboard(): View { return view('annapurna.owner.dashboard'); }
    public function histori(): View { return view('annapurna.owner.histori'); }
    public function staff(): View { return view('annapurna.owner.staff'); }
    public function integrasi(): View { return view('annapurna.owner.integrasi'); }
    public function konfigurasi(): View { return view('annapurna.owner.konfigurasi'); }
}
