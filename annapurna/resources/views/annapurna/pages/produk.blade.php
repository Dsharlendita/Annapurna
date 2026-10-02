@extends('annapurna.layouts.app')

@section('title', 'Detail Produk')
@section('page', 'katalog')

@section('content')
<main class="section" style="padding-top:28px">
  <div class="wrap" id="root"></div>
</main>
@endsection

@push('scripts')
  <script src="{{ asset('assets/js/pages/produk.js') }}?v={{ config('app.asset_version') }}"></script>
@endpush
