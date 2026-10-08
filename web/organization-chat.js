function createOrganizationChat({ getClient, getOrganizationId, getOrganizationName, getUserId }) {
  const byId = (id) => document.getElementById(id);
  const emojiOptions = ["❤️", "👍", "😂", "🎉", "👀", "👌"];
  const avatarCache = new Map();
  const sessionId = crypto.randomUUID();
  let refreshTimer = null;
  let presenceTimer = null;
  let typingTimer = null;
  let presenceQueue = Promise.resolve();
  let requestNumber = 0;
  let loading = false;
  let active = false;
  let isTyping = false;
  let lastTypingWrite = 0;
  let replyTo = null;
  let pickerMessageId = null;
  let sendingMessage = null;
  let failedMessages = [];
  let messages = [];
  let reactions = [];
  let reads = [];
  let presence = [];
  let members = new Map();
  let parentMessages = new Map();
  let lastRenderSignature = "";
  let unreadCount = 0;
  let unreadTrackingEnabled = false;
  let unreadRefreshRequest = 0;
  let unreadRefreshTimer = null;
  const handledIncomingMessageIds = new Set();

  const formatTime = (value) => new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
  const isRecent = (value, seconds) => value && Date.now() - new Date(value).getTime() < seconds * 1000;
  const displayName = (member) => member?.display_name || member?.full_name || member?.name || "Integrante";
  const ownName = () => displayName(members.get(getUserId()));

  function setUnreadCount(value) {
    unreadCount = Math.max(0, Number(value) || 0);
    const button = byId("organizationChatButton");
    const counter = byId("organizationChatUnreadCount");
    const label = unreadCount
      ? `Mensagens da organização, ${unreadCount} ${unreadCount === 1 ? "mensagem não lida" : "mensagens não lidas"}`
      : "Mensagens da organização";
    if (button) {
      button.setAttribute("aria-label", label);
      button.title = label;
    }
    if (counter) {
      counter.hidden = unreadCount === 0;
      counter.textContent = unreadCount > 99 ? "99+" : String(unreadCount);
    }
    for (const element of [button, counter]) {
      if (unreadCount > 0) element?.classList.add("has-unread");
      else element?.classList.remove("has-unread");
    }
  }

  function queueUnreadCountRefresh() {
    clearTimeout(unreadRefreshTimer);
    unreadRefreshTimer = setTimeout(() => {
      unreadRefreshTimer = null;
      void refreshUnreadCount();
    }, 100);
  }

  async function refreshUnreadCount() {
    if (!unreadTrackingEnabled) return;
    const client = getClient();
    const organizationId = getOrganizationId();
    const userId = getUserId();
    if (!client || !organizationId || !userId) {
      setUnreadCount(0);
      return;
    }
    const request = ++unreadRefreshRequest;
    try {
      const [messageResult, readResult] = await Promise.all([
        client.from("organization_messages").select("id", { count: "exact", head: true })
          .eq("organization_id", organizationId).neq("sender_id", userId),
        client.from("organization_message_reads").select("message_id", { count: "exact", head: true })
          .eq("organization_id", organizationId).eq("reader_id", userId),
      ]);
      if (messageResult.error) throw messageResult.error;
      if (readResult.error) throw readResult.error;
      if (request !== unreadRefreshRequest || client !== getClient() || organizationId !== getOrganizationId() || userId !== getUserId()) return;
      const next = Math.max(0, (messageResult.count || 0) - (readResult.count || 0));
      setUnreadCount(next);
    } catch (error) {
      if (request === unreadRefreshRequest) console.warn(error.message || "Não foi possível atualizar as mensagens não lidas.");
    }
  }

  function handleIncomingMessage(payload) {
    if (!unreadTrackingEnabled) return;
    const row = payload?.new;
    const organizationId = getOrganizationId();
    const userId = getUserId();
    if (!row || row.organization_id !== organizationId || row.sender_id === userId || row.id == null) return;
    if (handledIncomingMessageIds.has(row.id)) return;
    handledIncomingMessageIds.add(row.id);
    if (handledIncomingMessageIds.size > 256) handledIncomingMessageIds.delete(handledIncomingMessageIds.values().next().value);
    unreadRefreshRequest += 1;
    if (active) {
      void refresh();
      return;
    }
    setUnreadCount(unreadCount + 1);
    queueUnreadCountRefresh();
  }

  function startUnreadTracking() {
    unreadTrackingEnabled = true;
    handledIncomingMessageIds.clear();
    return refreshUnreadCount();
  }

  function stopUnreadTracking() {
    unreadTrackingEnabled = false;
    unreadRefreshRequest += 1;
    clearTimeout(unreadRefreshTimer);
    unreadRefreshTimer = null;
    handledIncomingMessageIds.clear();
    setUnreadCount(0);
  }

  function queuePresence(typing = false) {
    if (!active || !getClient() || !getOrganizationId() || !getUserId()) return;
    const client = getClient();
    const now = new Date().toISOString();
    const payload = {
      organization_id: getOrganizationId(),
      user_id: getUserId(),
      session_id: sessionId,
      last_seen_at: now,
      typing_at: typing ? now : null,
    };
    presenceQueue = presenceQueue.catch(() => undefined).then(async () => {
      if (!active) return;
      const { error } = await client.from("organization_chat_presence").upsert(payload, {
        onConflict: "organization_id,user_id,session_id",
      });
      if (error) console.warn("Não foi possível atualizar a presença no chat.");
    });
  }

  function stopTyping() {
    clearTimeout(typingTimer);
    typingTimer = null;
    if (!isTyping) return;
    isTyping = false;
    queuePresence(false);
  }

  function close() {
    const dialog = byId("organizationChatDialog");
    if (!active && !dialog.open) return;
    const wasActive = active;
    active = false;
    clearInterval(refreshTimer);
    clearInterval(presenceTimer);
    clearTimeout(typingTimer);
    refreshTimer = presenceTimer = typingTimer = null;
    requestNumber += 1;
    lastRenderSignature = "";
    isTyping = false;
    replyTo = null;
    pickerMessageId = null;
    if (dialog.open) dialog.close();
    if (wasActive && getClient() && getOrganizationId() && getUserId()) {
      const client = getClient();
      const organizationId = getOrganizationId();
      const userId = getUserId();
      presenceQueue = presenceQueue.catch(() => undefined).then(() =>
        client.from("organization_chat_presence").delete()
          .eq("organization_id", organizationId).eq("user_id", userId).eq("session_id", sessionId));
    }
  }

  async function signedAvatarUrls(rows) {
    const now = Date.now();
    const paths = [...new Set(rows.map((member) => member.avatar_path).filter(Boolean))]
      .filter((path) => !avatarCache.get(path) || avatarCache.get(path).expiresAt < now + 60_000);
    if (!paths.length) return;
    const { data, error } = await getClient().storage.from("profile-avatars").createSignedUrls(paths, 3600);
    if (error) return;
    (data || []).forEach((entry, index) => {
      if (entry.signedUrl && !entry.error) {
        avatarCache.set(entry.path || paths[index], { url: entry.signedUrl, expiresAt: now + 3_000_000 });
      }
    });
  }

  function memberAvatar(userId) {
    const member = members.get(userId);
    const name = displayName(member);
    const wrap = document.createElement("span");
    wrap.className = "organization-chat-avatar";
    const cached = member?.avatar_path && avatarCache.get(member.avatar_path);
    if (cached?.url && cached.expiresAt > Date.now()) {
      const img = document.createElement("img");
      img.src = cached.url;
      img.alt = "";
      wrap.append(img);
    } else {
      wrap.textContent = name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
    }
    if (presence.some((entry) => entry.user_id === userId && isRecent(entry.last_seen_at, 45))) {
      const dot = document.createElement("span");
      dot.className = "organization-chat-online";
      dot.title = `${name} online no chat`;
      wrap.append(dot);
    }
    return wrap;
  }

  function createButton(label, action, extra = {}) {
    const button = document.createElement("button");
    button.type = "button";
    if (extra.icon) {
      button.innerHTML = window.GLLDesignSystem.iconMarkup(extra.icon);
      button.setAttribute("aria-label", label);
      button.title = label;
    } else {
      button.textContent = label;
    }
    button.dataset.chatAction = action;
    if (extra.emoji) button.dataset.emoji = extra.emoji;
    if (extra.pressed !== undefined) button.setAttribute("aria-pressed", String(extra.pressed));
    if (extra.title) button.title = extra.title;
    return button;
  }

  function renderReplyPreview() {
    const preview = byId("organizationChatReplyPreview");
    preview.hidden = !replyTo;
    if (!replyTo) return;
    byId("organizationChatReplyAuthor").textContent = `Respondendo a ${replyTo.sender_id === getUserId() ? "você" : displayName(members.get(replyTo.sender_id))}`;
    byId("organizationChatReplyBody").textContent = replyTo.body;
  }

  function renderTyping() {
    const users = [...new Set(presence
      .filter((entry) => entry.user_id !== getUserId() && isRecent(entry.last_seen_at, 45) && isRecent(entry.typing_at, 6))
      .map((entry) => entry.user_id))];
    const indicator = byId("organizationChatTyping");
    indicator.hidden = users.length === 0;
    if (!users.length) return;
    indicator.replaceChildren();
    indicator.append(memberAvatar(users[0]));
    const text = document.createElement("span");
    const names = users.map((id) => displayName(members.get(id)));
    text.textContent = `${names.join(", ")} ${users.length === 1 ? "está" : "estão"} digitando…`;
    indicator.append(text);
  }

  function renderMessageHeader(row, own) {
    const header = document.createElement("div");
    header.className = "organization-chat-message-header";
    const author = document.createElement("strong");
    author.className = "organization-chat-message-author";
    author.textContent = own ? "Você" : displayName(members.get(row.sender_id));
    header.append(author);
    return header;
  }

  function renderMessageBubble(row, own, pending) {
    const bubble = document.createElement("div");
    bubble.className = `organization-chat-bubble${own ? " is-own" : ""}`;
    const parent = row.reply_to_id && (messages.find((message) => message.id === row.reply_to_id) || parentMessages.get(row.reply_to_id));
    if (parent) {
      const quote = document.createElement("blockquote");
      quote.className = "organization-chat-quote";
      const name = document.createElement("strong");
      name.textContent = parent.sender_id === getUserId() ? "Você" : displayName(members.get(parent.sender_id));
      const body = document.createElement("span");
      body.textContent = parent.body;
      quote.append(name, body);
      bubble.append(quote);
    }

    const body = document.createElement("p");
    body.className = "organization-chat-message-body";
    body.textContent = row.body;
    bubble.append(body);

    if (!pending) {
      const messageReactions = reactions.filter((reaction) => reaction.message_id === row.id);
      const chips = document.createElement("div");
      chips.className = "organization-chat-reactions";
      for (const emoji of emojiOptions) {
        const matching = messageReactions.filter((reaction) => reaction.emoji === emoji);
        if (!matching.length) continue;
        const mine = matching.some((reaction) => reaction.reactor_id === getUserId());
        const chip = createButton(`${emoji} ${matching.length}`, "react", {
          emoji, pressed: mine, title: `${mine ? "Remover" : "Adicionar"} reação ${emoji}`,
        });
        chip.className = "organization-chat-reaction";
        chips.append(chip);
      }
      if (chips.childElementCount) bubble.append(chips);
      if (pickerMessageId === row.id) {
        const picker = document.createElement("div");
        picker.className = "organization-chat-picker";
        picker.setAttribute("aria-label", "Escolher reação");
        for (const emoji of emojiOptions) {
          const mine = messageReactions.some((reaction) => reaction.emoji === emoji && reaction.reactor_id === getUserId());
          const option = createButton(emoji, "react", { emoji, pressed: mine, title: `Reagir com ${emoji}` });
          picker.append(option);
        }
        bubble.append(picker);
      }
    }
    return bubble;
  }

  function renderMessageFooter(row, own, pending) {
    const footer = document.createElement("div");
    footer.className = "organization-chat-message-footer";
    if (row.created_at) {
      const time = document.createElement("time");
      time.className = "organization-chat-message-time";
      time.dateTime = row.created_at;
      time.textContent = formatTime(row.created_at);
      footer.append(time);
    }

    if (pending) {
      const status = document.createElement("span");
      status.className = `organization-chat-status${row.status === "failed" ? " is-failed" : ""}`;
      status.textContent = row.status === "failed" ? "Falha ao enviar" : "Enviando…";
      footer.append(status);
      if (row.status === "failed") footer.append(createButton("Tentar novamente", "retry", { title: "Tentar reenviar a mensagem" }));
    } else {
      if (own) {
        const recipients = [...members.values()].filter((member) => member.auth_user_id !== getUserId() && !member.access_revoked_at);
        const receipt = reads.filter((entry) => entry.message_id === row.id && recipients.some((member) => member.auth_user_id === entry.reader_id));
        const status = document.createElement("span");
        status.className = "organization-chat-status";
        status.textContent = recipients.length && receipt.length === recipients.length ? "Lida" : "Enviada";
        if (receipt.length) {
          status.title = `Lida por ${receipt.length} de ${recipients.length} integrante${recipients.length === 1 ? "" : "s"}`;
          const latest = receipt.map((entry) => entry.read_at).sort().at(-1);
          if (receipt.length === recipients.length && latest) status.title += ` · ${formatTime(latest)}`;
        }
        footer.append(status);
      }
    }
    return footer.childElementCount ? footer : null;
  }

  function renderMessageActions() {
    const actions = document.createElement("div");
    actions.className = "organization-chat-actions";
    actions.append(
      createButton("Reagir à mensagem", "picker", { icon: "smilePlus" }),
      createButton("Responder à mensagem", "reply", { icon: "messageReply" }),
    );
    return actions;
  }

  function renderMessage(row, pending = false, { showHeader = true, showAvatar = true } = {}) {
    const own = row.sender_id === getUserId();
    const article = document.createElement("article");
    article.className = `organization-chat-message${own ? " is-own" : ""}${pending ? " is-pending" : ""}`;
    if (!pending) article.dataset.messageId = String(row.id);
    else if (row.failedId) article.dataset.failedId = row.failedId;

    const avatar = showAvatar ? memberAvatar(row.sender_id) : document.createElement("span");
    if (!showAvatar) {
      avatar.className = "organization-chat-avatar organization-chat-avatar-placeholder";
      avatar.setAttribute("aria-hidden", "true");
    }
    article.append(avatar);

    const content = document.createElement("div");
    content.className = "organization-chat-message-content";
    if (!pending) {
      content.tabIndex = 0;
      content.setAttribute("aria-label", `Mensagem de ${own ? "você" : displayName(members.get(row.sender_id))}: ${row.body}`);
    }
    if (showHeader) content.append(renderMessageHeader(row, own));
    content.append(renderMessageBubble(row, own, pending));
    const footer = renderMessageFooter(row, own, pending);
    if (footer) content.append(footer);
    if (!pending) content.append(renderMessageActions());
    article.append(content);
    return article;
  }

  function renderMessageGroup(group) {
    const wrapper = document.createElement("div");
    wrapper.className = `organization-chat-message-group${group.senderId === getUserId() ? " is-own" : ""}`;
    group.entries.forEach((entry, index) => {
      wrapper.append(renderMessage(entry.row, entry.pending, {
        showHeader: index === 0,
        showAvatar: index === group.entries.length - 1,
      }));
    });
    return wrapper;
  }

  function renderMessages() {
    const signature = JSON.stringify({ messages, reactions, reads, presence, members: [...members.values()],
      avatars: [...members.values()].map((member) => avatarCache.get(member.avatar_path)?.url), pickerMessageId, sendingMessage, failedMessages,
      online: presence.filter((entry) => isRecent(entry.last_seen_at, 45)).map((entry) => entry.user_id) });
    if (signature === lastRenderSignature) { renderTyping(); return; }
    lastRenderSignature = signature;
    const list = byId("organizationChatMessages");
    const atBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 80;
    list.replaceChildren();
    if (!messages.length && !sendingMessage && !failedMessages.length) {
      const empty = document.createElement("p");
      empty.className = "organization-chat-empty";
      empty.textContent = "Nenhuma mensagem ainda. Inicie a conversa com sua equipe.";
      list.append(empty);
    }
    const entries = [
      ...messages.map((row) => ({ row, pending: false })),
      ...failedMessages.map((row) => ({ row, pending: true })),
      ...(sendingMessage ? [{ row: sendingMessage, pending: true }] : []),
    ];
    const groups = [];
    for (const entry of entries) {
      const lastGroup = groups.at(-1);
      if (!entry.pending && lastGroup && !lastGroup.pending && lastGroup.senderId === entry.row.sender_id) {
        lastGroup.entries.push(entry);
      } else {
        groups.push({ senderId: entry.row.sender_id, pending: entry.pending, entries: [entry] });
      }
    }
    for (const group of groups) list.append(renderMessageGroup(group));
    if (atBottom) list.scrollTop = list.scrollHeight;
    renderReplyPreview();
    renderTyping();
  }

  async function refresh() {
    if (!active || loading || !getClient() || !getOrganizationId()) return;
    const request = requestNumber;
    loading = true;
    try {
      const client = getClient();
      const organizationId = getOrganizationId();
      const [memberResult, messageResult, presenceResult] = await Promise.all([
        client.from("app_users").select("auth_user_id,name,full_name,display_name,avatar_path,access_revoked_at").eq("organization_id", organizationId),
        client.from("organization_messages").select("id,sender_id,body,created_at,reply_to_id").eq("organization_id", organizationId)
          .order("created_at", { ascending: false }).order("id", { ascending: false }).limit(100),
        client.from("organization_chat_presence").select("user_id,last_seen_at,typing_at").eq("organization_id", organizationId),
      ]);
      for (const result of [memberResult, messageResult, presenceResult]) if (result.error) throw result.error;
      if (!active || request !== requestNumber) return;
      const rows = (messageResult.data || []).reverse();
      const ids = rows.map((row) => row.id);
      const missingParents = [...new Set(rows.map((row) => row.reply_to_id).filter((id) =>
        id && !rows.some((message) => message.id === id) && !parentMessages.has(id)))];
      const [reactionResult, readResult, parentResult] = await Promise.all([
        ids.length ? client.from("organization_message_reactions").select("message_id,reactor_id,emoji").eq("organization_id", organizationId).in("message_id", ids) : { data: [] },
        ids.length ? client.from("organization_message_reads").select("message_id,reader_id,read_at").eq("organization_id", organizationId).in("message_id", ids) : { data: [] },
        missingParents.length ? client.from("organization_messages").select("id,sender_id,body").eq("organization_id", organizationId).in("id", missingParents) : { data: [] },
      ]);
      for (const result of [reactionResult, readResult, parentResult]) if (result.error) throw result.error;
      if (!active || request !== requestNumber) return;
      const memberRows = (memberResult.data || []).filter((member) => !member.access_revoked_at);
      await signedAvatarUrls(memberRows);
      if (!active || request !== requestNumber) return;
      members = new Map(memberRows.map((member) => [member.auth_user_id, member]));
      messages = rows;
      reactions = reactionResult.data || [];
      reads = readResult.data || [];
      presence = presenceResult.data || [];
      for (const parent of parentResult.data || []) parentMessages.set(parent.id, parent);
      byId("organizationChatSubtitle").textContent = `${getOrganizationName() || "Organização"} · ${members.size} integrante${members.size === 1 ? "" : "s"}`;
      renderMessages();
      byId("organizationChatError").textContent = "";
      const alreadyRead = new Set(reads.filter((entry) => entry.reader_id === getUserId()).map((entry) => entry.message_id));
      const unread = rows.filter((row) => row.sender_id !== getUserId() && !alreadyRead.has(row.id));
      if (unread.length) {
        const { error } = await client.from("organization_message_reads").upsert(
          unread.map((row) => ({ message_id: row.id, organization_id: organizationId, reader_id: getUserId() })),
          { onConflict: "message_id,reader_id", ignoreDuplicates: true },
        );
        if (error) console.warn("Não foi possível registrar a leitura das mensagens.");
        else {
          unreadRefreshRequest += 1;
          setUnreadCount(unreadCount - unread.length);
          void refreshUnreadCount();
        }
      }
    } catch (error) {
      if (active && request === requestNumber) byId("organizationChatError").textContent = error.message || "Não foi possível carregar as mensagens.";
    } finally {
      loading = false;
    }
  }

  async function open() {
    const dialog = byId("organizationChatDialog");
    if (dialog.open) return;
    byId("organizationChatError").textContent = "";
    byId("organizationChatMessages").textContent = "Carregando mensagens…";
    lastRenderSignature = "";
    byId("organizationChatSubtitle").textContent = getOrganizationName() || "Organização";
    dialog.showModal();
    byId("organizationChatInput").focus();
    if (!getClient() || !getOrganizationId() || !getUserId()) {
      byId("organizationChatMessages").textContent = "As mensagens estão disponíveis após entrar no ambiente conectado à organização.";
      byId("organizationChatForm").hidden = true;
      return;
    }
    byId("organizationChatForm").hidden = false;
    active = true;
    queuePresence(false);
    await refresh();
    if (!active) return;
    refreshTimer = setInterval(() => { if (!document.hidden) void refresh(); }, 3000);
    presenceTimer = setInterval(() => { if (!document.hidden) queuePresence(isTyping); }, 15000);
  }

  async function send(message) {
    if (!message.body.trim() || !active || !getClient() || sendingMessage) return;
    const button = byId("organizationChatSendButton");
    button.disabled = true;
    sendingMessage = { ...message, sender_id: getUserId(), status: "sending", failedId: message.failedId || crypto.randomUUID(),
      client_message_id: message.client_message_id || crypto.randomUUID() };
    renderMessages();
    byId("organizationChatError").textContent = "";
    try {
      const { error } = await getClient().from("organization_messages").upsert({
        organization_id: getOrganizationId(), sender_id: getUserId(),
        body: message.body.trim(), reply_to_id: message.reply_to_id || null,
        client_message_id: sendingMessage.client_message_id,
      }, { onConflict: "organization_id,client_message_id", ignoreDuplicates: true });
      if (error) throw error;
      sendingMessage = null;
      stopTyping();
      await refresh();
      byId("organizationChatInput").focus();
    } catch (error) {
      failedMessages.push({ ...sendingMessage, status: "failed", error: error.message });
      sendingMessage = null;
      renderMessages();
      byId("organizationChatError").textContent = "Não foi possível enviar. Use “Tentar novamente” na mensagem.";
    } finally {
      button.disabled = false;
    }
  }

  async function toggleReaction(messageId, emoji) {
    if (!emojiOptions.includes(emoji)) return;
    const mine = reactions.some((entry) => entry.message_id === messageId && entry.reactor_id === getUserId() && entry.emoji === emoji);
    const table = getClient().from("organization_message_reactions");
    const result = mine
      ? await table.delete().eq("organization_id", getOrganizationId()).eq("message_id", messageId).eq("reactor_id", getUserId()).eq("emoji", emoji)
      : await table.insert({ organization_id: getOrganizationId(), message_id: messageId, reactor_id: getUserId(), emoji });
    if (result.error) {
      byId("organizationChatError").textContent = result.error.message;
      return;
    }
    pickerMessageId = null;
    await refresh();
  }

  function handleMessageClick(event) {
    const button = event.target.closest("[data-chat-action]");
    if (!button) return;
    const action = button.dataset.chatAction;
    if (action === "retry") {
      if (sendingMessage) return;
      const failedId = button.closest("[data-failed-id]")?.dataset.failedId;
      const index = failedMessages.findIndex((entry) => entry.failedId === failedId);
      const failed = index >= 0 ? failedMessages.splice(index, 1)[0] : null;
      if (failed) void send(failed);
      return;
    }
    const messageId = Number(button.closest("[data-message-id]")?.dataset.messageId);
    const row = messages.find((message) => message.id === messageId);
    if (!row) return;
    if (action === "reply") {
      replyTo = row;
      pickerMessageId = null;
      renderMessages();
      renderReplyPreview();
      byId("organizationChatInput").focus();
    } else if (action === "picker") {
      pickerMessageId = pickerMessageId === messageId ? null : messageId;
      renderMessages();
      if (pickerMessageId) byId("organizationChatMessages").querySelector(`[data-message-id="${messageId}"] .organization-chat-picker button`)?.focus();
      else byId("organizationChatMessages").querySelector(`[data-message-id="${messageId}"] [data-chat-action="picker"]`)?.focus();
    } else if (action === "react") {
      void toggleReaction(messageId, button.dataset.emoji);
    }
  }

  function handleTyping() {
    clearTimeout(typingTimer);
    if (!byId("organizationChatInput").value.trim()) {
      stopTyping();
      return;
    }
    isTyping = true;
    if (Date.now() - lastTypingWrite > 2500) {
      lastTypingWrite = Date.now();
      queuePresence(true);
    }
    typingTimer = setTimeout(stopTyping, 2800);
  }

  function bind() {
    byId("organizationChatButton").addEventListener("click", () => { void open(); });
    byId("closeOrganizationChatButton").addEventListener("click", close);
    const dialog = byId("organizationChatDialog");
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) close();
    });
    dialog.addEventListener("close", close);
    byId("organizationChatMessages").addEventListener("click", handleMessageClick);
    byId("organizationChatCancelReplyButton").addEventListener("click", () => { replyTo = null; renderReplyPreview(); });
    byId("organizationChatForm").addEventListener("submit", (event) => {
      event.preventDefault();
      if (sendingMessage) return;
      const input = byId("organizationChatInput");
      const body = input.value.trim();
      if (!body) return;
      const message = { body, reply_to_id: replyTo?.id || null };
      input.value = "";
      replyTo = null;
      renderReplyPreview();
      void send(message);
    });
    byId("organizationChatInput").addEventListener("input", handleTyping);
    byId("organizationChatInput").addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        byId("organizationChatForm").requestSubmit();
      }
    });
  }

  return { bind, close, handleIncomingMessage, refreshUnreadCount, startUnreadTracking, stopUnreadTracking };
}

window.GLLOrganizationChat = { createOrganizationChat };
