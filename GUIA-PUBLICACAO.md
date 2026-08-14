# Guia de publicação da Caderneta 📒

Siga este passo a passo **na ordem**. Nenhum passo é pago — tudo usa o plano
gratuito do Firebase e o GitHub Pages. Reserve uns 30 minutos com calma.

---

## Passo 1 — Criar o projeto no Firebase

1. Entre em **https://console.firebase.google.com** com uma conta Google.
2. Clique em **"Criar um projeto"** (ou "Adicionar projeto").
3. Dê o nome **caderneta** (pode ser outro) e avance.
4. Quando perguntar sobre o **Google Analytics**, pode **desativar** — não usamos.
5. Aguarde criar e clique em **Continuar**.

## Passo 2 — Ativar o login por e-mail e criar os usuários

1. No menu à esquerda, abra **Criação (Build) → Authentication**.
2. Clique em **"Vamos começar"**.
3. Na aba **"Sign-in method" (Método de login)**, escolha **"E-mail/senha"**
   e **ative** a primeira chave. Salve.
   - Não ative "link por e-mail", não precisa.
4. Vá na aba **"Users" (Usuários)** → **"Adicionar usuário"**:
   - Crie o **seu** usuário (seu e-mail + uma senha).
   - Crie o usuário **do seu sogro** (e-mail dele + uma senha fácil de ele lembrar,
     com pelo menos 6 caracteres).
5. Pronto: **não existe cadastro pelo aplicativo** — só essas duas contas entram.
6. Dica de segurança: em **Authentication → Settings (Configurações)**, deixe a
   **proteção contra enumeração de e-mails** LIGADA (já vem ligada por padrão
   nos projetos novos — é só não desligar).

## Passo 3 — Criar o banco de dados (Firestore) e colar as regras

1. No menu à esquerda, abra **Criação (Build) → Cloud Firestore**.
2. Clique em **"Criar banco de dados"**.
3. Escolha o local **southamerica-east1 (São Paulo)** — não dá para mudar depois.
4. Escolha **"Iniciar no modo de produção"** e conclua.
5. Abra a aba **"Regras" (Rules)**, apague tudo o que estiver lá e cole o
   conteúdo do arquivo **`firestore.rules`** desta pasta:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /usuarios/{uid}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
  }
}
```

6. Clique em **"Publicar"**.
   Essas regras garantem que **cada usuário só vê os próprios dados**.

## Passo 4 — Copiar a configuração para o arquivo firebase-config.js

1. No console do Firebase, clique na **engrenagem ⚙️ → Configurações do projeto**.
2. Role até **"Seus aplicativos"** e clique no botão **`</>`** (app da Web).
3. Apelido: **Caderneta** → **Registrar app** (NÃO marque Firebase Hosting).
4. Vai aparecer um trecho parecido com:

```
const firebaseConfig = {
  apiKey: "AIza...",
  authDomain: "caderneta-xxxx.firebaseapp.com",
  projectId: "caderneta-xxxx",
  storageBucket: "caderneta-xxxx.appspot.com",
  messagingSenderId: "1234567890",
  appId: "1:1234567890:web:abcdef"
};
```

5. Abra o arquivo **`firebase-config.js`** desta pasta no Bloco de Notas
   e troque cada `"COLE_AQUI"` pelo valor correspondente. Salve.

## Passo 5 — Publicar no GitHub Pages

1. Crie uma conta (grátis) em **https://github.com**, se não tiver.
2. Clique em **+ → New repository**:
   - Nome: **caderneta**
   - Deixe **Public** marcado e clique em **Create repository**.
3. Na página do repositório, clique em **"uploading an existing file"**
   (ou Add file → Upload files).
4. **Arraste TODOS os arquivos e pastas** de dentro da pasta `caderneta`
   (o `index.html` precisa ficar na raiz do repositório, não dentro de
   uma subpasta). Clique em **Commit changes**.
   - Dica: se o navegador não deixar arrastar as pastas `css`, `js` e
     `icones`, use o GitHub Desktop ou o git pelo terminal:

```bash
git init
git add .
git commit -m "Caderneta"
git branch -M main
git remote add origin https://github.com/SEU-USUARIO/caderneta.git
git push -u origin main
```

5. No repositório, abra **Settings → Pages**:
   - Em **Source**, escolha **Deploy from a branch**.
   - Branch: **main**, pasta **/ (root)** → **Save**.
6. Aguarde 1–2 minutos. O endereço do aplicativo será:
   **https://SEU-USUARIO.github.io/caderneta/**

## Passo 6 — Autorizar o endereço no Firebase (importante!)

O Firebase só aceita login vindo de endereços autorizados.

1. Volte ao console do Firebase → **Authentication → Settings (Configurações)**
   → **Authorized domains (Domínios autorizados)**.
2. Clique em **Adicionar domínio** e digite:
   **SEU-USUARIO.github.io** (sem "https://" e sem "/caderneta").
3. Salve. Sem isso, o login mostra erro de "domínio não autorizado".

## Passo 7 — Testar e instalar nos celulares

1. Abra **https://SEU-USUARIO.github.io/caderneta/** no celular e entre
   com um dos usuários criados no Passo 2.
2. Faça um teste completo: crie um cliente, um empréstimo, registre um
   pagamento e gere um recibo.
3. **Instalar no Android (Chrome):** menu ⋮ → **"Adicionar à tela inicial"**
   (ou "Instalar app") → confirme. O ícone verde da Caderneta aparece
   como um aplicativo normal.
4. **Instalar no iPhone (Safari):** botão **Compartilhar** (quadrado com
   seta) → **"Adicionar à Tela de Início"** → confirme.
5. Depois de abrir uma vez com internet, o aplicativo **funciona offline**
   e envia as anotações sozinho quando a conexão volta.

---

## Problemas comuns

| O que aparece | O que fazer |
|---|---|
| "E-mail ou senha incorretos" | Confira o usuário criado no Passo 2 (a senha tem no mínimo 6 caracteres). |
| Erro de domínio não autorizado | Refaça o Passo 6. |
| Tela dizendo que falta ligar o Firebase | O `firebase-config.js` ainda está com "COLE_AQUI" — refaça o Passo 4 e suba o arquivo de novo. |
| "Sem internet" no primeiro acesso | O primeiro carregamento precisa de internet; depois funciona offline. |
| Mudou algum arquivo e não atualizou no celular | Troque `caderneta-v1` para `caderneta-v2` no `service-worker.js` e publique de novo. |

## Backup

De tempos em tempos, abra **Ajustes → Baixar backup completo** e guarde o
arquivo em local seguro (Google Drive, pen drive etc.).
