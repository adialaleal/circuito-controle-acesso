/*
 * Teste do modem A7672SA — ponte serial (passthrough)
 *
 * Grave este sketch antes do firmware de verdade. Ele só liga o modem pelo
 * PWRKEY e repassa o que você digita no monitor serial para a UART1 (e
 * vice-versa). Configure o monitor em 115200 com "Both NL & CR".
 *
 *   AT          -> OK           (fiação e nível lógico ok)
 *   AT+CPIN?    -> +CPIN: READY (chip reconhecido)
 *   AT+CSQ      -> +CSQ: 18,99  (sinal: 10–31 é bom; 99 = sem sinal)
 *   AT+CREG?    -> +CREG: 0,1   (registrado na rede; 0,5 = roaming)
 *   AT+COPS?    -> operadora atual
 *
 * Pinagem igual à da página: TXD do modem -> GPIO26, RXD <- GPIO27,
 * PWRKEY <- GPIO25, RST <- GPIO33. Os relés ficam em HIGH (trancados).
 */

#define MODEM_RX     26
#define MODEM_TX     27
#define MODEM_PWRKEY 25
#define MODEM_RST    33

const uint8_t RELAY_PINS[3] = {22, 21, 16};

void setup() {
  for (uint8_t i = 0; i < 3; i++) { pinMode(RELAY_PINS[i], OUTPUT); digitalWrite(RELAY_PINS[i], HIGH); }

  Serial.begin(115200);
  Serial1.begin(115200, SERIAL_8N1, MODEM_RX, MODEM_TX);

  pinMode(MODEM_RST, OUTPUT);    digitalWrite(MODEM_RST, HIGH);
  pinMode(MODEM_PWRKEY, OUTPUT);
  digitalWrite(MODEM_PWRKEY, HIGH); delay(100);
  digitalWrite(MODEM_PWRKEY, LOW);  delay(1000);
  digitalWrite(MODEM_PWRKEY, HIGH);

  Serial.println("Ponte serial pronta. Digite AT (115200, Both NL & CR). O modem leva ~10s para responder.");
}

void loop() {
  while (Serial.available())  Serial1.write(Serial.read());
  while (Serial1.available()) Serial.write(Serial1.read());
}
