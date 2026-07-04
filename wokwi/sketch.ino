/*
 * Controle de acesso — 3 portas com eletroímã
 * ESP32 NodeMCU (DevKit V1) + módulo relé 4 canais + MQTT
 *
 * Lógica: portas TRANCADAS por padrão (ímã no contato NC, bobina em repouso).
 * Comando MQTT em portas/N/abrir energiza o relé N por UNLOCK_MS,
 * cortando o +12V do ímã (NC abre) e destrancando a porta.
 *
 * O mesmo sketch roda no Wokwi (simulação) e na placa real:
 * troque apenas WIFI_SSID / WIFI_PASS / MQTT_PREFIX.
 */

#include <WiFi.h>
#include <PubSubClient.h>

/* ---------------- CONFIG ---------------- */
#define RELAY_ACTIVE_LOW true          // módulo real E módulo padrão do Wokwi: true

const char* WIFI_SSID  = "Wokwi-GUEST";      // na placa real: seu Wi-Fi
const char* WIFI_PASS  = "";

const char* MQTT_HOST  = "broker.hivemq.com"; // broker público p/ teste
const uint16_t MQTT_PORT = 1883;

// Broker público: TROQUE este prefixo por algo único seu,
// senão qualquer pessoa no mesmo broker abre suas portas.
const char* MQTT_PREFIX = "tatoh-lucas-x7k2";

const uint32_t UNLOCK_MS = 3000;              // tempo de porta destrancada

// GPIO22=P1 (vitrine sup.), GPIO21=P2 (vitrine meio), GPIO16=P3 (gaveta).
// Os pinos SPI 23/18/15/2/4 ficam reservados para o display TFT 4" da porta
// (não simulado no Wokwi — na placa real, use TFT_eSPI ou LovyanGFX).
const uint8_t  RELAY_PINS[3] = {22, 21, 16};
/* ----------------------------------------- */

WiFiClient   net;
PubSubClient mqtt(net);
uint32_t unlockUntil[3] = {0, 0, 0};
char topicCmd[64], topicStatus[3][64];

inline void relayWrite(uint8_t idx, bool energize) {
  bool level = RELAY_ACTIVE_LOW ? !energize : energize; // energizado = LOW
  digitalWrite(RELAY_PINS[idx], level ? HIGH : LOW);
}

void publishStatus(uint8_t idx, const char* st) {
  mqtt.publish(topicStatus[idx], st, true);
  Serial.printf("[porta %d] %s\n", idx + 1, st);
}

void openDoor(uint8_t idx, uint32_t ms) {
  relayWrite(idx, true);                 // relé puxa -> NC abre -> ímã solta
  unlockUntil[idx] = millis() + ms;
  publishStatus(idx, "aberta");
}

void onMqtt(char* topic, byte* payload, unsigned int len) {
  // topico: <prefixo>/portas/N/abrir
  const char* p = strstr(topic, "/portas/");
  if (!p) return;
  int n = atoi(p + 8);
  if (n < 1 || n > 3) return;

  uint32_t ms = UNLOCK_MS;
  if (len > 0 && len < 8) {              // payload opcional: duração em ms
    char buf[8] = {0};
    memcpy(buf, payload, len);
    long v = atol(buf);
    if (v >= 500 && v <= 30000) ms = (uint32_t)v;
  }
  openDoor((uint8_t)(n - 1), ms);
}

void connectMqtt() {
  while (!mqtt.connected()) {
    char cid[32];
    snprintf(cid, sizeof(cid), "fechaduras-%04X", (uint16_t)esp_random());
    Serial.printf("MQTT conectando como %s... ", cid);
    if (mqtt.connect(cid)) {
      Serial.println("ok");
      mqtt.subscribe(topicCmd);
      for (uint8_t i = 0; i < 3; i++) publishStatus(i, "trancada");
    } else {
      Serial.printf("falhou rc=%d, retry 2s\n", mqtt.state());
      delay(2000);
    }
  }
}

void setup() {
  // PRIMEIRA coisa: garantir tudo trancado antes de qualquer rede
  for (uint8_t i = 0; i < 3; i++) {
    pinMode(RELAY_PINS[i], OUTPUT);
    relayWrite(i, false);                // repouso -> NC fechado -> trancada
  }

  Serial.begin(115200);
  snprintf(topicCmd, sizeof(topicCmd), "%s/portas/+/abrir", MQTT_PREFIX);
  for (uint8_t i = 0; i < 3; i++)
    snprintf(topicStatus[i], sizeof(topicStatus[i]), "%s/portas/%d/status", MQTT_PREFIX, i + 1);

  Serial.printf("\nWi-Fi: %s ", WIFI_SSID);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  while (WiFi.status() != WL_CONNECTED) { delay(300); Serial.print("."); }
  Serial.printf("\nIP: %s\n", WiFi.localIP().toString().c_str());

  mqtt.setServer(MQTT_HOST, MQTT_PORT);
  mqtt.setCallback(onMqtt);
  Serial.printf("Comando: publique em  %s/portas/1/abrir  (payload vazio ou ms)\n", MQTT_PREFIX);
}

void loop() {
  if (!mqtt.connected()) connectMqtt();
  mqtt.loop();

  // retrancamento não-bloqueante (portas independentes)
  uint32_t now = millis();
  for (uint8_t i = 0; i < 3; i++) {
    if (unlockUntil[i] && (int32_t)(now - unlockUntil[i]) >= 0) {
      unlockUntil[i] = 0;
      relayWrite(i, false);              // solta relé -> NC fecha -> ímã prende
      publishStatus(i, "trancada");
    }
  }
}
