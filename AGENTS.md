# Instruções permanentes do GLL Frontend

## Publicação em homologação

Toda alteração solicitada deve ser publicada e validada no ambiente `homolog`. Não considere a tarefa concluída apenas com validação local.

## Classificação de melhorias entre releases

Para cada melhoria implementada em `homolog`, pergunte explicitamente à usuária se ela pertence à release [Migração de storage para Cloudflare R2](https://github.com/Julielzissimo/GLL-frontend/milestone/2), à release [Radar de Licitações — 1.0](https://github.com/Julielzissimo/GLL-backend/milestone/3) ou a nenhuma delas. Registre o item somente no marco escolhido; não classifique por tema, aparência ou código preexistente sem a resposta da usuária. Se a usuária já indicar explicitamente uma das três opções na solicitação, use essa classificação sem repetir a pergunta.

Mantenha os commits de cada melhoria separáveis em `homolog`. Monte cada release exclusivamente com seus itens na respectiva branch `codex/release-migracao-storage-cloudflare-r2` ou `codex/release-radar-de-licitacoes-1.0`, ambas iniciadas em `main`. Não inclua itens de uma release na outra nem promova itens pendentes por meio de merge integral de `homolog`.

## UI / UX e Design System

Antes de criar ou modificar qualquer interface:

1. Leia `docs/design.md`.
2. Utilize os Design Tokens existentes em `web/design-system/tokens.css`.
3. Reutilize componentes existentes sempre que possível.
4. Não crie novas cores, espaçamentos, tamanhos ou border-radius arbitrariamente.
5. Não duplique componentes existentes.
6. Caso seja necessário criar um novo componente reutilizável, adicione também sua documentação/story ao Storybook.
7. Novos padrões visuais devem ser incorporados ao Design System.
8. Alterações em componentes compartilhados devem ser avaliadas considerando todas as telas que os utilizam.
9. Preserve acessibilidade, responsividade e compatibilidade visual com o GLL 2.0.
10. Execute `npm test`, `npm run build:homolog` e `npm run build-storybook` antes de publicar.

## Storybook e segurança

O Storybook é um catálogo de desenvolvimento e não deve ser copiado para `web/` ou para o GitHub Pages sem uma camada de autenticação/autorização no servidor. O acesso web incorporado ao GLL deve continuar restrito a Administradores e reutilizar as fontes reais do Design System.
