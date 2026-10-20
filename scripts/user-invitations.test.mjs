import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const html = await readFile(new URL("../web/index.html", import.meta.url), "utf8");
const source = await readFile(new URL("../web/app.js", import.meta.url), "utf8");
const createForm = html.match(/<form id="userCreateForm"[\s\S]*?<\/form>/)?.[0] || "";
const inviteFields = [...createForm.matchAll(/<label class="user-create-only">([\s\S]*?)<\/label>/g)]
  .map(([, field]) => field);

test("create-user form only asks for invited email and role", () => {
  assert.match(html, /<h1 id="userProfilePageTitle">Convidar usuário<\/h1>/);
  assert.match(html, /<button id="userCreateSubmitButton"[^>]*>Enviar convite<\/button>/);
  assert.equal(inviteFields.length, 2);
  assert.match(inviteFields[0], /E-mail do convidado/);
  assert.match(inviteFields[0], /type="email"[^>]*required/);
  assert.match(inviteFields[1], /Tipo de usuário/);
  assert.match(inviteFields[1], /value="Analista"/);
  assert.match(inviteFields[1], /value="Administrador"/);
  assert.doesNotMatch(createForm, /id="userCreatePassword(?:Confirm)?"/);
  assert.match(source, /Convite enviado\. O usuário receberá um e-mail com as instruções para configurar seu acesso\./);
});

test("invite callback scrubs its token fragment before establishing the session", () => {
  const callback = source.slice(source.indexOf("async function consumeInvitationCallback()"), source.indexOf("function applyEnvironmentConfig()"));
  const consume = callback.slice(0, callback.indexOf("function showInvitationAcceptView("));
  const accept = callback.slice(callback.indexOf("async function handleInvitationAcceptance("), callback.indexOf("async function handleCancelInvitationAcceptance()"));
  assert.ok(callback.includes('params.get("type") !== "invite"'));
  assert.ok(callback.indexOf("history.replaceState") < callback.indexOf("auth.setSession"));
  assert.match(consume, /gll_invite/);
  assert.doesNotMatch(consume, /verifyOtp|setSession/);
  assert.match(accept, /event\?\.isTrusted/);
  assert.match(accept, /verifyOtp\(\{[\s\S]*token_hash:[\s\S]*type: "invite"/);
  assert.match(accept, /Este convite expirou ou já foi usado/);
  assert.match(callback, /access_token/);
  assert.match(callback, /refresh_token/);
});

test("first access uses the invited email and requires profile details and a confirmed password", () => {
  assert.match(html, /<h1>Configure seu acesso ao GLL<\/h1>/);
  assert.match(html, /id="firstAccessEmail"[^>]*readonly/);
  assert.match(html, /id="firstAccessRole"[^>]*readonly/);
  assert.doesNotMatch(html, /firstAccessUsername|Login \/ nome de usuário/);
  assert.match(html, /id="loginEmail" name="email" type="email" autocomplete="email" required/);
  assert.match(html, /id="firstAccessPasswordConfirm"[^>]*autocomplete="new-password"[^>]*required/);
  assert.match(html, /id="firstAccessPhotoMount"/);
  assert.match(source, /auth\.signInWithPassword\(\{\s*email: normalizeEmail\(email\)/);
  assert.doesNotMatch(source, /firstAccessUsername|usernamePattern|reservedUsernames/);
  assert.match(source, /As senhas não coincidem\./);
  assert.match(source, /Seu acesso foi configurado com sucesso\. Bem-vindo ao GLL!/);
});

test("invitation list includes status, responsible admin and guarded actions", () => {
  assert.match(html, /id="userInvitationsPanel"/);
  assert.match(html, /<th>Status<\/th>/);
  assert.match(html, /Administrador responsável/);
  assert.match(source, /responsibleAdmin/);
  assert.match(source, /data-invitation-action="resend"/);
  assert.match(source, /data-invitation-action="revoke"/);
  assert.match(source, /if \(!button \|\| !isCurrentUserAdmin\(\)/);
});
