require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const mqtt = require('mqtt');
const axios = require('axios');
const cors = require('cors');
const { Telegraf } = require('telegraf');

const app = express();
app.use(express.json());
app.use(cors());

mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log("Terhubung ke MongoDB"))
    .catch((err) => console.error("Gagal terhubung ke MongoDB:", err.message));

const GasSchema = new mongoose.Schema({
    gas_value: Number,
    status: String,
    kipas_aktif: Boolean,
    temperature: Number,
    humidity: Number,
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

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
let isAlertSent = false; 

bot.start((ctx) => {
    const pesan = `Halo ${ctx.from.first_name}!\n\nSistem GasGuards telah aktif.\nKetik /help untuk panduan.`;
    ctx.reply(pesan, { parse_mode: "Markdown" });
});

bot.help((ctx) => {
    const pesan = `*PANDUAN SISTEM*\nSistem ini memantau Kebocoran Gas LPG dan Potensi Kebakaran dari suhu ruangan. Kipas akan otomatis menyala jika mendeteksi bahaya.`;
    ctx.reply(pesan, { parse_mode: "Markdown" });
});

bot.launch();
console.log("Bot Telegram aktif!");

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
        const data = JSON.parse(message.toString());
        console.log(`Data: Gas=${data.gas_value}, Suhu=${data.temperature}C, Lembap=${data.humidity}%, Status=${data.status}`);

        const newRecord = new GasModel({
            gas_value: data.gas_value,
            status: data.status,
            kipas_aktif: data.kipas_aktif,
            temperature: data.temperature,
            humidity: data.humidity
        });
        await newRecord.save();

        const fanStatus = data.kipas_aktif ? 1 : 0;
        const blynkUrl = `${process.env.BLYNK_HOST}/external/api/batch/update?token=${process.env.BLYNK_AUTH_TOKEN}&V1=${data.gas_value}&V2=${data.status}&V3=${fanStatus}&V4=${data.temperature}&V5=${data.humidity}`;
        await axios.get(blynkUrl).catch(() => {}); 

        // Logika Telegram Dinamis untuk 2 Jenis Bahaya
        if ((data.status === "BAHAYA KEBOCORAN!" || data.status === "POTENSI KEBAKARAN!") && !isAlertSent) {
            
            const jenisBahaya = data.status === "BAHAYA KEBOCORAN!" ? "Kebocoran Gas LPG" : "Potensi Kebakaran (Suhu Ekstrem)";
            const pesanBahaya = `*PERINGATAN DARURAT!*\n\nSistem mendeteksi adanya *${jenisBahaya}* di area dapur!\n\n*Detail Sensor Terkini:*\n- Level Gas: ${data.gas_value} ppm\n- Suhu Ruangan: ${data.temperature} °C\n- Kelembapan: ${data.humidity} %\n\n*Tindakan:* Kipas Exhaust dan Alarm aktif.\n\n_Segera periksa lokasi untuk menghindari insiden!_`;
            
            bot.telegram.sendMessage(process.env.TELEGRAM_CHAT_ID, pesanBahaya, { parse_mode: "Markdown" })
                .catch(err => console.error("Gagal kirim Telegram:", err.message));
            isAlertSent = true; 
        } 
        else if (data.status === "AMAN" && isAlertSent) {
            const pesanAman = `*KONDISI TELAH AMAN*\n\nSituasi telah terkendali.\n\n*Detail Sensor Terkini:*\n- Level Gas: ${data.gas_value} ppm\n- Suhu Ruangan: ${data.temperature} °C\n\n*Tindakan:* Kipas dan Alarm dimatikan.\n\n_Sistem kembali ke mode normal._`;
            
            bot.telegram.sendMessage(process.env.TELEGRAM_CHAT_ID, pesanAman, { parse_mode: "Markdown" })
                .catch(err => console.error("Gagal kirim Telegram:", err.message));
            isAlertSent = false; 
        }

    } catch (error) {
        console.error("Error proses MQTT:", error.message);
    }
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server Backend berjalan di port ${PORT}`);
});