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
npm test
```

As saídas são geradas em `dist/homolog` e `dist/prod`. URL e chave publicável do Supabase podem ser sobrescritas por `GLL_SUPABASE_URL` e `GLL_SUPABASE_ANON_KEY` (ou `GLL_SUPABASE_PUBLISHABLE_KEY`). Nunca use uma chave `service_role` no frontend.

O workflow do GitHub Pages executa `npm test` antes do build. Se qualquer teste falhar, os jobs de build e deploy não são iniciados. Após publicar, o workflow consulta `deployment.json` na URL do ambiente e exige que o commit observado seja o commit da execução.

Cada execução bem-sucedida armazena um artefato Markdown `evidencia-publicacao-<execução>-<tentativa>` com commit, branch, ambiente, testes, URL e resultado da validação. Migrações são registradas como “não se aplica” nesse artefato; a evidência das migrações fica nos workflows do repositório backend. O procedimento canônico completo está em `docs/PROCESSO_DE_PUBLICACAO.md` do repositório privado `GLL-backend`.

## Estrutura

```text
.github/workflows/pages.yml  Build e publicação no GitHub Pages
scripts/build-web.mjs        Builds de homologação e produção
web/                         HTML, CSS, JavaScript e assets públicos
```

Alterações no schema, RLS, configurações privadas e dados iniciais devem ser feitas no repositório privado do backend e aplicadas aos projetos Supabase correspondentes.
