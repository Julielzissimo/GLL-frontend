# Aplicação web do GLL

Esta pasta contém o frontend estático. Em desenvolvimento local, a aplicação usa IndexedDB e uma base vazia em `seed-data.json`. Nos builds publicados, ela usa Supabase Auth e PostgreSQL com RLS.

Comandos disponíveis na raiz:

```powershell
npm run serve:web
npm run build:homolog
npm run build:prod
npm run build:all
```

O GitHub Actions publica produção na raiz do Pages e homologação em `/homolog/`. Consulte o `README.md` da raiz para URLs e responsabilidades entre frontend e backend.
