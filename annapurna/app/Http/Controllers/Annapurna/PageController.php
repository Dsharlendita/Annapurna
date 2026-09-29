<?php

namespace App\Http\Controllers\Annapurna;

use App\Http\Controllers\Controller;
use Illuminate\Contracts\View\View;

class PageController extends Controller
{
    public function home(): View { return view('annapurna.pages.index'); }
    public function katalog(): View { return view('annapurna.pages.katalog'); }
    public function produk(): View { return view('annapurna.pages.produk'); }
    public function paket(): View { return view('annapurna.pages.paket'); }
    public function tentang(): View { return view('annapurna.pages.tentang'); }
    public function kontak(): View { return view('annapurna.pages.kontak'); }

    public function masuk(): View { return view('annapurna.pages.masuk'); }
    public function daftar(): View { return view('annapurna.pages.daftar'); }

    public function keranjang(): View { return view('annapurna.pages.keranjang'); }
    public function checkout(): View { return view('annapurna.pages.checkout'); }
    public function pembayaran(): View { return view('annapurna.pages.pembayaran'); }
    public function pesanan(): View { return view('annapurna.pages.pesanan'); }
    public function invoice(): View { return view('annapurna.pages.invoice'); }
    public function profil(): View { return view('annapurna.pages.profil'); }
}
