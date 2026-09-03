/*
 * Controle de acesso — 3 portas com eletroímã
 * ESP32 NodeMCU (DevKit V1) + módulo relé 4 canais + MQTT
 * Opcionais: tela TFT 4" SPI · modem 4G A7672SA · hotspot da própria ESP32
 *
 * Lógica: portas TRANCADAS por padrão (ímã no contato NC, bobina em repouso).
 * Comando MQTT em portas/N/abrir energiza o relé N por UNLOCK_MS,
 * cortando o +12V do ímã (NC abre) e destrancando a porta.
 *
 * O mesmo sketch roda no Wokwi (HAS_TFT 0 · NET_MODE NET_WIFI) e na placa
 * real. A página "Configuração da montagem" gera as três linhas abaixo
 * prontas para copiar.
 */

/* ============ CONFIGURAÇÃO DA MONTAGEM ============ */
#define NET_WIFI 0          // Wi-Fi da casa (montagem original)
#define NET_DUAL 1          // Wi-Fi da casa + 4G como reserva
#define NET_LTE  2          // só 4G (A7672SA), sem Wi-Fi da casa

#ifndef HAS_TFT
#define HAS_TFT     0       // 1 = tela TFT 4" SPI na porta branca
#endif
#ifndef NET_MODE
#define NET_MODE    NET_WIFI
#endif
#ifndef LTE_HOTSPOT
#define LTE_HOTSPOT 0       // 1 = ESP32 emite Wi-Fi e repassa p/ o 4G (só com NET_LTE)
#endif
/* ================================================== */

#if LTE_HOTSPOT && NET_MODE != NET_LTE
  #error "LTE_HOTSPOT so faz sentido com NET_MODE NET_LTE"
#endif

#include <WiFi.h>
#include <PubSubClient.h>

#if NET_MODE != NET_WIFI
  #if !defined(ESP_ARDUINO_VERSION_MAJOR) || ESP_ARDUINO_VERSION_MAJOR < 3
    #error "Os modos 4G usam PPP.h: instale o core arduino-esp32 3.x ou superior"
  #endif
  #include <PPP.h>          // pilha PPP do core 3.x (o A7672SA e' AT-compativel com o SIM7600)
#endif
#if LTE_HOTSPOT
  #include <WebServer.h>    // pagina local http://192.168.4.1 para abrir as portas na LAN
#endif
#if HAS_TFT
  #include <TFT_eSPI.h>     // User_Setup.h: ST7796 (ou ILI9488) · MOSI 23 · SCLK 18 · CS 15 · DC 2 · RST 4
#endif

/* ---------------- CONFIG ---------------- */
#define RELAY_ACTIVE_LOW true           // módulo real E módulo padrão do Wokwi: true

const char* WIFI_SSID  = "Wokwi-GUEST";       // na placa real: seu Wi-Fi 2,4GHz
const char* WIFI_PASS  = "";

const char* AP_SSID    = "Acesso-Armario";    // hotspot da ESP32 (LTE_HOTSPOT)
const char* AP_PASS    = "abrir1234";         // WPA2 · mínimo 8 caracteres · TROQUE

const char* LTE_APN    = "internet";          // APN da operadora do chip (ex.: claro.com.br, zap.vivo.com.br, timbrasil.br)
const char* LTE_PIN    = "";                  // PIN do chip, se houver

const char* MQTT_HOST  = "broker.hivemq.com"; // broker público p/ teste
const uint16_t MQTT_PORT = 1883;

// Broker público: TROQUE este prefixo por algo único seu,
// senão qualquer pessoa no mesmo broker abre suas portas.
const char* MQTT_PREFIX = "tatoh-lucas-x7k2";

const uint32_t UNLOCK_MS   = 3000;            // tempo de porta destrancada
const uint32_t WIFI_GRACE  = 30000;           // NET_DUAL: segundos sem Wi-Fi antes de subir o 4G

// GPIO22=P1 (vitrine sup.), GPIO21=P2 (vitrine meio), GPIO16=P3 (gaveta).
// Os pinos SPI 23/18/15/2/4 ficam com o display (se houver).
const uint8_t  RELAY_PINS[3] = {22, 21, 16};

// Modem A7672SA na UART1 — 16/17 não servem: o 16 já é o IN3 do relé.
#define MODEM_RX     26   // ESP32 RX  <- TXD do modem
#define MODEM_TX     27   // ESP32 TX  -> RXD do modem
#define MODEM_PWRKEY 25
#define MODEM_RST    33
#define MODEM_BAUD   115200
/* ----------------------------------------- */

WiFiClient   net;          // no core 3.x é um NetworkClient: usa a interface padrão (Wi-Fi ou PPP)
PubSubClient mqtt(net);
uint32_t unlockUntil[3] = {0, 0, 0};
char topicCmd[64], topicStatus[3][64], topicNet[64];

/* ============ RELÉS / TRAVAS ============ */
inline void relayWrite(uint8_t idx, bool energize) {
  bool level = RELAY_ACTIVE_LOW ? !energize : energize; // energizado = LOW
  digitalWrite(RELAY_PINS[idx], level ? HIGH : LOW);
}

void tftDraw();  // definida mais abaixo (vazia sem HAS_TFT)

void publishStatus(uint8_t idx, const char* st) {
  if (mqtt.connected()) mqtt.publish(topicStatus[idx], st, true);
  Serial.printf("[porta %d] %s\n", idx + 1, st);
  tftDraw();
}

void openDoor(uint8_t idx, uint32_t ms) {
  relayWrite(idx, true);                 // relé puxa -> NC abre -> ímã solta
  unlockUntil[idx] = millis() + ms;
  publishStatus(idx, "aberta");
}

// Retrancamento não-bloqueante. Chamada no loop() E dentro das esperas de
// rede, para uma porta nunca ficar aberta enquanto o modem/Wi-Fi negocia.
void serviceLocks() {
  uint32_t now = millis();
  for (uint8_t i = 0; i < 3; i++) {
    if (unlockUntil[i] && (int32_t)(now - unlockUntil[i]) >= 0) {
      unlockUntil[i] = 0;
      relayWrite(i, false);              // solta relé -> NC fecha -> ímã prende
      publishStatus(i, "trancada");
    }
  }
}
void waitMs(uint32_t ms) {               // delay que continua cuidando das travas
  uint32_t t0 = millis();
  while (millis() - t0 < ms) { serviceLocks(); delay(20); }
}

/* ============ REDE ============ */
const char* linkName();
bool netReady();

#if NET_MODE != NET_WIFI
static bool lteUp = false;

void onNetEvent(arduino_event_id_t ev) {
  switch (ev) {
    case ARDUINO_EVENT_PPP_GOT_IP:
      lteUp = true;
      Serial.printf("[4G] IP %s\n", PPP.localIP().toString().c_str());
      #if LTE_HOTSPOT
      WiFi.AP.enableNAPT(true);          // NAT: clientes do hotspot saem pelo 4G
      #endif
      break;
    case ARDUINO_EVENT_PPP_LOST_IP:
    case ARDUINO_EVENT_PPP_DISCONNECTED:
      lteUp = false;
      Serial.println("[4G] link caiu");
      #if LTE_HOTSPOT
      WiFi.AP.enableNAPT(false);
      #endif
      break;
    default: break;
  }
}

void modemPowerOn() {
  pinMode(MODEM_RST, OUTPUT);    digitalWrite(MODEM_RST, HIGH);
  pinMode(MODEM_PWRKEY, OUTPUT);
  digitalWrite(MODEM_PWRKEY, HIGH); delay(100);
  digitalWrite(MODEM_PWRKEY, LOW);  delay(1000);  // pulso de ~1s (confira a polaridade do seu breakout)
  digitalWrite(MODEM_PWRKEY, HIGH);
}

bool lteBegin() {
  Serial.println("[4G] ligando o A7672SA...");
  modemPowerOn();
  PPP.setApn(LTE_APN);
  if (*LTE_PIN) PPP.setPin(LTE_PIN);
  PPP.setPins(MODEM_TX, MODEM_RX);                 // sem RTS/CTS
  if (!PPP.begin(PPP_MODEM_SIM7600, 1, MODEM_BAUD)) {
    Serial.println("[4G] modem nao respondeu (fiacao? 5V? PWRKEY?)");
    return false;
  }
  Serial.printf("[4G] %s · IMEI %s\n", PPP.moduleName().c_str(), PPP.IMEI().c_str());
  uint32_t t0 = millis();
  while (!PPP.attached() && millis() - t0 < 60000) { waitMs(500); Serial.print('.'); }
  if (!PPP.attached()) { Serial.println("\n[4G] sem rede: antena? chip? APN?"); PPP.end(); return false; }
  Serial.printf("\n[4G] %s · RSSI %d dBm\n", PPP.operatorName().c_str(), PPP.RSSI());
  PPP.mode(ESP_MODEM_MODE_CMUX);                   // dados e AT ao mesmo tempo
  if (!PPP.waitStatusBits(ESP_NETIF_CONNECTED_BIT, 15000)) {
    Serial.println("[4G] PPP nao conectou"); PPP.end(); return false;
  }
  return true;
}
void lteEnd() { PPP.end(); lteUp = false; Serial.println("[4G] desligado"); }
#endif

#if LTE_HOTSPOT
WebServer http(80);
void httpBegin() {
  http.on("/", []() {
    String h = F("<!doctype html><meta name=viewport content='width=device-width'>"
                 "<title>Acesso-Armario</title><body style='font-family:sans-serif;padding:24px'>"
                 "<h2>Controle de acesso</h2>");
    const char* nomes[3] = {"Porta 1 · vitrine superior", "Porta 2 · vitrine do meio", "Porta 3 · gaveta"};
    for (int i = 0; i < 3; i++)
      h += "<p><a href='/abrir?porta=" + String(i + 1) + "' style='display:block;padding:16px;background:#ffb224;color:#000;text-decoration:none;border-radius:8px'>Abrir " + nomes[i] + "</a></p>";
    h += "<p style='color:#888'>rede: "; h += linkName(); h += "</p></body>";
    http.send(200, "text/html", h);
  });
  http.on("/abrir", []() {
    int n = http.arg("porta").toInt();
    if (n < 1 || n > 3) { http.send(400, "text/plain", "porta 1..3"); return; }
    openDoor((uint8_t)(n - 1), UNLOCK_MS);
    http.sendHeader("Location", "/"); http.send(303);
  });
  http.begin();
}
#endif

void netBegin() {
#if NET_MODE != NET_WIFI
  Network.onEvent(onNetEvent);
#endif
#if NET_MODE == NET_LTE
  #if LTE_HOTSPOT
    WiFi.AP.begin();                             // igual ao exemplo PPP_WIFI_BRIDGE do core 3.x
    WiFi.AP.create(AP_SSID, AP_PASS);
    Serial.printf("Hotspot %s · http://%s\n", AP_SSID, WiFi.AP.localIP().toString().c_str());
    httpBegin();
  #else
    WiFi.mode(WIFI_OFF);
  #endif
  while (!lteBegin()) { Serial.println("[4G] nova tentativa em 10s"); waitMs(10000); }
#else
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  Serial.printf("Wi-Fi: %s ", WIFI_SSID);
  uint32_t t0 = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - t0 < 20000) { waitMs(300); Serial.print('.'); }
  if (WiFi.status() == WL_CONNECTED) Serial.printf("\nIP: %s\n", WiFi.localIP().toString().c_str());
  else {
    Serial.println("\nWi-Fi indisponivel");
    #if NET_MODE == NET_DUAL
    lteBegin();
    #endif
  }
#endif
}

void netLoop() {
#if NET_MODE == NET_DUAL
  static uint32_t wifiDownSince = 0, lastTry = 0;
  bool wifi = WiFi.status() == WL_CONNECTED;
  if (wifi) {
    wifiDownSince = 0;
    if (lteUp) { lteEnd(); mqtt.disconnect(); }   // volta ao Wi-Fi: reconecta o MQTT por ele
    return;
  }
  if (!wifiDownSince) wifiDownSince = millis();
  if (!lteUp && millis() - wifiDownSince > WIFI_GRACE && millis() - lastTry > 30000) {
    lastTry = millis();
    Serial.println("[rede] Wi-Fi caiu ha 30s — subindo o 4G de reserva");
    if (lteBegin()) mqtt.disconnect();            // força reconexão do MQTT pelo PPP
    WiFi.reconnect();
  }
#elif NET_MODE == NET_LTE
  static uint32_t lastTry = 0;
  if (!lteUp && millis() - lastTry > 30000) { lastTry = millis(); lteBegin(); }
#else
  static uint32_t lastTry = 0;
  if (WiFi.status() != WL_CONNECTED && millis() - lastTry > 10000) { lastTry = millis(); WiFi.reconnect(); }
#endif
#if LTE_HOTSPOT
  http.handleClient();
#endif
}

bool netReady() {
#if NET_MODE == NET_WIFI
  return WiFi.status() == WL_CONNECTED;
#elif NET_MODE == NET_DUAL
  return WiFi.status() == WL_CONNECTED || lteUp;
#else
  return lteUp;
#endif
}

const char* linkName() {
#if NET_MODE == NET_WIFI
  return WiFi.status() == WL_CONNECTED ? "wifi" : "sem-rede";
#elif NET_MODE == NET_DUAL
  if (WiFi.status() == WL_CONNECTED) return "wifi";
  return lteUp ? "4g-reserva" : "sem-rede";
#else
  #if LTE_HOTSPOT
  return lteUp ? "4g+hotspot" : "sem-rede";
  #else
  return lteUp ? "4g" : "sem-rede";
  #endif
#endif
}

/* ============ TELA TFT (opcional) ============ */
#if HAS_TFT
TFT_eSPI tft;
const char* DOOR_NAMES[3] = {"PORTA 1 - vitrine sup.", "PORTA 2 - vitrine meio", "PORTA 3 - gaveta"};
void tftBegin() {
  tft.init(); tft.setRotation(1); tft.fillScreen(TFT_BLACK);
  tft.setTextSize(2); tft.setTextColor(TFT_GREENYELLOW, TFT_BLACK);
  tft.drawString("CONTROLE DE ACESSO", 16, 12);
  tft.drawLine(16, 40, 464, 40, TFT_DARKGREY);
  tftDraw();
}
void tftDraw() {
  for (uint8_t i = 0; i < 3; i++) {
    bool open = unlockUntil[i] != 0;
    int y = 70 + i * 56;
    tft.setTextSize(2); tft.setTextColor(TFT_WHITE, TFT_BLACK);
    tft.drawString(DOOR_NAMES[i], 16, y);
    tft.fillCircle(440, y + 8, 10, open ? TFT_ORANGE : TFT_GREEN);
    tft.setTextColor(open ? TFT_ORANGE : TFT_GREEN, TFT_BLACK);
    tft.drawString(open ? "ABERTA  " : "TRANCADA", 300, y);
  }
  char st[64];
  snprintf(st, sizeof(st), "rede: %-12s MQTT: %s   ", linkName(), mqtt.connected() ? "ok" : "--");
  tft.setTextSize(1); tft.setTextColor(TFT_SKYBLUE, TFT_BLACK);
  tft.drawString(st, 16, 296);
}
#else
inline void tftBegin() {}
void tftDraw() {}
#endif

/* ============ MQTT ============ */
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

void connectMqtt() {                      // uma tentativa a cada 2s, sem travar o loop
  static uint32_t lastTry = 0;
  if (millis() - lastTry < 2000) return;
  lastTry = millis();
  char cid[32];
  snprintf(cid, sizeof(cid), "fechaduras-%04X", (uint16_t)esp_random());
  Serial.printf("MQTT (%s) conectando como %s... ", linkName(), cid);
  if (mqtt.connect(cid)) {
    Serial.println("ok");
    mqtt.subscribe(topicCmd);
    mqtt.publish(topicNet, linkName(), true);
    for (uint8_t i = 0; i < 3; i++) publishStatus(i, unlockUntil[i] ? "aberta" : "trancada");
  } else {
    Serial.printf("falhou rc=%d\n", mqtt.state());
  }
  tftDraw();
}

void setup() {
  // PRIMEIRA coisa: garantir tudo trancado antes de qualquer rede
  for (uint8_t i = 0; i < 3; i++) {
    pinMode(RELAY_PINS[i], OUTPUT);
    relayWrite(i, false);                // repouso -> NC fechado -> trancada
  }

  Serial.begin(115200);
  snprintf(topicCmd, sizeof(topicCmd), "%s/portas/+/abrir", MQTT_PREFIX);
  snprintf(topicNet, sizeof(topicNet), "%s/sistema/rede", MQTT_PREFIX);
  for (uint8_t i = 0; i < 3; i++)
    snprintf(topicStatus[i], sizeof(topicStatus[i]), "%s/portas/%d/status", MQTT_PREFIX, i + 1);

  tftBegin();
  netBegin();

  mqtt.setServer(MQTT_HOST, MQTT_PORT);
  mqtt.setCallback(onMqtt);
  Serial.printf("Comando: publique em  %s/portas/1/abrir  (payload vazio ou ms)\n", MQTT_PREFIX);
}

void loop() {
  netLoop();
  if (netReady()) {
    if (!mqtt.connected()) connectMqtt();
    mqtt.loop();
  }
  serviceLocks();                        // retrancamento não-bloqueante (portas independentes)
}
