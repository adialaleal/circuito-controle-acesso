# Circuito — Controle de Acesso (3 portas)

Esquema elétrico interativo (2D + montagem 3D) de um sistema de controle de
acesso com ESP32, módulo relé de 4 canais e 3 eletroímãs 12V, acionado via
MQTT. A montagem 3D reproduz o armário-vitrine real (1,00 m × 50 × 50 cm):
2 portas de acrílico + gaveta com rodinhas travadas por eletroímã e
equipamentos atrás da porta branca — clique nas portas para abrir/fechar.

**Ver online:** https://adialaleal.github.io/circuito-controle-acesso/

## Configuração da montagem
A página tem um configurador (logo abaixo das abas) que redesenha o esquema
2D, a cena 3D, a lista de compras, a tabela pino a pino e os textos:

| Opção | Valores |
|---|---|
| **Tela TFT 4"** | com tela · sem tela |
| **Rede** | Wi-Fi da casa · Wi-Fi + 4G de reserva · só 4G (modem SIMCom A7672SA) |
| **Hotspot da ESP32** | desligado · ligado (só no modo "só 4G": a ESP32 emite o SSID `Acesso-Armario` e repassa o tráfego pelo 4G via NAT) |

A escolha fica no link (`#tft=0&net=lte&ap=1`) para compartilhar, e a
"Ficha da configuração" na lateral mostra as três `#define` do firmware
prontas para copiar.

## Conteúdo
- `index.html` — esquema 2D interativo (hover pino a pino) + montagem 3D + lista de compras
- `wokwi/` — firmware (`sketch.ino`, o mesmo para simulação e placa real) e diagrama Wokwi
- `firmware/teste_at_modem/` — ponte serial para testar o A7672SA com comandos AT antes de tudo

## Stack do circuito
ESP32 NodeMCU · módulo relé 4 canais (ativo-baixo) · LM2596 (12V→5V) ·
3× eletroímã 12V + diodo 1N4007 (flyback) · fonte 12V/3A

Opcionais: display TFT 4.0" SPI (ST7796S/ILI9488, 480×320) · modem 4G LTE
Cat.1 SIMCom A7672SA (UART1 em GPIO 26/27, PWRKEY 25, RST 33) com LM2596
dedicado, capacitor 1000µF, antena FPC e fonte 12V/5A.
