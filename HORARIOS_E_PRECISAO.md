# Documentação técnica: horários e precisão

## Objetivo e escopo

Este documento descreve como o **Que Horas Passa** armazena, apresenta e calcula horários da linha C5 – Jardim União/Bela Vista. É um levantamento do comportamento implementado no repositório, destinado à análise técnica. Não certifica a exatidão da grade publicada pela operadora nem a pontualidade da operação dos ônibus.

## De onde vêm os horários

1. **Fonte normal:** a aplicação consulta `horarios` no Supabase por meio de `/api/horarios`. O registro utilizado pelo front-end contém `horario`, `dias`, `destino` e `embarque`. Os dados são administrados pela tela `/admin/`; salvar as alterações envia a lista para a API, que substitui os registros existentes.
2. **Contingência:** se a consulta falhar e ainda não houver horários carregados, o front-end usa a lista fixa `horariosFallback`, definida em `script.js`. Não é uma sincronização nem uma cópia atualizada do banco. Se a consulta for bem-sucedida e retornar uma lista vazia, a lista de contingência não é ativada.
3. **Precisão armazenada/apresentada:** os horários consumidos pela interface são reduzidos aos primeiros cinco caracteres do valor recebido do banco (`HH:mm`). O código não usa segundos para representar a partida. O esquema/tipo físico da coluna no Supabase não está definido neste repositório e deve ser confirmado diretamente no banco.

### Lista fixa de contingência atualmente no código

Os horários de saída abaixo são valores estáticos em `script.js` e estão associados a **Segunda a Sexta, Sábado e Domingo**. Só devem ser considerados quando a consulta ao banco falha e não existem dados previamente carregados.

| Saída do Terminal |
| --- |
| 05:30 |
| 05:50 |
| 07:10 |
| 07:40 |
| 09:10 |
| 09:40 |
| 11:10 |
| 11:20 |
| 13:10 |
| 13:40 |
| 15:10 |
| 15:40 |
| 16:50 |
| 17:40 |
| 19:00 |
| 20:00 |
| 21:00 |
| 22:40 |

## Como a interface interpreta os dados

- `horario` é tratado como a hora de **saída do Terminal**, no formato esperado `HH:mm`.
- `dias` determina os dias de operação. A aplicação agrupa segunda a sexta como “Segunda a Sexta”; sábado e domingo são categorias separadas.
- `destino` e `embarque` são usados em partes da administração e dos alertas. Na apresentação dos cartões da página principal, a linha e a parada são fixas no código como C5 e Bela Vista.
- A API calcula a previsão de passagem em Bela Vista e a estimativa de chegada ao Terminal no servidor. Até a coleta atingir os critérios de ativação, mantém o prior de 13 minutos até Bela Vista e 32 minutos no total. Após a ativação, a passagem usa duas camadas adaptativas e a chegada ao Terminal conserva o trecho Bela Vista–Terminal de 19 minutos como prior; não há confirmação operacional independente desse trecho nem dados de GPS/trânsito.
- O passageiro pode confirmar a passagem na viagem correspondente após a saída programada. A confirmação usa a hora do servidor, a versão `grade_hash` vigente e uma chave de viagem única; uma confirmação por viagem é aceita. As observações são agregadas em faixas de três horas, com janela de 90 dias, e só calibram o mesmo `grade_hash`. A adaptação longa usa a mediana e os percentis 10/90 após **20 observações de viagens distintas por faixa**. Antes disso, a interface exibe a janela do prior (`saída + 8–18 min`) com o rótulo `prior`.
- A camada curta aplica ao p50 e aos limites da janela o resíduo da observação mais recente, com decaimento linear até zero em 45 minutos. A estimativa adaptativa fica em modo sombra até que pelo menos **30 previsões fora da amostra** tenham sido avaliadas e o MAE adaptativo seja pelo menos **10% menor** que o MAE do prior. Até a validação, o usuário continua vendo o prior; após ativação, vê a janela p10–p90 adaptativa e o número de observações. O trecho até o Terminal permanece parcialmente baseado no prior.
- Para habilitar a coleta, aplique `supabase/migrations/20261015003000_passage_precision.sql` e configure `SUPABASE_SERVICE_ROLE_KEY` apenas no ambiente server-side da Vercel. A tabela de observações não concede leitura/escrita ao papel anônimo; a API usa a chave de serviço no servidor. Confirmações ficam retidas por até 180 dias.
- Os cartões e previsões são gerados a partir da grade cadastrada; não há integração com GPS nem confirmação independente da operação. As passagens registradas por passageiros são contribuições voluntárias, não telemetria verificada.

## Relógio, fuso horário e precisão temporal

- A aplicação consulta `/api/time`, que fornece a hora UTC do servidor e o fuso de serviço `America/Belem`. A interface ancora essa hora no relógio monotônico do navegador (`performance.now()`), sincroniza novamente a cada cinco minutos e ao voltar ao foco, sem depender da data/hora ou do fuso configurados no aparelho. Se a primeira sincronização falhar, as funções dependentes de horário ficam indisponíveis e a interface informa o problema; uma sincronização posterior recupera a operação.
- O relógio visual mostra `HH:mm:ss` e é atualizado por um temporizador nominal de 1 segundo. Isso descreve a frequência solicitada ao navegador, não uma garantia de atualização em tempo real: abas em segundo plano, suspensão do dispositivo ou carga do navegador podem atrasar temporizadores.
- A comparação entre a hora atual e os horários da grade usa **minutos inteiros** (`hora × 60 + minuto`). Segundos não participam do cálculo de próximos horários ou da janela do alerta.
- A avaliação dos alertas é agendada a cada 30 segundos. O alerta é destinado a tocar quando faltam até 30 minutos. O código seleciona horários ainda não passados, portanto a condição efetiva é de até 30 minutos antes, incluindo o minuto de partida; se a página estiver suspensa ou for aberta depois da partida, o alerta pode não ocorrer.
- A aplicação usa o dia no fuso de serviço `America/Belem` para decidir a categoria do dia usada nos filtros. Alterar o relógio ou fuso do dispositivo não deve alterar os horários apresentados.

## Precisão: interpretação recomendada

| Informação | Precisão/garantia observável |
| --- | --- |
| Saída cadastrada | Resolução de 1 minuto (`HH:mm`); valor informativo da grade, sem confirmação operacional. |
| Passagem prevista em Bela Vista | Prior de 13 minutos; janela prior de 8–18 minutos até haver volume suficiente e validação do modo sombra. Depois, mediana/intervalo p10–p90 das confirmações no servidor. |
| Retorno/chegada estimada ao Terminal | Após ativação, previsão da passagem adaptativa somada ao prior de 19 minutos para o trecho restante. |
| Relógio visual | Segundos exibidos; hora sincronizada com o servidor, apresentada no fuso `America/Belem` e atualizada nominalmente a cada segundo. |
| Alerta | Verificação nominal a cada 30 segundos, cálculo em minutos inteiros e dependência de a página/navegador estar ativo. |

Assim, a precisão mostrada não deve ser interpretada como precisão de chegada ou pontualidade garantida. A grade publicada está sujeita a alteração pela operadora; a própria página apresenta esse aviso.

## Pontos para validação do analista

1. Comparar a grade vigente no Supabase com a fonte oficial da Conecta Marabá, confirmando horários, dias e ponto de referência de cada partida.
2. Confirmar no Supabase o tipo da coluna `horario`, os valores efetivamente cadastrados e se há segundos ou fuso embutidos. A interface os remove ao exibir.
3. Validar operacionalmente o prior de 13 minutos até Bela Vista e os 19 minutos do trecho ao Terminal. A coleta por cliques observa apenas Bela Vista; não valida o trecho restante.
4. Confirmar que `America/Belem` é o fuso de serviço correto para a operação e que o relógio do servidor está sincronizado.
5. Testar alertas com a página aberta, em segundo plano, recarregada perto da saída e com relógio do dispositivo divergente. Não tratar o alerta como notificação garantida.
6. Conferir a validação da grade: a API rejeita horários fora de `HH:mm`, dias inválidos, duplicatas e substituição vazia antes de atualizar o banco.
7. Considerar casos de mudança de dia e filtros. A listagem dos cartões ordena horários pelo valor `HH:mm`, enquanto a seção de situação da viagem considera datas/dias de operação. Confirmar se o comportamento esperado é consistente para horários próximos da meia-noite e para opções de filtro.

## Referências de implementação

- `script.js`: lista de contingência, leitura do Supabase, conversões de hora, cálculo das previsões, relógio e alertas.
- `api/time.js`: hora UTC de referência e fuso de serviço.
- `api/horarios.js` e `api/schedule.mjs`: leitura/gravação da grade, validação, previsões fixas no servidor e `grade_hash`.
- `api/precision.js` e `api/precision.mjs`: registro de confirmações de passagem, estimativas em duas camadas e gate de backtesting.
- `supabase/migrations/20261015003000_passage_precision.sql`: armazenamento privado das observações e retenção de 180 dias.
- `admin/admin.js`: gravação da lista de horários pela interface administrativa.
- `index.html`: aviso de que os horários estão sujeitos a alterações e indicação de alerta 30 minutos antes.
