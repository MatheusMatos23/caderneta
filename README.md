# Caderneta 📒

Caderninho **digital** de empréstimos pessoais: quem pegou emprestado,
quantas parcelas pagou, quantas faltam, comprovantes e cobrança pelo
WhatsApp — tudo no celular, simples e direto.

Feito para substituir o caderno de papel de quem empresta dinheiro e
controla tudo à mão. Interface 100% em português, com letras grandes e
botões fáceis de tocar.

## O que tem dentro

- **Início**: quanto está "na rua", recebido no mês, atrasados e
  próximos vencimentos — com botão de cobrança pelo WhatsApp.
- **Clientes**: busca, saldo devedor, ficha completa com atalhos de
  ligar/WhatsApp.
- **Empréstimos**: parcelas combinadas (como no caderno) ou juros ao
  mês (o app calcula), com conferência das parcelas antes de salvar.
- **Pagamentos**: total ou parcial, com foto do comprovante e recibo
  em imagem para mandar no WhatsApp.
- **Backup**: arquivo completo (JSON) e planilha Excel.
- **Funciona offline** e sincroniza sozinho. Instala na tela inicial
  do Android e do iPhone (PWA).

## Tecnologia (custo zero)

- HTML + CSS + JavaScript puros — sem instalação, sem build.
- Firebase (plano gratuito Spark): login por e-mail/senha e banco
  Cloud Firestore com modo offline.
- Comprovantes guardados comprimidos dentro do próprio Firestore
  (sem Firebase Storage).
- Hospedagem no GitHub Pages.

## Como publicar

Siga o passo a passo do arquivo **[GUIA-PUBLICACAO.md](GUIA-PUBLICACAO.md)**.
Em resumo: criar o projeto no Firebase, ativar login e Firestore, colar as
regras (`firestore.rules`), preencher o `firebase-config.js` e subir esta
pasta para o GitHub Pages.

## Modo demonstração

Antes de configurar qualquer coisa, dá para conhecer o aplicativo na tela
de login → **"Ver demonstração com dados de exemplo"** (nada fica salvo).

## Privacidade

Cada usuário só enxerga os próprios dados: toda a estrutura fica em
`usuarios/{uid}/...` e as regras do Firestore exigem `request.auth.uid == uid`.
As contas são criadas manualmente no console do Firebase — não existe
cadastro público no aplicativo.
