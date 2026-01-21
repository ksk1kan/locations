# FL Konum (Offline PWA)

Şoförlerin hiç dosya yüklemeden, uygulamanın içindeki veri üzerinden konum araması yapıp Google Maps linkine tek tıkla ulaşması için hazırlanmış offline PWA.

## Kullanım
- Arama kutusuna müşteri / villa / site / apart adını yaz.
- Birden fazla sonuç çıkarsa doğru olan kartı seç (dokun).
- Kartın içinde **Google Maps’te Aç** ve **Linki Kopyala** butonları var.

## Güncelleme Mantığı
- Konum verisi `locations.json` dosyasındadır.
- Veri güncellemek için bu dosyayı değiştirip GitHub’a push etmen yeter.
- Uygulama online açıldığında yeni veriyi alır; offline’da cache’deki son veri çalışır.

##wekinq aka BAF

> İlk kullanımda en az bir kez internet gerekir (dosyaları cihaza cache’lemek için).
