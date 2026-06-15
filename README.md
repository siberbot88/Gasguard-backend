# GasGuards: Sistem Deteksi Kebocoran Gas Smart Village

Prototipe IoT *Smart Home Safety System* yang dirancang untuk *Smart Villages*. Sistem ini mendeteksi kebocoran gas LPG sejak dini, memicu tindakan pencegahan otomatis (ventilasi *exhaust*), dan mengirimkan peringatan darurat ke Grup Telegram secara *real-time*.

## Teknologi

![IoT - ESP32](https://img.shields.io/badge/IoT-ESP32-blue)
![Backend - Node.js](https://img.shields.io/badge/Backend-Node.js-green)
![Database - MongoDB](https://img.shields.io/badge/Database-MongoDB-47A248)
![Cloud - MQTT HiveMQ](https://img.shields.io/badge/Cloud-MQTT_HiveMQ-yellow)
![Alert - Telegram Bot API](https://img.shields.io/badge/Alert-Telegram_Bot_API-2CA5E0)

## Fitur Utama

* **Deteksi Real-Time**: Pemantauan terus-menerus 24/7 melalui sensor MQ-5.
* **Sistem Exhaust Otomatis**: Mengaktifkan *Brushless Fan* 12V menggunakan Relay.
* **Alarm Lokal**: Menggunakan *Buzzer* dan LED Merah/Hijau sebagai indikator visual dan suara.
* **Pemantauan Cloud**: Menggunakan *Blynk IoT* untuk pemantauan jarak jauh.
* **Pencatatan Database**: Menyimpan log data menggunakan MongoDB.
* **Peringatan Grup Telegram**: Mengirimkan notifikasi peringatan dengan fitur anti-spam.

## Komponen Perangkat Keras (Hardware)

* ESP32 DOIT DevKit V1
* Sensor MQ-5
* Modul Relay 1-Channel 5V (Active LOW)
* Brushless Fan PC 12V
* Active Buzzer 5V
* LED Merah
* LED Hijau
* Adaptor DC 12V 2A
* Modul Step-Down LM2596 (12V ke 5V)

## Perangkat Lunak (Software)

* C++ (Arduino IDE)
* HiveMQ Cloud (Private TLS/SSL)
* Node.js (Express.js)
* MongoDB Atlas
* Telegraf (Telegram Bot)
* Blynk.cloud

## Pemetaan Pin (Pin Mapping)

| Komponen | Pin Modul | Pin ESP32 | Keterangan |
|---|---|---|---|
| Sensor MQ-5 | A0 | D34 | Input Analog |
| Relay 1-Channel | IN | D26 | Active LOW |
| LED Merah | Anode (+) | D26 | Dibagikan dengan relay (sebagai penahan arus) |
| Active Buzzer | Positive (+) | D25 | Output Digital |
| LED Hijau | Anode (+) | D23 | Output Digital |
| Modul LM2596 | OUT+ dan OUT- | VIN dan GND | Dikalibrasi ke 5.0V |

## Panduan Instalasi

### 1. Backend (Node.js)

Jalankan perintah berikut di terminal untuk menginstal dependensi:

```bash
npm install express mongoose mqtt axios cors dotenv telegraf
```

Buat file `.env` di direktori proyek dan konfigurasikan variabel berikut:

```env
PORT=3000
MONGODB_URI=your_mongodb_atlas_connection_string
MQTT_BROKER=your_hivemq_cluster_url
MQTT_USERNAME=your_mqtt_username
MQTT_PASSWORD=your_mqtt_password
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
TELEGRAM_CHAT_ID=your_telegram_group_chat_id
```

Jalankan server backend:

```bash
npm start
```

### 2. Mikrokontroler (Arduino IDE)

Instal *library* berikut melalui *Library Manager* di Arduino IDE:
* **PubSubClient** (oleh Nick O'Leary)
* **ArduinoJson** (versi 6.x oleh Benoit Blanchon)

Pastikan *Board Manager* untuk ESP32 sudah terinstal dan pilih *board* **DOIT ESP32 DEVKIT V1**.

## Perintah Telegram Bot

Bot Telegram dilengkapi dengan beberapa perintah interaktif berikut:

* `/start` - Memulai interaksi dengan bot.
* `/help` - Menampilkan panduan dan bantuan penggunaan bot.
* `/info` - Menampilkan informasi status sistem GasGuards saat ini.

## Kredit

Dikembangkan oleh **Kelompok 4**
