require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const mqtt = require('mqtt');
const axios = require('axios');
const cors = require('cors');
const { Telegraf } = require('telegraf'); // <-- Menggunakan library Telegraf modern

const app = express();
app.use(express.json());
app.use(cors());

// ==========================================
// 1. KONEKSI MONGODB
// ==========================================
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log("Terhubung ke MongoDB"))
    .catch((err) => console.error("Gagal terhubung ke MongoDB:", err.message));

const GasSchema = new mongoose.Schema({
    gas_value: Number,
    status: String,
    kipas_aktif: Boolean,
    timestamp: { type: Date, default: Date.now }
});
const GasModel = mongoose.model('GasData', GasSchema);

app.get('/api/history', async (req, res) => {
    try {
        const data = await GasModel.find().sort({ timestamp: -1 }).limit(20);
        res.status(200).json({ success: true, data: data });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// ==========================================
// 2. SETUP TELEGRAM BOT & COMMANDS (Telegraf)
// ==========================================
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
let isAlertSent = false; 

// Command: /start
bot.start((ctx) => {
    const pesan = `Halo ${ctx.from.first_name}!\n\nSistem Notifikasi Keamanan *GasGuards* telah aktif dan terhubung dengan perangkat pintar Anda.\n\nKetik /help untuk panduan, atau /info untuk detail project.`;
    ctx.reply(pesan, { parse_mode: "Markdown" });
});

// Command: /help
bot.help((ctx) => {
    const pesan = `*PANDUAN SISTEM GASGUARDS*\n\n1. Sistem memantau kondisi udara 24 jam non-stop.\n2. Jika menerima pesan *BAHAYA*, segera periksa sumber gas Anda dan pastikan tidak ada percikan api.\n3. Kipas Exhaust otomatis menyala untuk membuang gas.\n4. Sistem kembali ke mode standby jika gas sudah tidak terdeteksi.`;
    ctx.reply(pesan, { parse_mode: "Markdown" });
});

// Command: /info
bot.command('info', (ctx) => {
    const pesan = `*INFORMASI PROJECT*\n\n*Nama Project:* GasGuards\n*Deskripsi:* Smart Home Safety System Berbasis IoT untuk Deteksi Kebocoran Gas LPG pada Kawasan Smart Village.\n*Komponen:* ESP32, Sensor MQ-5, Relay, Exhaust Fan 12V.\n*Cloud:* HiveMQ, MongoDB, Blynk IoT, & Telegram.`;
    ctx.reply(pesan, { parse_mode: "Markdown" });
});

// Menjalankan Bot Telegram
bot.launch();
console.log("Bot Telegram berhasil diaktifkan!");

// ==========================================
// 3. KONEKSI MQTT & LOGIKA SISTEM
// ==========================================
const mqttOptions = {
    username: process.env.MQTT_USER,
    password: process.env.MQTT_PASS
};
const mqttClient = mqtt.connect(process.env.MQTT_BROKER, mqttOptions);

mqttClient.on('connect', () => {
    console.log("Terhubung ke MQTT Broker HiveMQ");
    mqttClient.subscribe(process.env.MQTT_TOPIC);
});

mqttClient.on('message', async (topic, message) => {
    try {
        const dataSensor = JSON.parse(message.toString());
        console.log(`Menerima Data: Gas=${dataSensor.gas_value}, Status=${dataSensor.status}`);

        // Simpan data ke MongoDB
        const newRecord = new GasModel({
            gas_value: dataSensor.gas_value,
            status: dataSensor.status,
            kipas_aktif: dataSensor.kipas_aktif
        });
        await newRecord.save();

        // Update data ke Blynk
        const fanStatus = dataSensor.kipas_aktif ? 1 : 0;
        const blynkUrl = `${process.env.BLYNK_HOST}/external/api/batch/update?token=${process.env.BLYNK_AUTH_TOKEN}&V1=${dataSensor.gas_value}&V2=${dataSensor.status}&V3=${fanStatus}`;
        await axios.get(blynkUrl).catch(() => {}); 

        // Logika pengiriman peringatan Telegram
        if (dataSensor.status === "BAHAYA KEBOCORAN!" && !isAlertSent) {
            const pesanBahaya = `*PERINGATAN BAHAYA GAS!*\n\nSistem mendeteksi adanya kebocoran gas LPG!\n*Level Gas:* ${dataSensor.gas_value} ppm\n*Tindakan:* Kipas Exhaust dan Alarm telah diaktifkan secara otomatis.\n\n_Segera periksa area dapur Anda!_`;
            
            bot.telegram.sendMessage(process.env.TELEGRAM_CHAT_ID, pesanBahaya, { parse_mode: "Markdown" })
                .catch(err => console.error("Gagal kirim Telegram:", err.message));
            isAlertSent = true; 
        } 
        else if (dataSensor.status === "AMAN" && isAlertSent) {
            const pesanAman = `*KONDISI TELAH AMAN*\n\nKebocoran gas telah tertangani.\n*Level Gas Terkini:* ${dataSensor.gas_value} ppm\n*Tindakan:* Kipas Exhaust dan Alarm telah dimatikan.\n\n_Sistem kembali ke mode pemantauan normal._`;
            
            bot.telegram.sendMessage(process.env.TELEGRAM_CHAT_ID, pesanAman, { parse_mode: "Markdown" })
                .catch(err => console.error("Gagal kirim Telegram:", err.message));
            isAlertSent = false; 
        }

    } catch (error) {
        console.error("Error saat memproses pesan MQTT:", error.message);
    }
});

// Handle agar bot tidak error saat dimatikan (Graceful stop)
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

// ==========================================
// 4. JALANKAN SERVER
// ==========================================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server Backend GasGuards berjalan di port ${PORT}`);
});