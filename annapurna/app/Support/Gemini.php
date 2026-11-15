<?php

namespace App\Support;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use RuntimeException;

/**
 * Klien kecil Gemini API (Google AI Studio) tanpa paket tambahan.
 * Jawaban selalu JSON sesuai skema, supaya tampilan tidak perlu menebak isi teks model.
 *
 * Gagal → GeminiException dengan kode HTTP untuk tampilan:
 *   503 belum diatur · 429 kuota habis / batas harian · 502 Google error / jawaban tidak valid
 * Tampilan memakai jawaban cadangan berbasis aturan untuk semua kode tersebut.
 */
class Gemini
{
    public static function enabled(): bool
    {
        return filled(config('services.gemini.key'));
    }

    /**
     * @param  array  $contents  [['role' => 'user'|'model', 'text' => '…'], …]
     * @param  array  $schema    responseSchema (format OpenAPI Gemini: OBJECT, STRING, …)
     */
    public static function json(string $system, array $contents, array $schema, float $temperature = 0.4): array
    {
        if (! self::enabled()) {
            throw new GeminiException('Asisten AI belum diatur.', 503);
        }
        $limit = (int) config('services.gemini.daily_limit');
        $key = 'gemini_calls_' . now()->format('Ymd');
        if ($limit > 0 && (int) Cache::get($key, 0) >= $limit) {
            throw new GeminiException('Batas pemakaian asisten AI hari ini sudah tercapai.', 429);
        }
        Cache::add($key, 0, now()->endOfDay());
        Cache::increment($key);

        $model = preg_replace('/[^a-z0-9.\-]/i', '', (string) config('services.gemini.model')) ?: 'gemini-2.5-flash';
        try {
            $res = Http::withHeaders(['x-goog-api-key' => config('services.gemini.key')])
                ->acceptJson()->timeout(20)
                ->post("https://generativelanguage.googleapis.com/v1beta/models/{$model}:generateContent", [
                    'systemInstruction' => ['parts' => [['text' => $system]]],
                    'contents' => array_map(fn ($c) => ['role' => $c['role'] === 'model' ? 'model' : 'user', 'parts' => [['text' => (string) $c['text']]]], $contents),
                    'generationConfig' => [
                        'temperature' => $temperature,
                        'maxOutputTokens' => 2048,
                        'responseMimeType' => 'application/json',
                        'responseSchema' => $schema,
                    ],
                ]);
        } catch (\Throwable $e) {
            report($e);
            throw new GeminiException('Asisten AI tidak dapat dihubungi.', 502);
        }
        if ($res->status() === 429) {
            throw new GeminiException('Kuota asisten AI sedang habis.', 429);
        }
        if ($res->failed()) {
            report(new RuntimeException('Gemini ' . $res->status() . ': ' . mb_substr($res->body(), 0, 300)));
            throw new GeminiException('Asisten AI sedang bermasalah.', 502);
        }
        $text = collect($res->json('candidates.0.content.parts', []))->pluck('text')->filter()->implode('');
        $data = json_decode($text, true);
        if (! is_array($data)) {
            throw new GeminiException('Jawaban asisten AI tidak bisa dibaca.', 502);
        }

        return $data;
    }
}
