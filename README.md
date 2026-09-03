# Circuito — Controle de Acesso (3 portas)

Esquema elétrico interativo (2D + montagem 3D) de um sistema de controle de
acesso com ESP32, módulo relé de 4 canais, 3 eletroímãs 12V e display TFT 4"
de status, acionado via MQTT. A montagem 3D reproduz o armário-vitrine real
(1,00 m × 50 × 50 cm): 2 portas de acrílico + gaveta com rodinhas travadas por
eletroímã e equipamentos atrás da porta branca — clique nas portas para
abrir/fechar.

**Ver online:** https://adialaleal.github.io/circuito-controle-acesso/

## Conteúdo
- `index.html` — esquema 2D interativo (hover pino a pino) + montagem 3D
- Firmware e simulação Wokwi: pasta `wokwi/`

## Stack do circuito
ESP32 NodeMCU · módulo relé 4 canais (ativo-baixo) · LM2596 (12V→5V) ·
3× eletroímã 12V + diodo 1N4007 (flyback) · display TFT 4.0" SPI
(ST7796S/ILI9488, 480×320) · fonte 12V/3A
