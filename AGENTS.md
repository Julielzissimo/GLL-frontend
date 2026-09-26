# Instruções permanentes do GLL Frontend

## Publicação em homologação

Toda alteração solicitada deve ser publicada e validada no ambiente `homolog`. Não considere a tarefa concluída apenas com validação local.

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
