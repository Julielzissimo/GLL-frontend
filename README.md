# GLL Frontend

Frontend estático do Gerenciador de Licitações Locais (GLL), publicado gratuitamente no GitHub Pages.

Os dados, a autenticação e as políticas de acesso permanecem no Supabase. Este repositório contém apenas código cliente e chaves `sb_publishable_*`, que são próprias para uso público no navegador. Credenciais administrativas, dados cadastrais privados, seeds operacionais e o schema do banco ficam no repositório privado do backend.

## Ambientes

- Produção (`main`): `https://julielzissimo.github.io/GLL-frontend/`
- Homologação (`homolog`): `https://julielzissimo.github.io/GLL-frontend/homolog/`

O workflow recompõe os dois ambientes em cada publicação para que mudanças de `homolog` não sejam promovidas acidentalmente para a raiz de produção.

## Executar localmente

Requisitos: navegador moderno, Node.js e Python 3 para os servidores locais opcionais.

```powershell
npm run serve:web
```

Acesse `http://127.0.0.1:4173`. O modo local usa IndexedDB, dados vazios e a credencial de demonstração exibida na própria tela. Ele não se conecta ao Supabase.

## Builds

```powershell
npm run build:homolog
npm run build:prod
npm run build:all
```

As saídas são geradas em `dist/homolog` e `dist/prod`. URL e chave publicável do Supabase podem ser sobrescritas por `GLL_SUPABASE_URL` e `GLL_SUPABASE_ANON_KEY` (ou `GLL_SUPABASE_PUBLISHABLE_KEY`). Nunca use uma chave `service_role` no frontend.

## Estrutura

```text
.github/workflows/pages.yml  Build e publicação no GitHub Pages
scripts/build-web.mjs        Builds de homologação e produção
web/                         HTML, CSS, JavaScript e assets públicos
```

Alterações no schema, RLS, configurações privadas e dados iniciais devem ser feitas no repositório privado do backend e aplicadas aos projetos Supabase correspondentes.
