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

O status volta em `<SEU_PREFIXO>/portas/N/status` (`aberta` / `trancada`, retained).

## Correspondência simulação ↔ hardware real

| Simulação (Wokwi)            | Hardware real                                  |
|------------------------------|------------------------------------------------|
| `wokwi-relay-module` ×3      | Módulo relé 4 canais (canais 1–3), ativo-baixo |
| VIN (5 V) alimentando VCC    | LM2596 em 5 V → JD-VCC (jumper removido)       |
| VIN → COM                    | Barramento +12 V → COM                         |
| LED no NC                    | Eletroímã 12 V no NC (+ diodo 1N4007)          |
| `Wokwi-GUEST`                | Seu Wi-Fi 2,4 GHz                              |

O sketch é o mesmo para os dois mundos (`RELAY_ACTIVE_LOW true` vale para o
módulo real e para o relé padrão do Wokwi). Na placa real, ajuste apenas
`WIFI_SSID`, `WIFI_PASS` e, se quiser, o broker.

**Não simulado:** LM2596 (ajuste do trimpot em 5,0 V continua sendo passo
manual com multímetro), diodos flyback, a parte de potência 12 V e o
**display TFT 4" SPI** da porta do armário (pinos 23/18/15/2/4, lib
TFT_eSPI/LovyanGFX — por isso os relés usam GPIO 22/21/16).
