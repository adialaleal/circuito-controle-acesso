# Esquema guiado e layout livre

## Objetivo

Fazer com que o esquema 2D seja compreensível antes de ser completo. A pessoa
deve conseguir montar a alimentação, a lógica e as travas em sequência, sem
precisar seguir fios que cruzam toda a tela. Depois, deve poder consultar o
circuito inteiro ou reorganizar visualmente os módulos sem mudar a topologia
elétrica.

## Escopo

O arquivo `index.html` ganhará três modos dentro da aba de esquema 2D:

1. **Montagem guiada** (padrão): quatro etapas, com avançar, voltar e acesso
   direto a cada etapa.
2. **Circuito completo**: todos os componentes em colunas funcionais.
3. **Organizar layout**: o mesmo circuito completo com componentes arrastáveis
   em uma grade e fios que acompanham as conexões.

Os modos respeitarão as opções atuais de tela, conectividade e alimentação,
inclusive a variante `power=xl4016`.

## Montagem guiada

As etapas são cumulativas: cada nova etapa conserva as conexões já explicadas.
Componentes e fios fora da etapa ficam escondidos, e não apenas esmaecidos.

| Etapa | Mostra | Resultado que a pessoa deve entender |
| --- | --- | --- |
| 1. Entrada 12 V | Fonte, P4, Wagos +12 V/GND e alimentação dos contatos COM | A fonte alimenta os barramentos e as fechaduras; a lógica ainda não está ligada. |
| 2. 5 V regulados | XL4016, Wagos +5 V/GND, capacitor e distribuição para ESP32, relé e modem | Há um único conversor 12 V para 5 V e um par de saída que se divide nos Wagos. |
| 3. Controle e rede | ESP32, modem opcional, UART/PWRKEY/RST, 3V3 e sinais IN1–IN3 | A ESP32 comanda o relé e conversa por fio com o modem. |
| 4. Travas | Relé, contatos NC, diodos e as três fechaduras | Cada canal corta o 12 V do respectivo eletroímã para destravar. |

O painel lateral informará o objetivo da etapa e terá ação "Próxima conexão".
No último passo, a ação leva ao circuito completo.

## Circuito completo

A organização fixa usará três zonas com títulos claros:

```
ENERGIA                    CONTROLE                         SAÍDAS
fonte → P4 → Wagos         ESP32 ↔ modem                    relé → trava 1
        ↓ XL4016                   ↓                         relé → trava 2
        Wagos 5 V                  sinais                    relé → trava 3
```

Os barramentos de +12 V, GND e +5 V serão curtos, horizontais e limitados à
zona que alimentam. As conexões entre zonas terão rótulos de rede e não um
único fio atravessando componentes. Hover e clique continuam destacando a
rede completa e o inspetor continua sendo a fonte de pinagem.

## Organizar layout

O botão "Organizar layout" só aparece no modo de circuito completo. Ao ativá-
lo, os módulos passam a ter alça de arraste, grade visível e botão para
restaurar a disposição de referência.

- O arraste move somente grupos de componentes, nunca fios isolados.
- Cada componente tem âncoras nomeadas; o roteador refaz fios ortogonais entre
  as âncoras quando o componente é solto.
- O roteador preserva cor, rótulo e pertencimento da rede; não inventa ou
  remove conexões elétricas.
- As posições são salvas em `localStorage`, por variante de configuração.
- "Restaurar layout" remove apenas as posições salvas daquele esquema.
- Em telas touch, arrastar exige segurar na alça; tocar no corpo mantém o
  comportamento de inspeção atual.

O editor é uma ferramenta de leitura e organização; não exporta netlist nem
altera o firmware ou as ligações descritas pela tabela pino a pino.

## Acessibilidade e estados

- Modos e etapas serão botões com `aria-pressed` e foco por teclado.
- O estado poderá ser compartilhado no hash: `view=guided|full` e `step=1..4`.
  As posições locais não entram no link compartilhável.
- Alterar rede, tela ou alimentação sai do editor e restaura o layout de
  referência da variante selecionada para evitar posições incompatíveis.
- Sem JavaScript, permanece visível o circuito completo estático.

## Verificação

1. Validar sintaxe JavaScript extraída do HTML e `git diff --check`.
2. Para Wi-Fi, 4G com 2x LM2596 e 4G com XL4016, conferir que cada etapa só
   mostra itens aplicáveis à variante.
3. Conferir visualmente que o passo 2 mostra o par XL4016 → Wagos → ESP32,
   relé e modem com continuidade explícita.
4. No modo completo, conferir que não há fio cruzando o corpo de um
   componente sem conexão.
5. Arrastar ESP32, modem e relé; confirmar que cada fio conectado termina nas
   âncoras atualizadas, restaurar o layout e recarregar a página para verificar
   a persistência local.
6. Testar toque: toque no corpo abre o inspetor; arraste pela alça move o
   módulo.

## Fora de escopo

- Alterar a topologia elétrica, os pinos ou o firmware.
- Permitir edição de fios ou criação de novas conexões.
- Substituir a lista de ligações como fonte de montagem.
