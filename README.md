# Sistema de Agenda Karol Martins Studio

Aplicação web local para agendamento público e painel administrativo do Karol Martins Studio.

## Como abrir

Abra `index.html` no navegador. Os dados ficam salvos no `localStorage` do navegador.

Para hospedar na propria maquina e acessar pela rede, execute:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "C:\Users\administrator\Documents\New project\deploy\start-karolmartinsstudio.ps1" -Port 8080
```

Depois acesse:

```text
http://localhost:8080
```

Para reiniciar o servidor local, execute:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "C:\Users\administrator\Documents\New project\deploy\restart-karolmartinsstudio.ps1" -Port 8080
```

Login inicial:

- Administrador: `admin@karolmartins.local`
- Senha: `admin123`

Recepção inicial:

- Email: `recepcao@karolmartins.local`
- Senha: `recepcao123`

## Funcionalidades entregues

- Aba pública de agendamento sem login.
- Cadastro de cliente, telefone, data, procedimento, horário e observações.
- Serviços com foto, nome, duração, descrição, valor e status.
- Agenda em blocos configuráveis de 30 minutos.
- Horários ocupados ocultos.
- Validação do intervalo completo do procedimento.
- Horários livres em verde e intervalos insuficientes em vermelho.
- Modal de aviso com `Voltar` preservando dados e `Prosseguir mesmo assim`.
- Painel de agendados com status: agendado, concluído, cancelado e não compareceu.
- Login e controle visual por perfil.
- CRUD local de serviços e usuários.
- Configurações de horário, dias de funcionamento, intervalo e permissão de cancelamento da recepção.
- Dashboard com agenda do dia, próximos atendimentos, serviços e usuários ativos.
- Layout responsivo, mobile-first, com identidade bege, dourada e logo do Studio.
- Modelo SQL em `database/schema.sql` para a versão com backend SQLite.

## Observação de segurança

Esta versão é um protótipo funcional local em frontend puro. Para produção com acesso externo pelo domínio, mova autenticação, validação, upload e banco de dados para backend real com senhas criptografadas.

## Deploy local recomendado

Para publicar em `karolmartinsstudio.com.br` na máquina local do cliente:

1. Deixe o servidor PowerShell rodando na porta `8080`.
2. Configure o roteador com port forwarding da porta externa `80` para o IP interno desta máquina na porta `8080`.
3. Aponte o DNS do domínio para o IP público do local.
4. Para HTTPS, use Nginx como proxy reverso e o arquivo `deploy/nginx-karolmartinsstudio.conf` como base.
5. Emita o SSL com Let's Encrypt, por exemplo usando win-acme no Windows.
6. Configure backup periódico do banco quando a versão backend for adicionada.

Veja também `deploy/ROTEADOR-E-DOMINIO.md`.

## Deploy no Vercel

Esta versão também pode ser publicada como site estático no Vercel.

Opção pela interface:

1. Suba esta pasta para um repositório GitHub.
2. No Vercel, clique em `Add New Project`.
3. Importe o repositório.
4. Use `Other` como framework.
5. Deixe `Build Command` vazio.
6. Deixe `Output Directory` vazio ou como raiz do projeto.
7. Clique em `Deploy`.

Opção pela CLI:

```powershell
npm i -g vercel
vercel login
vercel --prod
```

Depois, em `Settings > Domains`, adicione `karolmartinsstudio.com.br`.

## Supabase

Para sincronizar a agenda entre dispositivos:

1. Crie um projeto no Supabase.
2. Abra `SQL Editor`.
3. Rode o arquivo `database/supabase-app-state.sql`.
4. Copie a `Project URL` e a chave `anon public`.
5. Preencha `supabase-config.js`:

```js
window.KMS_SUPABASE_CONFIG = {
  url: "https://SEU-PROJETO.supabase.co",
  anonKey: "SUA-CHAVE-ANON"
};
```

Depois publique no Vercel.

Importante: esta integração usa uma tabela compartilhada simples para colocar a agenda online rapidamente. Para produção mais segura, o próximo passo é autenticação Supabase, tabelas separadas e políticas RLS por perfil.

## Próximo passo para produção

A estrutura ideal de produção é manter este frontend e adicionar uma API com SQLite local para:

- Tabelas de usuários, serviços, agendamentos e configurações.
- Senhas com hash forte.
- Sessão autenticada.
- Validação dos conflitos no backend.
- Upload seguro de imagens.
- Rotina de backup.
