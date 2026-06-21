#include <WiFi.h>
#include <WiFiClientSecure.h> 
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <DHT.h>

const char* ssid = "INFO";
const char* password = "*************";
const char* mqtt_server = "*************";
const int mqtt_port = 8883; 
const char* mqtt_user = "siberbot88"; 
const char* mqtt_pass = "***********";
const char* mqtt_topic = "smartvillage/gasguards/sensor";

WiFiClientSecure espClient;
PubSubClient client(espClient);

const int mq5Pin = 34;
const int relayAndRedLedPin = 26; 
const int buzzerPin = 25;
const int ledHijauPin = 23;
const int dhtPin = 15;

#define DHTTYPE DHT11
DHT dht(dhtPin, DHTTYPE);

// Batas Toleransi untuk Demo
const int thresholdGas = 500; 
const float thresholdSuhu = 33.0; 

unsigned long lastReadFast = 0;
unsigned long lastReadSlow = 0;

int gasValue = 0;
float globalSuhu = 0.0;
float globalLembap = 0.0;

String statusRuangan = "AMAN";
bool isBahaya = false;

void setup_wifi() {
  Serial.print("Menghubungkan ke WiFi: ");
  Serial.println(ssid);
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi Terhubung");
}

void setup() {
  Serial.begin(115200);
  
  pinMode(relayAndRedLedPin, OUTPUT);
  pinMode(buzzerPin, OUTPUT);
  pinMode(ledHijauPin, OUTPUT);
  
  digitalWrite(relayAndRedLedPin, HIGH); 
  digitalWrite(buzzerPin, LOW);
  digitalWrite(ledHijauPin, HIGH);

  dht.begin();

  setup_wifi();
  espClient.setInsecure(); 
  client.setServer(mqtt_server, mqtt_port);
}

void loop() {
  if (WiFi.status() == WL_CONNECTED && !client.connected()) {
    String clientId = "GasGuards-" + String(random(0xffff), HEX);
    client.connect(clientId.c_str(), mqtt_user, mqtt_pass);
  }
  client.loop(); 

  unsigned long now = millis();

  // 1. PEMBACAAN DHT11 & KIRIM CLOUD (Tiap 2 Detik karena DHT11 lambat)
  if (now - lastReadSlow > 2000) {
    lastReadSlow = now;

    globalSuhu = dht.readTemperature();
    globalLembap = dht.readHumidity();

    if (isnan(globalSuhu) || isnan(globalLembap)) {
      globalSuhu = 0.0;
      globalLembap = 0.0;
    }
    
    Serial.printf("Gas: %d | Suhu: %.1f C | Lembap: %.1f %% | Status: %s\n", gasValue, globalSuhu, globalLembap, statusRuangan.c_str());

    if (client.connected()) {
      StaticJsonDocument<256> doc;
      doc["gas_value"] = gasValue;
      doc["status"] = statusRuangan;
      doc["kipas_aktif"] = isBahaya;
      doc["temperature"] = globalSuhu;        
      doc["humidity"] = globalLembap;     
      
      char jsonBuffer[256];
      serializeJson(doc, jsonBuffer);
      client.publish(mqtt_topic, jsonBuffer);
    }
  }

  // 2. KONTROL ALARM LOKAL (Tiap 0.5 Detik untuk respon sangat cepat)
  if (now - lastReadFast > 500) {
    lastReadFast = now;
    gasValue = analogRead(mq5Pin);

    // Prioritas 1: Gas Bocor
    if (gasValue > thresholdGas) {
      statusRuangan = "BAHAYA KEBOCORAN!";
      isBahaya = true;
    } 
    // Prioritas 2: Potensi Kebakaran (Suhu Panas)
    else if (globalSuhu >= thresholdSuhu) {
      statusRuangan = "POTENSI KEBAKARAN!";
      isBahaya = true;
    } 
    // Kondisi Normal
    else {
      statusRuangan = "AMAN";
      isBahaya = false;
    }

    // Eksekusi Hardware
    if (isBahaya) {
      digitalWrite(relayAndRedLedPin, LOW);   
      digitalWrite(buzzerPin, HIGH); 
      digitalWrite(ledHijauPin, LOW);
    } else {
      digitalWrite(relayAndRedLedPin, HIGH); 
      digitalWrite(buzzerPin, LOW);  
      digitalWrite(ledHijauPin, HIGH);
    }
  }
}