# Continuidade do XL4016 e canvas em largura total

## Objetivo

Corrigir a leitura do conversor XL4016 na variante 4G e liberar largura para
o esquema 2D, sem mudar a topologia elétrica ou o editor de layout.

## Alterações

1. A saída do XL4016 terá dois fios visivelmente contínuos até os Wagos:
   `OUT+ → Wago +5V` e `OUT− → Wago GND`. Os dois fios devem terminar nos
   terminais desenhados, com ponto de junção visível; os ramos para ESP32,
   relé e modem continuam saindo dos Wagos.
2. O inspetor deixa de ocupar a coluna lateral. Ele fica acima do esquema em
   uma faixa horizontal, seguido da ficha de configuração e das redes. O
   canvas passa a usar toda a largura da página abaixo dessa faixa.

## Restrições

- Não alterar pinos, componentes, tabelas de ligação, firmware ou a
  topologia elétrica.
- Preservar os modos guiado, completo e organizar layout.
- No modo guiado da etapa 2 com XL4016, os dois fios XL4016→Wago e os Wagos
  precisam aparecer junto com seus destinos válidos.
- O inspetor deve continuar receber foco/hover/click e permanecer utilizável
  em telas estreitas.

## Aceite

- Em `net=lte&power=xl4016`, cada saída OUT do XL4016 toca visualmente o
  respectivo Wago, sem espaço entre fio e terminal.
- O esquema 2D ocupa a largura total disponível no desktop; não há coluna
  lateral vazia.
- Em iPad/celular, o painel superior empilha sem cobrir os controles ou o
  canvas rolável.
- `node --test tests/schematic-layout.test.mjs`, extração/sintaxe do script e
  `git diff --check` passam.
