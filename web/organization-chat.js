function createOrganizationChat({ getClient, getOrganizationId, getOrganizationName, getUserId }) {
  const byId = (id) => document.getElementById(id);
  let refreshTimer = null;
  let requestNumber = 0;
  let loading = false;

  function close() {
    clearInterval(refreshTimer);
    refreshTimer = null;
    requestNumber += 1;
    const dialog = byId("organizationChatDialog");
    if (dialog.open) dialog.close();
  }

  async function refresh() {
    const dialog = byId("organizationChatDialog");
    if (!dialog.open || loading || !getClient() || !getOrganizationId()) return;
    const request = requestNumber;
    loading = true;
    try {
      const client = getClient();
      const organizationId = getOrganizationId();
      const [membersResult, messagesResult] = await Promise.all([
        client.from("app_users").select("auth_user_id,name,access_revoked_at").eq("organization_id", organizationId),
        client.from("organization_messages").select("id,sender_id,body,created_at").eq("organization_id", organizationId).order("created_at", { ascending: false }).order("id", { ascending: false }).limit(100),
      ]);
      if (membersResult.error) throw membersResult.error;
      if (messagesResult.error) throw messagesResult.error;
      if (!dialog.open || request !== requestNumber) return;
      const members = (membersResult.data || []).filter((member) => !member.access_revoked_at);
      const names = new Map(members.map((member) => [member.auth_user_id, member.name]));
      byId("organizationChatSubtitle").textContent = `${getOrganizationName() || "Organização"} · ${members.length} integrante${members.length === 1 ? "" : "s"}`;
      const list = byId("organizationChatMessages");
      const atBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 80;
      list.replaceChildren();
      const rows = (messagesResult.data || []).reverse();
      if (!rows.length) {
        const empty = document.createElement("p");
        empty.className = "organization-chat-empty";
        empty.textContent = "Nenhuma mensagem ainda. Inicie a conversa com sua equipe.";
        list.append(empty);
      }
      for (const row of rows) {
        const article = document.createElement("article");
        article.className = `organization-chat-message${row.sender_id === getUserId() ? " is-own" : ""}`;
        const meta = document.createElement("div");
        meta.className = "organization-chat-message-meta";
        const author = document.createElement("strong");
        author.textContent = row.sender_id === getUserId() ? "Você" : names.get(row.sender_id) || "Integrante";
        const time = document.createElement("time");
        time.dateTime = row.created_at;
        time.textContent = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(row.created_at));
        const body = document.createElement("p");
        body.textContent = row.body;
        meta.append(author, time);
        article.append(meta, body);
        list.append(article);
      }
      if (atBottom) list.scrollTop = list.scrollHeight;
      byId("organizationChatError").textContent = "";
    } catch (error) {
      if (dialog.open && request === requestNumber) byId("organizationChatError").textContent = error.message || "Não foi possível carregar as mensagens.";
    } finally {
      loading = false;
    }
  }

  async function open() {
    const dialog = byId("organizationChatDialog");
    byId("organizationChatError").textContent = "";
    byId("organizationChatMessages").textContent = "Carregando mensagens…";
    byId("organizationChatSubtitle").textContent = getOrganizationName() || "Organização";
    dialog.showModal();
    byId("organizationChatInput").focus();
    if (!getClient() || !getOrganizationId() || !getUserId()) {
      byId("organizationChatMessages").textContent = "As mensagens estão disponíveis após entrar no ambiente conectado à organização.";
      byId("organizationChatForm").hidden = true;
      return;
    }
    byId("organizationChatForm").hidden = false;
    await refresh();
    refreshTimer = setInterval(() => { if (!document.hidden) void refresh(); }, 5000);
  }

  async function send(event) {
    event.preventDefault();
    const input = byId("organizationChatInput");
    const body = input.value.trim();
    if (!body || !getClient() || !getOrganizationId() || !getUserId()) return;
    const button = byId("organizationChatSendButton");
    button.disabled = true;
    byId("organizationChatError").textContent = "";
    try {
      const { error } = await getClient().from("organization_messages").insert({ organization_id: getOrganizationId(), sender_id: getUserId(), body });
      if (error) throw error;
      input.value = "";
      await refresh();
      byId("organizationChatMessages").scrollTop = byId("organizationChatMessages").scrollHeight;
      input.focus();
    } catch (error) {
      byId("organizationChatError").textContent = error.message || "Não foi possível enviar a mensagem.";
    } finally {
      button.disabled = false;
    }
  }

  function bind() {
    byId("organizationChatButton").addEventListener("click", () => { void open(); });
    byId("closeOrganizationChatButton").addEventListener("click", close);
    byId("organizationChatDialog").addEventListener("close", close);
    byId("organizationChatForm").addEventListener("submit", (event) => { void send(event); });
    byId("organizationChatInput").addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        byId("organizationChatForm").requestSubmit();
      }
    });
  }

  return { bind, close };
}

window.GLLOrganizationChat = { createOrganizationChat };
