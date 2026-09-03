# Simulação Wokwi — Controle de acesso (3 portas)

Simula o firmware real do sistema: ESP32 recebe comando MQTT e destranca a
porta por 3 segundos via relé. O eletroímã de cada porta é representado por
um **LED vermelho ligado no contato NC**:

- **LED aceso** = corrente passando pelo NC = ímã energizado = **porta trancada**
- **LED apagado por 3 s** = relé puxou, NC abriu = **porta destrancada**

## Como rodar

1. Acesse **wokwi.com** → *New Project* → **ESP32** (Arduino).
2. Substitua o conteúdo de `sketch.ino` e `diagram.json` pelos arquivos desta pasta.
3. Na aba *Library Manager* (ou arquivo `libraries.txt`), adicione **PubSubClient**.
4. **Troque o `MQTT_PREFIX`** no sketch por um valor único seu — o broker
   `broker.hivemq.com` é público e compartilhado.
5. Play ▶. O monitor serial mostra a conexão Wi-Fi (rede virtual `Wokwi-GUEST`)
   e a inscrição no tópico.

## Como abrir uma porta

Publique em qualquer cliente MQTT (ex.: [HiveMQ Web Client](https://www.hivemq.com/demos/websocket-client/),
host `broker.hivemq.com`, porta 8884 WSS):

```
tópico:  <SEU_PREFIXO>/portas/1/abrir      (ou 2, 3)
payload: vazio  — ou um número em ms (500–30000) p/ tempo customizado
```

O status volta em `<SEU_PREFIXO>/portas/N/status` (`aberta` / `trancada`, retained)
e a rede em uso em `<SEU_PREFIXO>/sistema/rede` (`wifi`, `4g-reserva`, `4g`, `4g+hotspot`).

## As variantes da montagem (flags no topo do sketch)

```cpp
#define HAS_TFT     0        // 1 = tela TFT 4" SPI (lib TFT_eSPI, pinos 23/18/15/2/4)
#define NET_MODE    NET_WIFI // NET_WIFI · NET_DUAL (Wi-Fi + 4G reserva) · NET_LTE (só 4G)
#define LTE_HOTSPOT 0        // 1 = ESP32 emite Wi-Fi "Acesso-Armario" e repassa p/ o 4G (só com NET_LTE)
```

A página gera essas três linhas na "Ficha da configuração". No Wokwi use
`HAS_TFT 0` e `NET_MODE NET_WIFI` — a tela e o modem não são simulados.

| Modo | O que a ESP32 faz |
|---|---|
| `NET_WIFI` | Conecta no Wi-Fi da casa (montagem original). |
| `NET_DUAL` | Wi-Fi da casa; 30 s sem Wi-Fi → liga o A7672SA, sobe PPP e reconecta o MQTT pelo 4G. Wi-Fi voltou → desliga o modem. |
| `NET_LTE` | Nem procura Wi-Fi: PPP no boot, MQTT 100 % pelo chip. |
| `NET_LTE` + `LTE_HOTSPOT` | Idem, mais SoftAP WPA2 com NAT para o 4G e a página `http://192.168.4.1` com botões para abrir as portas na rede local. |

Os modos 4G usam `PPP.h` do **core arduino-esp32 3.x** (perfil `PPP_MODEM_SIM7600`,
compatível em AT com o A7672SA) — não compilam no core 2.x. Antes do firmware
completo, grave `firmware/teste_at_modem/teste_at_modem.ino` e confirme
`AT` → `OK`, `AT+CPIN?`, `AT+CSQ`, `AT+CREG?` no monitor serial.

## Correspondência simulação ↔ hardware real

| Simulação (Wokwi)            | Hardware real                                  |
|------------------------------|------------------------------------------------|
| `wokwi-relay-module` ×3      | Módulo relé 4 canais (canais 1–3), ativo-baixo |
| VIN (5 V) alimentando VCC    | LM2596 em 5 V → JD-VCC (jumper removido)       |
| VIN → COM                    | Barramento +12 V → COM                         |
| LED no NC                    | Eletroímã 12 V no NC (+ diodo 1N4007)          |
| `Wokwi-GUEST`                | Seu Wi-Fi 2,4 GHz                              |

O sketch é o mesmo para os dois mundos (`RELAY_ACTIVE_LOW true` vale para o
módulo real e para o relé padrão do Wokwi). Na placa real, ajuste
`WIFI_SSID`, `WIFI_PASS`, as flags da montagem e, se quiser, o broker.

**Não simulado:** LM2596 (ajuste do trimpot em 5,0 V continua sendo passo
manual com multímetro), diodos flyback, a parte de potência 12 V, o
**display TFT 4" SPI** (pinos 23/18/15/2/4 — por isso os relés usam GPIO
22/21/16) e o **modem A7672SA** (UART1 em GPIO 26/27 + PWRKEY 25 + RST 33,
fonte 5 V/2 A própria).
