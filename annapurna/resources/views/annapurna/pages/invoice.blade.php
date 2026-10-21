@extends('annapurna.layouts.app')

@section('title', 'Invoice')
@section('page', 'invoice')

@section('content')
<main class="section" style="padding-top:28px">
  <div class="wrap" style="max-width:860px">
    <div class="no-print" style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:16px">
      <a class="btn btn-light btn-sm" id="back" href="{{ route('pesanan') }}"><i class="fa-solid fa-arrow-left"></i> Kembali</a>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <a class="btn btn-light btn-sm" id="waShare" target="_blank" rel="noopener"><i class="fa-brands fa-whatsapp"></i> Kirim ke WhatsApp</a>
        <button class="btn btn-light btn-sm" id="prStruk" type="button" title="Struk printer thermal 58/80 mm"><i class="fa-solid fa-receipt"></i> Cetak struk</button>
        <button class="btn btn-light btn-sm" onclick="window.print()" title="Cetak nota ukuran A4"><i class="fa-solid fa-print"></i> Cetak A4</button>
        <button class="btn btn-primary btn-sm" id="dlPdf"><i class="fa-solid fa-file-arrow-down"></i> Unduh PDF</button>
      </div>
    </div>
    <div id="inv"></div>
  </div>
</main>
@endsection

@push('scripts')
  <script src="{{ asset('assets/js/pages/invoice.js') }}?v={{ config('app.asset_version') }}"></script>
@endpush
