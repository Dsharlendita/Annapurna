<?php

namespace App\Console\Commands;

use App\Models\LaundryOrder;
use App\Support\Audit;
use Illuminate\Console\Command;

class RemindUnclaimedLaundry extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'laundry:remind';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Cek pesanan laundry yang sudah siap diambil lebih dari 3 hari tetapi belum diambil pemiliknya';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $threeDaysAgo = now()->subDays(3);

        $unclaimed = LaundryOrder::where('status', 'siap')
            ->where(function ($q) use ($threeDaysAgo) {
                $q->where('updated_at', '<=', $threeDaysAgo)
                  ->orWhere('est_done', '<=', $threeDaysAgo->toDateString());
            })
            ->get();

        if ($unclaimed->isEmpty()) {
            $this->info('Tidak ada cucian yang menumpuk lebih dari 3 hari.');
            return Command::SUCCESS;
        }

        $this->warn("Ditemukan {$unclaimed->count()} pesanan laundry yang belum diambil > 3 hari:");

        foreach ($unclaimed as $order) {
            $this->line("- Nota {$order->nota_no} atas nama {$order->customer_name} ({$order->customer_phone})");

            $order->logs()->create([
                'from_status' => 'siap',
                'to_status' => 'siap',
                'note' => "Pengingat otomatis sistem: cucian sudah siap > 3 hari belum diambil.",
                'created_by' => null,
            ]);
        }

        $this->info('Pemeriksaan laundry unclaimed selesai.');
        return Command::SUCCESS;
    }
}
