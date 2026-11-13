<?php

namespace Database\Seeders;

use App\Models\Booking;
use App\Models\BookingItem;
use App\Models\Payment;
use App\Models\User;
use Illuminate\Database\Seeder;

/**
 * Satu contoh booking sewa (DP sudah dibayar) supaya halaman admin dan
 * "Pesanan Saya" tidak kosong saat pertama kali dicoba.
 */
class ContohTransaksiSeeder extends Seeder
{
    public function run(): void
    {
        $customer = User::where('role', 'customer')->first();
        if (! $customer) {
            return;
        }

        $booking = Booking::updateOrCreate(
            ['booking_code' => 'RNT-1001'],
            [
                'user_id' => $customer->id,
                'customer_name' => $customer->name,
                'customer_phone' => $customer->phone ?? '081390001122',
                'customer_email' => $customer->email,
                'customer_address' => $customer->address ?? 'Purwokerto',
                'start_date' => now()->addDays(3),
                'end_date' => now()->addDays(5),
                'days' => 2,
                'subtotal' => 80000,
                'total_amount' => 80000,
                'dp_amount' => 40000,
                'payment_method' => 'Transfer',
                'status' => 'dikonfirmasi',
                'payment_status' => 'dp_paid',
                'delivery_mode' => 'ambil',
                'notes' => 'Diambil pagi hari',
            ]
        );

        BookingItem::updateOrCreate(
            ['booking_id' => $booking->id, 'product_id' => 'tnd-4'],
            [
                'product_name' => 'Tenda Kapasitas 4 (Double Layer)',
                'product_img' => 'assets/img/wa/tnd-4.jpg',
                'qty' => 1,
                'price_per_day' => 40000,
                'subtotal' => 80000,
            ]
        );

        Payment::updateOrCreate(
            ['booking_id' => $booking->id, 'payment_type' => 'DP'],
            [
                'amount' => 40000,
                'payment_method' => 'Transfer',
                'bank_name' => 'BCA',
                'status' => 'verified',
                'paid_at' => now()->subDay(),
                'verified_at' => now()->subHours(12),
            ]
        );
    }
}
