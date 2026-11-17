// GERADO por scripts/sincronizar-manual.ts a partir de docs/manual-usuario.md — não editar à mão.
export const MANUAL_USUARIO = "# Manual de uso — Sistema de Gestão Comercial\n\nEste manual é para quem usa o sistema no dia a dia: vendedores, gerentes e administradores.\n\n\n---\n\n## 1. Acesso\n\n1. Abra o endereço do sistema no navegador (computador, tablet ou celular).\n2. Digite seu **usuário** e **senha** e escolha a **loja em que você está agora**.\n3. No primeiro acesso, o sistema pede para você criar sua senha definitiva\n   (mínimo de 10 caracteres, com letras e números).\n\n- **Trocou de loja durante o dia?** Mude a loja no seletor do topo da tela. As vendas são registradas na loja escolhida.\n- **Errou a senha 5 vezes?** O acesso fica bloqueado por 15 minutos. Se esqueceu a senha, peça ao administrador para criar uma provisória.\n- **Ao terminar**, clique no ícone de sair (canto superior direito), principalmente em computadores compartilhados.\n- **Precisa de ajuda?** Clique na bolinha de suporte, no canto inferior direito de qualquer tela, e pergunte ao atendente virtual.\n\n### O que cada perfil pode fazer\n\n| | Vendedor | Gerente | Administrador |\n|---|:-:|:-:|:-:|\n| Registrar vendas, cadastrar clientes | ✔ | ✔ | ✔ |\n| Fazer o pós-venda dos **próprios** clientes | ✔ | ✔ (todos) | ✔ (todos) |\n| Receber parcelas de carnê/crediário | ✔ | ✔ | ✔ |\n| Ver estoque de todas as lojas | ✔ | ✔ | ✔ |\n| Ver custo e margem dos produtos | | ✔ | ✔ |\n| Cadastrar produtos, dar entrada, ajustar e transferir estoque | | ✔ | ✔ |\n| Cancelar vendas, estornar recebimentos | | ✔ | ✔ |\n| Inadimplência, cobrança, relatórios, painel da equipe | | ✔ | ✔ |\n| Cadastrar usuários, configurar status do pós-venda | | | ✔ |\n\n---\n\n## 2. Cadastrar usuários e vendedores (administrador)\n\n1. Menu **Equipe** → **Novo usuário**.\n2. Preencha nome, usuário (ex.: `maria.silva`), perfil e uma **senha provisória**.\n3. Se a pessoa vende, deixe marcado **“Realiza vendas”** e informe CPF e data de admissão.\n   Ela passa a aparecer como vendedor nas vendas, no pós-venda e nos indicadores.\n4. Entregue o usuário e a senha provisória pessoalmente. No primeiro acesso, ela cria a própria senha.\n\n- **Pessoa saiu da empresa?** Abra o usuário e desmarque **“Usuário ativo”**. Nada é apagado: o histórico de vendas continua.\n- **Esqueceu a senha?** Abra o usuário → **Redefinir senha** (cria uma nova provisória).\n\n**Status do pós-venda**: em **Pós-venda → Status** você renomeia, reordena, cria ou desativa etapas do acompanhamento.\nUma etapa marcada como **“Encerra”** conclui o atendimento. Etapas em uso não podem ser desativadas.\n\n---\n\n## 3. Clientes\n\n- Menu **Clientes**: busque pelo nome, CPF ou celular. Na lista, o CPF aparece parcialmente oculto.\n- **Novo cliente**: CPF, nome e celular são obrigatórios; o restante pode ser completado depois.\n  Ao digitar o **CEP**, o endereço é preenchido sozinho.\n- Marque **“Cliente autoriza contato”** só quando o cliente concordar (LGPD).\n- A ficha do cliente mostra o total comprado, as compras, os contatos de pós-venda e o saldo em aberto no carnê/crediário.\n- O CPF não pode ser alterado depois do cadastro. Em caso de erro, procure o administrador.\n\n## 4. Consultar produtos e estoque\n\n- Menu **Produtos**: busque por nome, código, marca, SKU ou código de barras.\n- Menu **Estoque**: mostra o saldo de cada produto **em todas as lojas**. A coluna da sua loja fica destacada.\n  Use **“Só estoque baixo”** para ver o que está acabando.\n- Se o produto acabou na sua loja, veja em qual loja ele existe e combine a transferência com o gerente.\n\n---\n\n## 5. Cadastrar produtos e movimentar o estoque (gerente/administrador)\n\n1. Menu **Produtos** → **Novo produto**.\n2. Preencha código, nome, categoria e marca. Se a categoria ou a marca forem novas, o sistema cria automaticamente.\n3. Adicione a **foto** (clique no quadro). O sistema reduz a imagem sozinho.\n4. **Variações**: use uma linha para cada cor, tamanho ou aro, cada uma com seu preço e seu estoque.\n   Produto sem variação: deixe só a linha “Padrão”.\n5. Informe custo e preço de venda. A **margem** aparece na hora.\n6. Em “Estoque em [sua loja]”, informe a quantidade que já está na prateleira.\n\n**Estoque** (menu **Estoque** → **Movimentar**):\n- **Entrada**: mercadoria recebida (informe a nota fiscal na observação).\n- **Ajuste por contagem**: no inventário, informe a quantidade **contada**. O sistema calcula a diferença. O motivo é obrigatório.\n- **Transferência**: envio de peças de uma loja para outra.\n- **Estoque mínimo por loja**: abaixo dele, o produto aparece em “Estoque baixo”.\n- O botão **Movimentações** mostra o histórico de entradas, saídas, ajustes e transferências.\n\n---\n\n## 6. Registrar uma venda\n\n1. Menu **Nova venda**.\n2. Digite o **CPF do cliente**.\n   - Se o cliente já tem cadastro, o nome aparece.\n   - Se **não** tem cadastro, clique em **“Cadastrar agora”**. Preencha pelo menos nome e celular e salve.\n     Você volta para a venda **com tudo o que já tinha preenchido**.\n   - Pergunte se o cliente **autoriza contato por WhatsApp** e marque no cadastro (LGPD).\n3. Escolha o **vendedor**.\n4. Busque os **produtos** por nome, marca ou código, ou leia o **código de barras** (o Enter adiciona).\n   A tela mostra o estoque da loja e em quais outras lojas o produto existe.\n5. **É presente?** Marque **Sim** ou **Não** (obrigatório). Se for presente, informe, se souber, a **data da comemoração**\n   (aniversário ou outra data) e, na **observação**, para quem é. Esses dois campos são opcionais.\n6. Se houver **desconto**, escolha entre % e R$ e digite o valor.\n7. **Pagamento**: escolha a forma. Para dividir entre duas formas (ex.: entrada no PIX e o resto no carnê),\n   clique em **“Outra forma”**. O botão **“Usar restante”** completa o valor.\n   - **Cartão de crédito**: informe as parcelas (a operadora é quem recebe).\n   - **Crediário/Carnê**: informe as parcelas e o **1º vencimento**. O sistema mostra todas as datas.\n8. Confira o **Resumo** e clique em **Confirmar venda**. O botão só libera quando não falta nada; a lista em laranja mostra o que falta.\n\nAo confirmar, o sistema dá baixa no estoque, registra a venda, cria as parcelas e agenda o pós-venda para 7 dias.\nNa tela da venda, use **Imprimir** para o comprovante.\n\n- **Produto sem estoque na loja?** A venda não é liberada. Veja em qual loja o produto existe.\n- **Saiu da tela no meio da venda?** A venda em andamento é recuperada ao voltar para **Nova venda** (ou use “Descartar e começar de novo”).\n- **Registrou algo errado?** Peça ao gerente para cancelar a venda e registre de novo.\n- Em **Vendas** você vê o histórico das suas vendas.\n\n### Cancelar uma venda (gerente/administrador)\nAbra a venda → **Cancelar venda** → informe o motivo.\nO estoque volta e as parcelas abertas são canceladas. A venda continua no histórico, marcada como cancelada.\nNão é possível cancelar uma venda que tem parcela já paga: trate a devolução antes.\nNo menu **Vendas** o gerente vê as vendas de todos, com filtros e o botão **Exportar CSV**.\n\n---\n\n## 7. Pós-venda\n\nO pós-venda é criado sozinho em cada venda, com **7 dias** para o contato.\n\n1. Menu **Pós-venda**. As abas mostram **Pendentes**, **Atrasados** (vermelho), **Vencendo** (laranja) e **Concluídos**.\n2. Clique em **Atender**.\n3. Use o botão **WhatsApp com mensagem pronta** (aparece se o cliente autorizou) ou **Ligar**.\n4. Depois do contato, registre o **canal**, o **resultado** e o **novo status**.\n   - Precisa falar de novo? Escolha a data em **“Agendar novo contato”**. O cliente volta para a fila nessa data.\n   - Resolvido? Escolha **“Atendimento concluído”**.\n\n**Vendas de presente**: aparecem na fila com o selo **Presente**, e a mensagem pronta do WhatsApp pergunta se o presente agradou.\nNa tela do atendimento aparecem para quem é o presente e a data.\n\n**Datas de presente**: a compra de presente fica guardada no cadastro do cliente (menu **Clientes**, seção “Datas de presente”).\nUm cliente pode ter várias datas: uma nova compra não apaga as anteriores. Se a venda for cancelada, a data sai do cadastro.\nA partir do ano seguinte ao da compra, a data volta sozinha na aba **Datas de presente** do **Pós-venda**, 30 dias antes,\ne continua aparecendo até 7 dias depois da data. Clique em **Atender**, fale com o cliente (há WhatsApp com mensagem pronta, se ele autorizou contato)\ne registre o contato. Isso se repete todo ano. Presentes sem data ficam só no cadastro e não geram lembrete.\n\nO vendedor vê e atende os pós-vendas **dos próprios clientes**. Se precisar de mais prazo para um atendimento, peça ao gerente.\n\n### Pós-venda — visão do gerente\nO gerente vê os pós-vendas de todos e pode filtrar por vendedor e loja.\nO **Painel da equipe** mostra, por vendedor, quantos pós-vendas estão atrasados ou sem contato\ne a porcentagem feita no prazo. Os vendedores que mais deixam de fazer aparecem no topo.\nO gerente também pode **ajustar o prazo** de um atendimento, com motivo.\n\n---\n\n## 8. Receber uma parcela de carnê/crediário\n\n1. Menu **Recebimentos** → busque o cliente pelo CPF, nome ou código da venda → **Receber**.\n2. Na parcela, o valor já vem preenchido com o saldo. Pode ser pagamento **parcial**.\n3. Escolha a forma e clique em **Registrar pagamento**. Use **Imprimir** para o comprovante.\n4. Lançou um pagamento errado? Peça ao gerente para fazer o estorno.\n\n### Estorno e inadimplência (gerente/administrador)\n**Estorno**: se um pagamento foi lançado errado, clique em **Estornar** e informe o motivo.\nO registro continua visível, riscado.\n\n**Inadimplência**\n- O menu **Inadimplência** lista **somente** parcelas de crediário/carnê **vencidas e não pagas**,\n  começando pelo maior atraso. Cartão de crédito nunca aparece aqui.\n- Em **Cobrar**, registre cada tentativa: canal, o que aconteceu e o status\n  (ex.: “Promessa de pagamento”, informando o valor e a data prometidos).\n- O sistema atualiza o status sozinho: um pagamento parcial muda para “Pagamento parcial”;\n  quando todo o atraso é pago, muda para **“Regularizado”**.\n- Promessas que passaram da data aparecem com o aviso **“promessa vencida”**.\n\n---\n\n## 9. Indicadores\n\n- **Início**: faturamento do período, de hoje e do mês, ticket médio, descontos, alertas e gráficos.\n  Use os botões de período (Hoje, 7 dias, 30 dias, Este mês, Mês passado) ou escolha as datas.\n\n- No **Início**, o vendedor vê apenas os próprios números e os próprios pós-vendas.\n- **Meu desempenho**: seus resultados, sua posição no ranking e seus pós-vendas.\n\n### Relatórios (gerente/administrador)\n- No **Início**, o gerente pode filtrar por loja e por vendedor.\n- **Relatórios**: faturamento, ranking e margem por vendedor, produtos mais e menos vendidos,\n  clientes recorrentes, clientes sem compras recentes, aniversariantes, pós-venda, inadimplência e estoque baixo.\n  Todos têm filtros e o botão **Exportar CSV** (abre no Excel).\n- Na página de um vendedor (clique no nome dele no ranking) aparece o desempenho individual.\n\n### Assistente de IA (gerente/administrador)\nNo topo da aba **Relatórios** fica a caixa **“Pergunte ao assistente”**. Escreva a pergunta como falaria com um consultor, por exemplo:\n- “Como foram as vendas deste mês comparadas ao mês passado?”\n- “Qual loja vendeu mais na semana passada?”\n- “Qual vendedor está deixando de fazer o pós-venda?”\n- “Quanto temos vencido no crediário?”\n- “Como cadastro um novo vendedor?”\n\nO assistente consulta os relatórios do sistema e responde com os números e uma leitura breve. Ele **só consulta**: não registra, não altera e não apaga nada.\nPor privacidade, ele não recebe CPF, telefone, e-mail nem endereço de clientes.\nAs respostas são geradas por inteligência artificial: confira números importantes nos relatórios. Use **“Nova conversa”** para mudar de assunto.\nCada pessoa pode fazer até 30 perguntas por hora.\n\n---\n\n## 10. Chat de suporte\n\nA bolinha no canto inferior direito de qualquer tela abre o **chat de suporte**, um atendente virtual (inteligência artificial)\nque tira dúvidas sobre **como usar o sistema**, de acordo com o seu perfil.\nEle não consulta vendas, clientes nem números da loja (para isso, use as telas do sistema) e não altera nada.\nSe ele não resolver, procure o gerente da sua loja ou o administrador.\n\n---\n\n## 11. Cuidados com dados pessoais (LGPD)\n\n- Use os dados dos clientes só para o atendimento da loja.\n- Só envie mensagens para quem **autorizou contato**. O sistema avisa quando o cliente não autorizou.\n- Não compartilhe sua senha. Saia do sistema ao terminar em computadores compartilhados.\n- Arquivos exportados (CSV) contêm dados de clientes: não envie por grupos nem os deixe em computadores públicos.\n";

export const SECOES_MANUAL: { perfis: ("ADMIN" | "GERENTE" | "VENDEDOR")[]; texto: string }[] = [
 {
  "perfis": [
   "ADMIN",
   "GERENTE",
   "VENDEDOR"
  ],
  "texto": "# Manual de uso — Sistema de Gestão Comercial\n\nEste manual é para quem usa o sistema no dia a dia: vendedores, gerentes e administradores."
 },
 {
  "perfis": [
   "ADMIN",
   "GERENTE",
   "VENDEDOR"
  ],
  "texto": "## 1. Acesso\n\n1. Abra o endereço do sistema no navegador (computador, tablet ou celular).\n2. Digite seu **usuário** e **senha** e escolha a **loja em que você está agora**.\n3. No primeiro acesso, o sistema pede para você criar sua senha definitiva\n   (mínimo de 10 caracteres, com letras e números).\n\n- **Trocou de loja durante o dia?** Mude a loja no seletor do topo da tela. As vendas são registradas na loja escolhida.\n- **Errou a senha 5 vezes?** O acesso fica bloqueado por 15 minutos. Se esqueceu a senha, peça ao administrador para criar uma provisória.\n- **Ao terminar**, clique no ícone de sair (canto superior direito), principalmente em computadores compartilhados.\n- **Precisa de ajuda?** Clique na bolinha de suporte, no canto inferior direito de qualquer tela, e pergunte ao atendente virtual."
 },
 {
  "perfis": [],
  "texto": "### O que cada perfil pode fazer\n\n| | Vendedor | Gerente | Administrador |\n|---|:-:|:-:|:-:|\n| Registrar vendas, cadastrar clientes | ✔ | ✔ | ✔ |\n| Fazer o pós-venda dos **próprios** clientes | ✔ | ✔ (todos) | ✔ (todos) |\n| Receber parcelas de carnê/crediário | ✔ | ✔ | ✔ |\n| Ver estoque de todas as lojas | ✔ | ✔ | ✔ |\n| Ver custo e margem dos produtos | | ✔ | ✔ |\n| Cadastrar produtos, dar entrada, ajustar e transferir estoque | | ✔ | ✔ |\n| Cancelar vendas, estornar recebimentos | | ✔ | ✔ |\n| Inadimplência, cobrança, relatórios, painel da equipe | | ✔ | ✔ |\n| Cadastrar usuários, configurar status do pós-venda | | | ✔ |"
 },
 {
  "perfis": [
   "ADMIN"
  ],
  "texto": "## 2. Cadastrar usuários e vendedores (administrador)\n\n1. Menu **Equipe** → **Novo usuário**.\n2. Preencha nome, usuário (ex.: `maria.silva`), perfil e uma **senha provisória**.\n3. Se a pessoa vende, deixe marcado **“Realiza vendas”** e informe CPF e data de admissão.\n   Ela passa a aparecer como vendedor nas vendas, no pós-venda e nos indicadores.\n4. Entregue o usuário e a senha provisória pessoalmente. No primeiro acesso, ela cria a própria senha.\n\n- **Pessoa saiu da empresa?** Abra o usuário e desmarque **“Usuário ativo”**. Nada é apagado: o histórico de vendas continua.\n- **Esqueceu a senha?** Abra o usuário → **Redefinir senha** (cria uma nova provisória).\n\n**Status do pós-venda**: em **Pós-venda → Status** você renomeia, reordena, cria ou desativa etapas do acompanhamento.\nUma etapa marcada como **“Encerra”** conclui o atendimento. Etapas em uso não podem ser desativadas."
 },
 {
  "perfis": [
   "ADMIN",
   "GERENTE",
   "VENDEDOR"
  ],
  "texto": "## 3. Clientes\n\n- Menu **Clientes**: busque pelo nome, CPF ou celular. Na lista, o CPF aparece parcialmente oculto.\n- **Novo cliente**: CPF, nome e celular são obrigatórios; o restante pode ser completado depois.\n  Ao digitar o **CEP**, o endereço é preenchido sozinho.\n- Marque **“Cliente autoriza contato”** só quando o cliente concordar (LGPD).\n- A ficha do cliente mostra o total comprado, as compras, os contatos de pós-venda e o saldo em aberto no carnê/crediário.\n- O CPF não pode ser alterado depois do cadastro. Em caso de erro, procure o administrador."
 },
 {
  "perfis": [
   "ADMIN",
   "GERENTE",
   "VENDEDOR"
  ],
  "texto": "## 4. Consultar produtos e estoque\n\n- Menu **Produtos**: busque por nome, código, marca, SKU ou código de barras.\n- Menu **Estoque**: mostra o saldo de cada produto **em todas as lojas**. A coluna da sua loja fica destacada.\n  Use **“Só estoque baixo”** para ver o que está acabando.\n- Se o produto acabou na sua loja, veja em qual loja ele existe e combine a transferência com o gerente."
 },
 {
  "perfis": [
   "GERENTE",
   "ADMIN"
  ],
  "texto": "## 5. Cadastrar produtos e movimentar o estoque (gerente/administrador)\n\n1. Menu **Produtos** → **Novo produto**.\n2. Preencha código, nome, categoria e marca. Se a categoria ou a marca forem novas, o sistema cria automaticamente.\n3. Adicione a **foto** (clique no quadro). O sistema reduz a imagem sozinho.\n4. **Variações**: use uma linha para cada cor, tamanho ou aro, cada uma com seu preço e seu estoque.\n   Produto sem variação: deixe só a linha “Padrão”.\n5. Informe custo e preço de venda. A **margem** aparece na hora.\n6. Em “Estoque em [sua loja]”, informe a quantidade que já está na prateleira.\n\n**Estoque** (menu **Estoque** → **Movimentar**):\n- **Entrada**: mercadoria recebida (informe a nota fiscal na observação).\n- **Ajuste por contagem**: no inventário, informe a quantidade **contada**. O sistema calcula a diferença. O motivo é obrigatório.\n- **Transferência**: envio de peças de uma loja para outra.\n- **Estoque mínimo por loja**: abaixo dele, o produto aparece em “Estoque baixo”.\n- O botão **Movimentações** mostra o histórico de entradas, saídas, ajustes e transferências."
 },
 {
  "perfis": [
   "ADMIN",
   "GERENTE",
   "VENDEDOR"
  ],
  "texto": "## 6. Registrar uma venda\n\n1. Menu **Nova venda**.\n2. Digite o **CPF do cliente**.\n   - Se o cliente já tem cadastro, o nome aparece.\n   - Se **não** tem cadastro, clique em **“Cadastrar agora”**. Preencha pelo menos nome e celular e salve.\n     Você volta para a venda **com tudo o que já tinha preenchido**.\n   - Pergunte se o cliente **autoriza contato por WhatsApp** e marque no cadastro (LGPD).\n3. Escolha o **vendedor**.\n4. Busque os **produtos** por nome, marca ou código, ou leia o **código de barras** (o Enter adiciona).\n   A tela mostra o estoque da loja e em quais outras lojas o produto existe.\n5. **É presente?** Marque **Sim** ou **Não** (obrigatório). Se for presente, informe, se souber, a **data da comemoração**\n   (aniversário ou outra data) e, na **observação**, para quem é. Esses dois campos são opcionais.\n6. Se houver **desconto**, escolha entre % e R$ e digite o valor.\n7. **Pagamento**: escolha a forma. Para dividir entre duas formas (ex.: entrada no PIX e o resto no carnê),\n   clique em **“Outra forma”**. O botão **“Usar restante”** completa o valor.\n   - **Cartão de crédito**: informe as parcelas (a operadora é quem recebe).\n   - **Crediário/Carnê**: informe as parcelas e o **1º vencimento**. O sistema mostra todas as datas.\n8. Confira o **Resumo** e clique em **Confirmar venda**. O botão só libera quando não falta nada; a lista em laranja mostra o que falta.\n\nAo confirmar, o sistema dá baixa no estoque, registra a venda, cria as parcelas e agenda o pós-venda para 7 dias.\nNa tela da venda, use **Imprimir** para o comprovante.\n\n- **Produto sem estoque na loja?** A venda não é liberada. Veja em qual loja o produto existe.\n- **Saiu da tela no meio da venda?** A venda em andamento é recuperada ao voltar para **Nova venda** (ou use “Descartar e começar de novo”).\n- **Registrou algo errado?** Peça ao gerente para cancelar a venda e registre de novo.\n- Em **Vendas** você vê o histórico das suas vendas."
 },
 {
  "perfis": [
   "GERENTE",
   "ADMIN"
  ],
  "texto": "### Cancelar uma venda (gerente/administrador)\nAbra a venda → **Cancelar venda** → informe o motivo.\nO estoque volta e as parcelas abertas são canceladas. A venda continua no histórico, marcada como cancelada.\nNão é possível cancelar uma venda que tem parcela já paga: trate a devolução antes.\nNo menu **Vendas** o gerente vê as vendas de todos, com filtros e o botão **Exportar CSV**."
 },
 {
  "perfis": [
   "ADMIN",
   "GERENTE",
   "VENDEDOR"
  ],
  "texto": "## 7. Pós-venda\n\nO pós-venda é criado sozinho em cada venda, com **7 dias** para o contato.\n\n1. Menu **Pós-venda**. As abas mostram **Pendentes**, **Atrasados** (vermelho), **Vencendo** (laranja) e **Concluídos**.\n2. Clique em **Atender**.\n3. Use o botão **WhatsApp com mensagem pronta** (aparece se o cliente autorizou) ou **Ligar**.\n4. Depois do contato, registre o **canal**, o **resultado** e o **novo status**.\n   - Precisa falar de novo? Escolha a data em **“Agendar novo contato”**. O cliente volta para a fila nessa data.\n   - Resolvido? Escolha **“Atendimento concluído”**.\n\n**Vendas de presente**: aparecem na fila com o selo **Presente**, e a mensagem pronta do WhatsApp pergunta se o presente agradou.\nNa tela do atendimento aparecem para quem é o presente e a data.\n\n**Datas de presente**: a compra de presente fica guardada no cadastro do cliente (menu **Clientes**, seção “Datas de presente”).\nUm cliente pode ter várias datas: uma nova compra não apaga as anteriores. Se a venda for cancelada, a data sai do cadastro.\nA partir do ano seguinte ao da compra, a data volta sozinha na aba **Datas de presente** do **Pós-venda**, 30 dias antes,\ne continua aparecendo até 7 dias depois da data. Clique em **Atender**, fale com o cliente (há WhatsApp com mensagem pronta, se ele autorizou contato)\ne registre o contato. Isso se repete todo ano. Presentes sem data ficam só no cadastro e não geram lembrete."
 },
 {
  "perfis": [
   "VENDEDOR"
  ],
  "texto": "O vendedor vê e atende os pós-vendas **dos próprios clientes**. Se precisar de mais prazo para um atendimento, peça ao gerente."
 },
 {
  "perfis": [
   "GERENTE",
   "ADMIN"
  ],
  "texto": "### Pós-venda — visão do gerente\nO gerente vê os pós-vendas de todos e pode filtrar por vendedor e loja.\nO **Painel da equipe** mostra, por vendedor, quantos pós-vendas estão atrasados ou sem contato\ne a porcentagem feita no prazo. Os vendedores que mais deixam de fazer aparecem no topo.\nO gerente também pode **ajustar o prazo** de um atendimento, com motivo."
 },
 {
  "perfis": [
   "ADMIN",
   "GERENTE",
   "VENDEDOR"
  ],
  "texto": "## 8. Receber uma parcela de carnê/crediário\n\n1. Menu **Recebimentos** → busque o cliente pelo CPF, nome ou código da venda → **Receber**.\n2. Na parcela, o valor já vem preenchido com o saldo. Pode ser pagamento **parcial**.\n3. Escolha a forma e clique em **Registrar pagamento**. Use **Imprimir** para o comprovante.\n4. Lançou um pagamento errado? Peça ao gerente para fazer o estorno."
 },
 {
  "perfis": [
   "GERENTE",
   "ADMIN"
  ],
  "texto": "### Estorno e inadimplência (gerente/administrador)\n**Estorno**: se um pagamento foi lançado errado, clique em **Estornar** e informe o motivo.\nO registro continua visível, riscado.\n\n**Inadimplência**\n- O menu **Inadimplência** lista **somente** parcelas de crediário/carnê **vencidas e não pagas**,\n  começando pelo maior atraso. Cartão de crédito nunca aparece aqui.\n- Em **Cobrar**, registre cada tentativa: canal, o que aconteceu e o status\n  (ex.: “Promessa de pagamento”, informando o valor e a data prometidos).\n- O sistema atualiza o status sozinho: um pagamento parcial muda para “Pagamento parcial”;\n  quando todo o atraso é pago, muda para **“Regularizado”**.\n- Promessas que passaram da data aparecem com o aviso **“promessa vencida”**."
 },
 {
  "perfis": [
   "ADMIN",
   "GERENTE",
   "VENDEDOR"
  ],
  "texto": "## 9. Indicadores\n\n- **Início**: faturamento do período, de hoje e do mês, ticket médio, descontos, alertas e gráficos.\n  Use os botões de período (Hoje, 7 dias, 30 dias, Este mês, Mês passado) ou escolha as datas."
 },
 {
  "perfis": [
   "VENDEDOR"
  ],
  "texto": "- No **Início**, o vendedor vê apenas os próprios números e os próprios pós-vendas.\n- **Meu desempenho**: seus resultados, sua posição no ranking e seus pós-vendas."
 },
 {
  "perfis": [
   "GERENTE",
   "ADMIN"
  ],
  "texto": "### Relatórios (gerente/administrador)\n- No **Início**, o gerente pode filtrar por loja e por vendedor.\n- **Relatórios**: faturamento, ranking e margem por vendedor, produtos mais e menos vendidos,\n  clientes recorrentes, clientes sem compras recentes, aniversariantes, pós-venda, inadimplência e estoque baixo.\n  Todos têm filtros e o botão **Exportar CSV** (abre no Excel).\n- Na página de um vendedor (clique no nome dele no ranking) aparece o desempenho individual.\n\n### Assistente de IA (gerente/administrador)\nNo topo da aba **Relatórios** fica a caixa **“Pergunte ao assistente”**. Escreva a pergunta como falaria com um consultor, por exemplo:\n- “Como foram as vendas deste mês comparadas ao mês passado?”\n- “Qual loja vendeu mais na semana passada?”\n- “Qual vendedor está deixando de fazer o pós-venda?”\n- “Quanto temos vencido no crediário?”\n- “Como cadastro um novo vendedor?”\n\nO assistente consulta os relatórios do sistema e responde com os números e uma leitura breve. Ele **só consulta**: não registra, não altera e não apaga nada.\nPor privacidade, ele não recebe CPF, telefone, e-mail nem endereço de clientes.\nAs respostas são geradas por inteligência artificial: confira números importantes nos relatórios. Use **“Nova conversa”** para mudar de assunto.\nCada pessoa pode fazer até 30 perguntas por hora."
 },
 {
  "perfis": [
   "ADMIN",
   "GERENTE",
   "VENDEDOR"
  ],
  "texto": "## 10. Chat de suporte\n\nA bolinha no canto inferior direito de qualquer tela abre o **chat de suporte**, um atendente virtual (inteligência artificial)\nque tira dúvidas sobre **como usar o sistema**, de acordo com o seu perfil.\nEle não consulta vendas, clientes nem números da loja (para isso, use as telas do sistema) e não altera nada.\nSe ele não resolver, procure o gerente da sua loja ou o administrador."
 },
 {
  "perfis": [
   "ADMIN",
   "GERENTE",
   "VENDEDOR"
  ],
  "texto": "## 11. Cuidados com dados pessoais (LGPD)\n\n- Use os dados dos clientes só para o atendimento da loja.\n- Só envie mensagens para quem **autorizou contato**. O sistema avisa quando o cliente não autorizou.\n- Não compartilhe sua senha. Saia do sistema ao terminar em computadores compartilhados.\n- Arquivos exportados (CSV) contêm dados de clientes: não envie por grupos nem os deixe em computadores públicos."
 }
];
