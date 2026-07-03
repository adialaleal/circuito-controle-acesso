# Circuito — Controle de Acesso (3 portas)

Esquema elétrico interativo (2D + montagem 3D) de um sistema de controle de
acesso com ESP32, módulo relé de 4 canais e 3 eletroímãs 12V, acionado via
MQTT.

**Ver online:** https://adialaleal.github.io/circuito-controle-acesso/

## Conteúdo
- `index.html` — esquema 2D interativo (hover pino a pino) + montagem 3D
- Firmware e simulação Wokwi: pasta `wokwi/`

## Stack do circuito
ESP32 NodeMCU · módulo relé 4 canais (ativo-baixo) · LM2596 (12V→5V) ·
3× eletroímã 12V + diodo 1N4007 (flyback) · fonte 12V/2A
