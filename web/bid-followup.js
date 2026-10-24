export function createBidFollowupFeature({
  getClient,
  getBid,
  getUsers,
  getUserId,
  formatBidLabel = (bid) => bid?.edital_number || `Edital ${bid?.id || ""}`,
  onNotificationsChanged = () => {},
  onMessageCreated = () => {},
}) {
  const byId = (id) => document.getElementById(id);
  const dialog = byId("bidFollowupDrawer");
  const messagesHost = byId("bidFollowupMessages");
  const input = byId("bidFollowupInput");
  const form = byId("bidFollowupForm");
  const suggestions = byId("bidFollowupSuggestions");
  const sendButton = byId("bidFollowupSendButton");
  const errorNode = byId("bidFollowupError");
  const emptyNode = byId("bidFollowupEmpty");
  const submitLabel = byId("bidFollowupSubmitLabel");

  let active = false;
  let timer = null;
  let activeBidId = null;
  let highlightedMessageId = null;
  let messages = [];
  let messageMentions = [];
  let mentionRanges = [];
  let draftBeforeEdit = "";
  let mentionContext = null;
  let selectedSuggestionIndex = 0;
  let messageRequest = 0;
  let notificationRequest = 0;

  const displayName = (user) => String(user?.display_name || user?.full_name || user?.name || user?.email || "Integrante").trim();
  const escapeSelectorValue = (value) => globalThis.CSS?.escape ? CSS.escape(String(value)) : String(value).replace(/[^a-zA-Z0-9_-]/g, "\\$&");
  const codePointLength = (value) => Array.from(value).length;
  const codePointToUtf16 = (value, offset) => Array.from(value).slice(0, Math.max(0, offset)).join("").length;
  const utf16ToCodePoint = (value, offset) => codePointLength(value.slice(0, offset));

  function eligibleUsers(bid) {
    const currentUserId = getUserId();
    return (getUsers() || [])
      .filter((user) => {
        if (!user?.auth_user_id || user.auth_user_id === currentUserId) return false;
        if (user.access_revoked_at || user.auth_access_status === "revoked" || user.auth_access_status === "pending" || user.must_change_password) return false;
        return user.role === "Administrador" || bid?.created_by === user.auth_user_id || bid?.assigned_to === user.auth_user_id;
      })
      .sort((a, b) => displayName(a).localeCompare(displayName(b), "pt-BR"));
  }

  function setError(message = "") {
    errorNode.textContent = message;
    errorNode.classList.toggle("hidden", !message);
  }

  function setComposerEnabled(enabled) {
    input.disabled = !enabled;
    sendButton.disabled = !enabled;
    submitLabel.textContent = enabled ? "Enviar" : "Enviando…";
  }

  function currentMentionQuery() {
    const caret = input.selectionStart ?? input.value.length;
    const beforeCaret = input.value.slice(0, caret);
    const match = beforeCaret.match(/(^|\s)@([^\s@]*)$/u);
    if (!match) return null;
    const start = beforeCaret.length - match[0].length + match[1].length;
    return { start, end: caret, query: match[2] };
  }

  function matchingSuggestions(context) {
    const query = context?.query?.toLocaleLowerCase("pt-BR") || "";
    const alreadyMentioned = new Set(mentionRanges.map((mention) => mention.userId));
    return eligibleUsers(getBid())
      .filter((user) => !alreadyMentioned.has(user.auth_user_id)
        && displayName(user).toLocaleLowerCase("pt-BR").includes(query))
      .slice(0, 8);
  }

  function updateSuggestionState() {
    mentionContext = currentMentionQuery();
    const results = matchingSuggestions(mentionContext);
    suggestions.replaceChildren();
    if (!mentionContext || !results.length) {
      suggestions.hidden = true;
      input.setAttribute("aria-expanded", "false");
      return;
    }
    results.forEach((user, index) => {
      const option = document.createElement("button");
      option.type = "button";
      option.className = "bid-followup-suggestion";
      option.setAttribute("role", "option");
      option.setAttribute("aria-selected", String(index === selectedSuggestionIndex));
      option.dataset.userId = user.auth_user_id;
      const initials = displayName(user).split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toLocaleUpperCase("pt-BR");
      const avatar = document.createElement("span");
      avatar.className = "bid-followup-suggestion-avatar";
      avatar.setAttribute("aria-hidden", "true");
      avatar.textContent = initials || "U";
      const copy = document.createElement("span");
      copy.className = "bid-followup-suggestion-copy";
      const name = document.createElement("strong");
      name.textContent = displayName(user);
      const role = document.createElement("small");
      role.textContent = user.role || "Membro da organização";
      copy.append(name, role);
      option.append(avatar, copy);
      suggestions.append(option);
    });
    selectedSuggestionIndex = Math.min(selectedSuggestionIndex, results.length - 1);
    suggestions.hidden = false;
    input.setAttribute("aria-expanded", "true");
  }

  function updateMentionRanges(previousValue, nextValue) {
    if (!mentionRanges.length || previousValue === nextValue) return;
    let prefix = 0;
    while (prefix < previousValue.length && prefix < nextValue.length && previousValue[prefix] === nextValue[prefix]) prefix += 1;
    let oldEnd = previousValue.length;
    let newEnd = nextValue.length;
    while (oldEnd > prefix && newEnd > prefix && previousValue[oldEnd - 1] === nextValue[newEnd - 1]) {
      oldEnd -= 1;
      newEnd -= 1;
    }
    const delta = newEnd - oldEnd;
    mentionRanges = mentionRanges.flatMap((mention) => {
      if (mention.end <= prefix) return [mention];
      if (mention.start >= oldEnd) return [{ ...mention, start: mention.start + delta, end: mention.end + delta }];
      return [];
    }).filter((mention) => nextValue.slice(mention.start, mention.end) === mention.label);
  }

  function selectSuggestion(userId) {
    const user = eligibleUsers(getBid()).find((candidate) => candidate.auth_user_id === userId);
    if (!user || !mentionContext) return;
    const label = `@${displayName(user)}`;
    const before = input.value.slice(0, mentionContext.start);
    const after = input.value.slice(mentionContext.end);
    const nextValue = `${before}${label} ${after}`;
    const end = before.length + label.length;
    updateMentionRanges(input.value, nextValue);
    input.value = nextValue;
    mentionRanges.push({ userId, start: before.length, end, label });
    mentionRanges.sort((a, b) => a.start - b.start);
    draftBeforeEdit = nextValue;
    input.setSelectionRange(end + 1, end + 1);
    suggestions.hidden = true;
    input.setAttribute("aria-expanded", "false");
    mentionContext = null;
    resizeComposer();
    input.focus();
  }

  function resizeComposer() {
    input.style.height = "auto";
    input.style.height = `${Math.min(input.scrollHeight, 160)}px`;
  }

  function profileName(userId) {
    return displayName((getUsers() || []).find((user) => user.auth_user_id === userId));
  }

  function renderMessageBody(body, mentions, host) {
    const text = String(body || "");
    const ranges = (mentions || []).map((mention) => ({
      ...mention,
      start: codePointToUtf16(text, Number(mention.start_offset)),
      end: codePointToUtf16(text, Number(mention.end_offset)),
    })).filter((mention) => mention.start >= 0 && mention.end > mention.start && mention.end <= text.length)
      .sort((a, b) => a.start - b.start);
    let cursor = 0;
    for (const mention of ranges) {
      if (mention.start < cursor) continue;
      host.append(document.createTextNode(text.slice(cursor, mention.start)));
      const tag = document.createElement("span");
      tag.className = "bid-followup-mention";
      tag.textContent = text.slice(mention.start, mention.end);
      tag.title = `Menção a ${profileName(mention.recipient_user_id)}`;
      host.append(tag);
      cursor = mention.end;
    }
    host.append(document.createTextNode(text.slice(cursor)));
  }

  function renderMessages({ scrollToBottom = false } = {}) {
    const wasAtBottom = messagesHost.scrollHeight - messagesHost.scrollTop - messagesHost.clientHeight < 48;
    messagesHost.replaceChildren();
    emptyNode.hidden = messages.length > 0;
    if (!messages.length) {
      messagesHost.append(emptyNode);
      return;
    }
    for (const message of messages) {
      const article = document.createElement("article");
      article.className = `bid-followup-message${message.author_id === getUserId() ? " is-own" : ""}`;
      article.dataset.messageId = message.id;
      if (message.id === highlightedMessageId) article.classList.add("is-highlighted");
      const header = document.createElement("div");
      header.className = "bid-followup-message-header";
      const author = document.createElement("strong");
      author.textContent = message.author_name || profileName(message.author_id);
      const time = document.createElement("time");
      time.dateTime = message.created_at;
      time.textContent = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(message.created_at));
      header.append(author, time);
      const body = document.createElement("p");
      body.className = "bid-followup-message-body";
      renderMessageBody(message.body, messageMentions.filter((mention) => mention.message_id === message.id), body);
      article.append(header, body);
      messagesHost.append(article);
    }
    if (highlightedMessageId) {
      requestAnimationFrame(() => {
        const highlighted = messagesHost.querySelector(`[data-message-id="${escapeSelectorValue(highlightedMessageId)}"]`);
        highlighted?.scrollIntoView({ block: "center", behavior: "smooth" });
      });
    } else if (scrollToBottom || wasAtBottom) {
      messagesHost.scrollTop = messagesHost.scrollHeight;
    }
  }

  async function refreshMessages({ scrollToBottom = false } = {}) {
    const client = getClient();
    const bid = getBid();
    if (!client || !bid?.id) return;
    const request = ++messageRequest;
    const { data, error } = await client.from("bid_process_messages")
      .select("id,bid_id,author_id,author_name,body,created_at")
      .eq("bid_id", bid.id)
      .order("created_at", { ascending: false })
      .limit(250);
    if (error) throw error;
    if (!active || request !== messageRequest || activeBidId !== bid.id) return;
    const rows = (data || []).slice().reverse();
    let mentions = [];
    if (rows.length) {
      const result = await client.from("bid_message_mentions")
        .select("message_id,recipient_user_id,start_offset,end_offset")
        .in("message_id", rows.map((row) => row.id));
      if (result.error) throw result.error;
      mentions = result.data || [];
    }
    if (!active || request !== messageRequest || activeBidId !== bid.id) return;
    messages = rows;
    messageMentions = mentions;
    renderMessages({ scrollToBottom });
  }

  async function refreshNotifications() {
    const client = getClient();
    const recipientId = getUserId();
    const request = ++notificationRequest;
    if (!client || !recipientId) {
      onNotificationsChanged([]);
      return [];
    }
    const mentionsResult = await client.from("bid_message_mentions")
      .select("message_id,bid_id,created_at")
      .eq("recipient_user_id", recipientId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (mentionsResult.error) throw mentionsResult.error;
    const mentions = mentionsResult.data || [];
    if (!mentions.length) {
      if (request === notificationRequest) onNotificationsChanged([]);
      return [];
    }
    const messageResult = await client.from("bid_process_messages")
      .select("id,bid_id,body,author_id,author_name,created_at")
      .in("id", [...new Set(mentions.map((mention) => mention.message_id))]);
    if (messageResult.error) throw messageResult.error;
    const byId = new Map((messageResult.data || []).map((message) => [message.id, message]));
    const notifications = mentions.map((mention) => ({ ...mention, message: byId.get(mention.message_id) }))
      .filter((mention) => mention.message && mention.message.bid_id === mention.bid_id);
    if (request === notificationRequest) onNotificationsChanged(notifications);
    return notifications;
  }

  function open(messageId = null) {
    const bid = getBid();
    if (!bid?.id) return false;
    if (!dialog.open) dialog.showModal();
    if (activeBidId !== bid.id) {
      messages = [];
      messageMentions = [];
    }
    active = true;
    activeBidId = bid.id;
    highlightedMessageId = messageId;
    byId("bidFollowupSubtitle").textContent = `${formatBidLabel(bid)} · ${bid.buyer_agency || "Órgão não informado"}`;
    setError("");
    void refreshMessages({ scrollToBottom: !messageId }).catch((error) => setError(error.message || "Não foi possível carregar as atualizações deste edital."));
    clearInterval(timer);
    timer = setInterval(() => {
      if (active && !document.hidden) void refreshMessages().catch(() => {});
    }, 20_000);
    window.setTimeout(() => input.focus(), 50);
    return true;
  }

  function close() {
    active = false;
    messageRequest += 1;
    clearInterval(timer);
    timer = null;
    if (dialog.open) dialog.close();
    activeBidId = null;
    highlightedMessageId = null;
    suggestions.hidden = true;
    input.setAttribute("aria-expanded", "false");
    mentionContext = null;
    input.value = "";
    mentionRanges = [];
    draftBeforeEdit = "";
    resizeComposer();
  }

  async function submit(event) {
    event.preventDefault();
    const client = getClient();
    const bid = getBid();
    const body = input.value.trim();
    if (!client || !bid?.id || !body) return;
    const trimStart = input.value.length - input.value.trimStart().length;
    const normalizedMentions = mentionRanges
      .filter((mention) => input.value.slice(mention.start, mention.end) === mention.label)
      .map((mention) => ({
        user_id: mention.userId,
        start_offset: utf16ToCodePoint(body, Math.max(0, mention.start - trimStart)),
        end_offset: utf16ToCodePoint(body, Math.max(0, mention.end - trimStart)),
      }));
    setError("");
    setComposerEnabled(false);
    try {
      const { error } = await client.rpc("create_bid_process_message", {
        p_bid_id: bid.id,
        p_body: body,
        p_mentions: normalizedMentions,
      });
      if (error) throw error;
      input.value = "";
      mentionRanges = [];
      draftBeforeEdit = "";
      resizeComposer();
      await refreshMessages({ scrollToBottom: true });
      onMessageCreated();
    } catch (error) {
      setError(error.message || "Não foi possível enviar a atualização. Tente novamente.");
    } finally {
      setComposerEnabled(true);
      input.focus();
    }
  }

  function handleInput() {
    updateMentionRanges(draftBeforeEdit, input.value);
    draftBeforeEdit = input.value;
    selectedSuggestionIndex = 0;
    resizeComposer();
    updateSuggestionState();
  }

  function handleKeydown(event) {
    if (!suggestions.hidden) {
      const options = [...suggestions.querySelectorAll("[role=option]")];
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        const direction = event.key === "ArrowDown" ? 1 : -1;
        selectedSuggestionIndex = (selectedSuggestionIndex + direction + options.length) % options.length;
        options.forEach((option, index) => option.setAttribute("aria-selected", String(index === selectedSuggestionIndex)));
        options[selectedSuggestionIndex]?.scrollIntoView({ block: "nearest" });
        return;
      }
      if ((event.key === "Enter" || event.key === "Tab") && options.length) {
        event.preventDefault();
        selectSuggestion(options[selectedSuggestionIndex].dataset.userId);
        return;
      }
      if (event.key === "Escape") {
        suggestions.hidden = true;
        input.setAttribute("aria-expanded", "false");
      }
    }
  }

  function bind() {
    byId("bidFollowupButton").addEventListener("click", () => open());
    byId("closeBidFollowupButton").addEventListener("click", close);
    form.addEventListener("submit", submit);
    input.addEventListener("input", handleInput);
    input.addEventListener("keydown", handleKeydown);
    suggestions.addEventListener("mousedown", (event) => event.preventDefault());
    suggestions.addEventListener("click", (event) => {
      const option = event.target.closest("[data-user-id]");
      if (option) selectSuggestion(option.dataset.userId);
    });
    dialog.addEventListener("close", () => {
      active = false;
      clearInterval(timer);
      timer = null;
      activeBidId = null;
      highlightedMessageId = null;
      input.value = "";
      mentionRanges = [];
      draftBeforeEdit = "";
      resizeComposer();
    });
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) close();
    });
  }

  function updateAvailability(visible) {
    byId("bidFollowupButton").classList.toggle("hidden", !visible);
    if (!visible && dialog.open) close();
  }

  function reset() {
    close();
    notificationRequest += 1;
    messages = [];
    messageMentions = [];
    onNotificationsChanged([]);
  }

  return { bind, close, open, refreshNotifications, reset, updateAvailability };
}
